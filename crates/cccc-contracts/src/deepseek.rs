//! Versioned DeepSeek Harness ACP compatibility contract.
//!
//! Keeping these values in the contracts crate prevents the Rust daemon and
//! its setup/preflight callers from silently drifting to a newer preview wire.

pub const DEEPSEEK_RELEASE_VERSION: &str = "0.1.0-rc.6";
/// npm cutoff that keeps preview peer ranges on the validated rc.6 graph.
pub const DEEPSEEK_NPM_BEFORE: &str = "2026-08-14T00:00:00Z";
pub const DEEPSEEK_ACP_PACKAGE: &str = "@deepseek-ai/dsh-acp";
pub const DEEPSEEK_ACP_VERSION: &str = DEEPSEEK_RELEASE_VERSION;
pub const DEEPSEEK_MCP_CLIENT_PACKAGE: &str = "@deepseek-ai/dsh-mcp-client";
pub const DEEPSEEK_MCP_CLIENT_VERSION: &str = DEEPSEEK_RELEASE_VERSION;
pub const DEEPSEEK_ACP_APP_PACKAGE: &str = "@deepseek-ai/dsh-acp-demo";
pub const DEEPSEEK_ACP_APP_VERSION: &str = DEEPSEEK_RELEASE_VERSION;
pub const DEEPSEEK_LLM_ADAPTER_PACKAGE: &str = "@deepseek-ai/dsh-llm-deepseek";
pub const DEEPSEEK_LLM_ADAPTER_VERSION: &str = DEEPSEEK_RELEASE_VERSION;
pub const DEEPSEEK_NODE_RANGE: &str = "^22.19.0 || >=24.0.0";
pub const DEEPSEEK_PROTOCOL_VERSION: u64 = 1;
/// ACP SDK baseline locked for this preview wire contract.
pub const DEEPSEEK_ACP_SDK_VERSION: &str = "0.25.1";
pub const DEEPSEEK_TURN_TIMEOUT_SECONDS: u64 = 300;
/// Output budget that preserves room for prompt and MCP tool context.
pub const DEEPSEEK_MAX_OUTPUT_TOKENS: u64 = 65536;

/// Reasoning effort the managed ACP profile is generated with when nothing
/// overrides it (the rc.6 LLM adapter's own default).
pub const DEEPSEEK_DEFAULT_REASONING: &str = "high";

/// Reasoning effort for the managed ACP profile: `CCCC_DEEPSEEK_REASONING`
/// from the launch environment (actor env included) when it is one of the
/// values the rc.6 adapter accepts (`off`, `high`, `max`), else the default.
pub fn deepseek_reasoning(env: &std::collections::BTreeMap<String, String>) -> String {
    match env
        .get("CCCC_DEEPSEEK_REASONING")
        .map(|value| value.trim().to_ascii_lowercase())
    {
        Some(effort) if effort == "off" || effort == "high" || effort == "max" => effort,
        _ => DEEPSEEK_DEFAULT_REASONING.to_owned(),
    }
}

/// Model the managed ACP profile is generated with when nothing overrides it.
pub const DEEPSEEK_DEFAULT_MODEL: &str = "deepseek-v4-flash";

/// Model for the managed ACP profile: `CCCC_DEEPSEEK_MODEL` from the launch
/// environment (actor env included) when it names a DeepSeek model, else the
/// default. Only the model line of the canonical profile is affected.
pub fn deepseek_model(env: &std::collections::BTreeMap<String, String>) -> String {
    match env
        .get("CCCC_DEEPSEEK_MODEL")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        Some(model)
            if model.starts_with("deepseek-")
                && model
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.') =>
        {
            model.to_owned()
        }
        _ => DEEPSEEK_DEFAULT_MODEL.to_owned(),
    }
}
