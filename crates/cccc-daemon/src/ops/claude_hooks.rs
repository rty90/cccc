use cccc_core::HomeLayout;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[path = "claude_hook_version.rs"]
mod version;
use version::supported_version;

const HOOK_TIMEOUT_SECONDS: u64 = 3;
const HOOK_EVENTS: [&str; 8] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop",
    "SessionEnd",
];
const NOTIFICATION_MATCHER: &str =
    "permission_prompt|idle_prompt|elicitation_dialog|agent_needs_input|agent_completed";
/// Settings key Claude Code records once a human has accepted the
/// "Bypass Permissions mode" startup warning.
const BYPASS_PROMPT_ACCEPTED_KEY: &str = "skipDangerousModePermissionPrompt";
/// `.claude.json` project field Claude Code records once a human has accepted
/// the workspace trust dialog for a directory.
const TRUST_ACCEPTED_KEY: &str = "hasTrustDialogAccepted";

pub fn configure(
    home: &HomeLayout,
    group_id: &str,
    actor_id: &str,
    cwd: &Path,
    command: &mut Vec<String>,
    env: &mut BTreeMap<String, String>,
) -> std::io::Result<super::runtime_hook_session::HookSetup> {
    // Claude Code parks its interactive TUI behind startup dialogs whose
    // default answer is "No, exit": the per-directory workspace trust dialog
    // and, with --dangerously-skip-permissions, the bypass-permissions
    // warning. Anything CCCC types into them (the preamble plus Enter)
    // terminates the process. The operator attached this scope deliberately,
    // so record the same acceptance a human would have given before spawning.
    match pretrust_workspace(cwd, env) {
        Ok(true) => tracing::info!(
            group_id = %group_id,
            actor_id = %actor_id,
            cwd = %cwd.display(),
            "recorded Claude workspace trust for the actor scope"
        ),
        Ok(false) => {}
        Err(error) => tracing::warn!(
            %error,
            group_id = %group_id,
            actor_id = %actor_id,
            cwd = %cwd.display(),
            "failed to record Claude workspace trust; the trust dialog may block delivery"
        ),
    }
    let launch_token =
        super::codex_mcp::begin_hook_launch(home, "claude", group_id, actor_id, env)?;
    if !is_direct_claude_command(command) {
        super::codex_mcp::record_launch_issue(
            home,
            "claude",
            group_id,
            actor_id,
            &launch_token,
            "HookUnavailableCommand",
        )?;
        return Ok(setup(launch_token, false));
    }
    if !supported_version(&command[0], cwd, env) {
        super::codex_mcp::record_launch_issue(
            home,
            "claude",
            group_id,
            actor_id,
            &launch_token,
            "HookUnavailableVersion",
        )?;
        return Ok(setup(launch_token, false));
    }
    let Some(executable) = super::codex_mcp::configure_actor_cli(env) else {
        super::codex_mcp::record_launch_issue(
            home,
            "claude",
            group_id,
            actor_id,
            &launch_token,
            "HookUnavailableExecutable",
        )?;
        return Ok(setup(launch_token, false));
    };
    let settings_path = cccc_core::GroupStore::new(home.clone())?
        .state_dir(group_id)?
        .join("runtime-settings")
        .join(format!("{actor_id}.claude.json"));
    if append_settings(command, cwd, &executable, &settings_path).is_err() {
        super::codex_mcp::record_launch_issue(
            home,
            "claude",
            group_id,
            actor_id,
            &launch_token,
            "HookUnavailableSettings",
        )?;
        return Ok(setup(launch_token, false));
    }
    env.insert(
        "CCCC_HOME".into(),
        home.root().to_string_lossy().into_owned(),
    );
    env.insert("CCCC_GROUP_ID".into(), group_id.to_owned());
    env.insert("CCCC_ACTOR_ID".into(), actor_id.to_owned());
    Ok(setup(launch_token, true))
}

fn setup(launch_token: String, hook_enabled: bool) -> super::runtime_hook_session::HookSetup {
    super::runtime_hook_session::HookSetup {
        runtime: "claude".into(),
        launch_token,
        hook_enabled,
    }
}

fn is_direct_claude_command(command: &[String]) -> bool {
    command
        .first()
        .and_then(|value| value.rsplit(['/', '\\']).next())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "claude" | "claude.exe" | "claude.cmd" | "claude.bat"
            )
        })
}

fn append_settings(
    command: &mut Vec<String>,
    cwd: &Path,
    executable: &Path,
    settings_path: &Path,
) -> Result<(), String> {
    let mut effective_settings = None;
    let mut retained = Vec::with_capacity(command.len() + 2);
    let mut post_double_dash = Vec::new();
    let mut index = 0;
    while index < command.len() {
        if command[index] == "--" {
            post_double_dash.extend_from_slice(&command[index..]);
            break;
        }
        if command[index] == "--settings" {
            let value = command
                .get(index + 1)
                .ok_or_else(|| "--settings requires a value".to_owned())?;
            effective_settings = Some(value.clone());
            index += 2;
        } else if let Some(value) = command[index].strip_prefix("--settings=") {
            effective_settings = Some(value.to_owned());
            index += 1;
        } else {
            retained.push(command[index].clone());
            index += 1;
        }
    }

    let mut settings = match effective_settings {
        Some(value) => load_settings(&value, cwd)?,
        None => Map::new(),
    };
    // CCCC asked for bypass mode on purpose; acknowledge the warning dialog
    // the same way a human would, unless the operator's settings already say
    // otherwise.
    if bypass_permissions_requested(&retained) {
        settings
            .entry(BYPASS_PROMPT_ACCEPTED_KEY)
            .or_insert(Value::Bool(true));
    }
    let hooks_value = settings
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    if hooks_value.is_null() {
        *hooks_value = Value::Object(Map::new());
    }
    let hooks = hooks_value
        .as_object_mut()
        .ok_or_else(|| "Claude settings hooks must be an object".to_owned())?;
    let hook_command = super::codex_mcp::hook_command_for(executable, "claude-state");
    for event in HOOK_EVENTS {
        append_hook_group(hooks, event, &hook_command, None)?;
    }
    append_hook_group(
        hooks,
        "Notification",
        &hook_command,
        Some(NOTIFICATION_MATCHER),
    )?;
    cccc_core::fs::write_secret_json(settings_path, &Value::Object(settings))
        .map_err(|error| format!("failed to write managed Claude settings: {error}"))?;
    retained.extend([
        "--settings".into(),
        settings_path.to_string_lossy().into_owned(),
    ]);
    retained.extend(post_double_dash);
    *command = retained;
    Ok(())
}

fn load_settings(value: &str, cwd: &Path) -> Result<Map<String, Value>, String> {
    let source = if value.trim_start().starts_with('{') {
        value.to_owned()
    } else {
        let path = PathBuf::from(value);
        let path = if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        };
        fs::read_to_string(&path).map_err(|error| {
            format!("failed to read Claude settings {}: {error}", path.display())
        })?
    };
    serde_json::from_str::<Value>(&source)
        .map_err(|error| format!("invalid Claude settings JSON: {error}"))?
        .as_object()
        .cloned()
        .ok_or_else(|| "Claude settings must be a JSON object".to_owned())
}

fn append_hook_group(
    hooks: &mut Map<String, Value>,
    event: &str,
    command: &str,
    matcher: Option<&str>,
) -> Result<(), String> {
    let groups = hooks
        .entry(event)
        .or_insert_with(|| Value::Array(Vec::new()))
        .as_array_mut()
        .ok_or_else(|| format!("Claude hook {event} must be an array"))?;
    let mut group = Map::new();
    if let Some(matcher) = matcher {
        group.insert("matcher".into(), Value::String(matcher.into()));
    }
    group.insert(
        "hooks".into(),
        json!([{
            "type": "command",
            "command": command,
            "timeout": HOOK_TIMEOUT_SECONDS
        }]),
    );
    groups.push(Value::Object(group));
    Ok(())
}

/// Record `cwd` as a trusted workspace in Claude's config file, exactly as
/// Claude does when a human answers "Yes, I trust this folder". Returns
/// `Ok(true)` when the file was changed.
fn pretrust_workspace(cwd: &Path, env: &BTreeMap<String, String>) -> io::Result<bool> {
    let config_path = claude_config_path(env).ok_or_else(|| {
        io::Error::other(
            "cannot locate the Claude config file: no CLAUDE_CONFIG_DIR, HOME, or USERPROFILE",
        )
    })?;
    let key = workspace_key(cwd);
    let mut root = match fs::read_to_string(&config_path) {
        Ok(source) => serde_json::from_str::<Value>(&source).map_err(|error| {
            io::Error::other(format!(
                "{} is not valid JSON: {error}",
                config_path.display()
            ))
        })?,
        Err(error) if error.kind() == io::ErrorKind::NotFound => Value::Object(Map::new()),
        Err(error) => return Err(error),
    };
    let changed = mark_trusted(&mut root, &key)
        .map_err(|message| io::Error::other(format!("{}: {message}", config_path.display())))?;
    if !changed {
        return Ok(false);
    }
    let serialized = serde_json::to_string_pretty(&root)?;
    write_atomic(&config_path, serialized.as_bytes())?;
    Ok(true)
}

fn mark_trusted(root: &mut Value, key: &str) -> Result<bool, String> {
    let root = root
        .as_object_mut()
        .ok_or("top-level value is not an object")?;
    let projects = root
        .entry("projects")
        .or_insert_with(|| Value::Object(Map::new()));
    if projects.is_null() {
        *projects = Value::Object(Map::new());
    }
    let projects = projects
        .as_object_mut()
        .ok_or("projects field is not an object")?;
    let project = projects
        .entry(key)
        .or_insert_with(|| Value::Object(Map::new()));
    if project.is_null() {
        *project = Value::Object(Map::new());
    }
    let project = project
        .as_object_mut()
        .ok_or("project entry is not an object")?;
    if project.get(TRUST_ACCEPTED_KEY) == Some(&Value::Bool(true)) {
        return Ok(false);
    }
    project.insert(TRUST_ACCEPTED_KEY.into(), Value::Bool(true));
    Ok(true)
}

/// Claude keeps its config at `$CLAUDE_CONFIG_DIR/.claude.json`, else
/// `~/.claude.json`. The actor's launch environment wins over the daemon's.
fn claude_config_path(env: &BTreeMap<String, String>) -> Option<PathBuf> {
    let lookup = |name: &str| {
        env.get(name)
            .filter(|value| !value.trim().is_empty())
            .cloned()
            .or_else(|| {
                std::env::var(name)
                    .ok()
                    .filter(|value| !value.trim().is_empty())
            })
    };
    if let Some(dir) = lookup("CLAUDE_CONFIG_DIR") {
        return Some(PathBuf::from(dir).join(".claude.json"));
    }
    let home = lookup("HOME").or_else(|| lookup("USERPROFILE"))?;
    Some(PathBuf::from(home).join(".claude.json"))
}

/// The `projects` map is keyed by the path Claude sees as its cwd, which never
/// carries the Windows verbatim prefix a canonicalized path may have.
fn workspace_key(cwd: &Path) -> String {
    let text = cwd.to_string_lossy();
    let verbatim_prefix: String = ['\\', '\\', '?', '\\'].iter().collect();
    match text.strip_prefix(verbatim_prefix.as_str()) {
        Some(stripped) => stripped.to_owned(),
        None => text.into_owned(),
    }
}

fn bypass_permissions_requested(args: &[String]) -> bool {
    args.iter().enumerate().any(|(index, arg)| {
        arg == "--dangerously-skip-permissions"
            || arg == "--allow-dangerously-skip-permissions"
            || arg == "--permission-mode=bypassPermissions"
            || (arg == "--permission-mode"
                && args.get(index + 1).map(String::as_str) == Some("bypassPermissions"))
    })
}

fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other(format!("{} has no parent directory", path.display())))?;
    fs::create_dir_all(parent)?;
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| ".claude.json".to_owned());
    let temp = parent.join(format!("{name}.cccc-{}.tmp", std::process::id()));
    fs::write(&temp, bytes)?;
    #[cfg(unix)]
    {
        if let Ok(metadata) = fs::metadata(path) {
            let _ = fs::set_permissions(&temp, metadata.permissions());
        }
    }
    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
#[path = "claude_hooks_tests.rs"]
mod tests;
