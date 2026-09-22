import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { classNames } from "../../utils/classNames";
import { traceBaseUrl } from "./traceStore";
import { moderatorHeaders } from "../meeting/meetingStore";

type ModelOption = {
  id: string;
  label: string;
  description?: string;
  efforts?: string[];
  default_effort?: string;
};

type Presets = Record<string, { models: ModelOption[]; efforts: string[] }>;

type SwitchResult = { ok?: boolean; async?: boolean; op?: string; busy?: boolean; command?: string; log?: string[]; error?: string };

/** The monitor's view of a switch in progress (`switching`) and of the last one that ended (`last_switch`). */
type SwitchProgress = { op: string; model?: string; effort?: string; stage?: string; detail?: string; started_at?: string };
type SwitchOutcome = { op: string; ok: boolean; model?: string; effort?: string; error?: string; ended_at?: string };
type StateActor = {
  model?: string;
  effort?: string;
  runtime?: string;
  switching?: SwitchProgress | null;
  last_switch?: SwitchOutcome | null;
};

const SWITCH_POLL_MS = 2500;

function stageKey(stage?: string): string {
  switch (stage) {
    case "handoff":
      return "switchStageHandoff";
    case "restarting":
      return "switchStageRestarting";
    case "onboarding":
      return "switchStageOnboarding";
    case "queued":
      return "switchStageQueued";
    default:
      return "switchQueued";
  }
}

/**
 * Click-the-avatar model switcher. Lists the models the runtime itself advertises (via the
 * Knots trace source), lets the operator pick a reasoning effort, and restarts the actor with
 * the new launch command through `cccc actor update` + `cccc actor restart`.
 */
export function ModelSwitchPopover({
  actorId,
  runtime,
  label,
  isDark,
  openInspectorLabel,
  onOpenInspector,
  onOpenChange,
  children,
}: {
  actorId: string;
  runtime: string;
  label: string;
  isDark: boolean;
  openInspectorLabel?: string;
  onOpenInspector?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const updateOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const [presets, setPresets] = useState<Presets>({});
  const [runtimeKey, setRuntimeKey] = useState(runtime); // trace source may know better (custom actor running qwen)
  const [currentModel, setCurrentModel] = useState("");
  const [currentEffort, setCurrentEffort] = useState("");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  // The operation id of the switch this popover is waiting for; "" when none. A switch runs for minutes (handoff,
  // restart, onboarding), so "queued" is not "done": the current model changes only when the monitor reports the
  // outcome under this id.
  const [pendingOp, setPendingOp] = useState("");
  const closeRef = useRef(updateOpen);
  useEffect(() => {
    closeRef.current = updateOpen;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    fetch(`${traceBaseUrl()}/api/state`)
      .then((response) => response.json())
      .then((data: { presets?: Presets; actors?: Record<string, StateActor> }) => {
        if (cancelled) return;
        const nextPresets = data.presets || {};
        setPresets(nextPresets);
        const actor = data.actors?.[actorId];
        const key = String(actor?.runtime || runtime);
        setRuntimeKey(key);
        const runtimeModels = nextPresets[key]?.models || [];
        const current = String(actor?.model || "").trim();
        setCurrentModel(current);
        setCurrentEffort(String(actor?.effort || "").trim());
        setModel(current || runtimeModels[0]?.id || "");
        setEffort(String(actor?.effort || "").trim());
        if (actor?.switching?.op) {
          setPendingOp(actor.switching.op);
          setStatus(t(stageKey(actor.switching.stage)));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [open, actorId, runtime, t]);

  useEffect(() => {
    if (!open || !pendingOp) return;
    let cancelled = false;
    let misses = 0;
    const poll = async () => {
      try {
        const response = await fetch(`${traceBaseUrl()}/api/state`);
        const data = (await response.json()) as { actors?: Record<string, StateActor> };
        if (cancelled) return;
        const actor = data.actors?.[actorId];
        const progress = actor?.switching;
        if (progress?.op === pendingOp) {
          misses = 0;
          setStatus(t(stageKey(progress.stage)));
          return;
        }
        const outcome = actor?.last_switch;
        if (outcome?.op === pendingOp) {
          setPendingOp("");
          if (outcome.ok) {
            setCurrentModel(String(actor?.model || outcome.model || "").trim());
            setCurrentEffort(String(actor?.effort || outcome.effort || "").trim());
            setStatus(t("switchDone"));
            window.setTimeout(() => closeRef.current(false), 1200);
          } else {
            setStatus(`${t("switchFailed")}: ${outcome.error || ""}`);
          }
          return;
        }
        // Neither running nor concluded under this id (the monitor restarted?): stop waiting after a few polls.
        misses += 1;
        if (misses >= 3) {
          setPendingOp("");
          setStatus(t("switchLost"));
        }
      } catch {
        // transient; the next poll tries again
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), SWITCH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, pendingOp, actorId, t]);

  const models = useMemo(() => presets[runtimeKey]?.models || [], [presets, runtimeKey]);
  const selected = models.find((item) => item.id === model);
  const efforts = selected?.efforts?.length ? selected.efforts : presets[runtimeKey]?.efforts || [];

  const apply = async () => {
    setBusy(true);
    setStatus(t("switchWorking"));
    try {
      const response = await fetch(`${traceBaseUrl()}/api/switch`, {
        method: "POST",
        headers: moderatorHeaders(),
        body: JSON.stringify({ actor: actorId, model, effort }),
      });
      const result = (await response.json()) as SwitchResult;
      if (result.ok && result.async && result.op) {
        // Queued, not done: the monitor still collects a handoff, restarts the actor and onboards it again.
        setPendingOp(result.op);
        setStatus(t("switchQueued"));
      } else if (result.ok) {
        setStatus(t("switchDone"));
        setCurrentModel(model);
        setCurrentEffort(effort);
        window.setTimeout(() => updateOpen(false), 1200);
      } else if (result.busy && result.op) {
        setPendingOp(result.op);
        setStatus(t("switchBusy"));
      } else {
        setStatus(`${t("switchFailed")}: ${result.error || (result.log || []).join(" ")}`);
      }
    } catch (error) {
      setStatus(`${t("switchFailed")}: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const rowClass = (active: boolean) =>
    classNames(
      "flex w-full items-start gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12px] transition-colors",
      active
        ? isDark
          ? "bg-white/10"
          : "bg-black/[0.06]"
        : isDark
          ? "hover:bg-white/6"
          : "hover:bg-black/[0.035]",
    );

  return (
    <Popover open={open} onOpenChange={updateOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="center" side="top" sideOffset={12} className="w-[300px] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{label}</div>
            <div className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {runtimeKey}
              {currentModel ? ` · ${currentModel}` : ""}
              {currentEffort ? ` · ${currentEffort}` : ""}
            </div>
          </div>
          {onOpenInspector && openInspectorLabel ? (
            <button
              type="button"
              className={classNames(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                "border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] text-[var(--color-text-secondary)]",
              )}
              onClick={() => {
                updateOpen(false);
                onOpenInspector();
              }}
            >
              {openInspectorLabel}
            </button>
          ) : null}
        </div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("switchModel")}</div>
        {loadError ? (
          <div className="text-[11px] text-rose-500">{loadError}</div>
        ) : models.length === 0 ? (
          <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("switchNoModels")}</div>
        ) : (
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {models.map((item) => (
              <button
                key={item.id}
                type="button"
                className={rowClass(item.id === model)}
                onClick={() => {
                  setModel(item.id);
                  if (item.efforts?.length && !item.efforts.includes(effort)) setEffort(item.default_effort || "");
                }}
              >
                <span className="mt-0.5 w-3 shrink-0 text-center">{item.id === model ? "●" : "○"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block truncate text-[10px] text-[var(--color-text-tertiary)]">{item.description}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
        {efforts.length > 0 ? (
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("switchEffort")}</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={classNames(
                  "rounded-full border px-2 py-0.5 text-[11px]",
                  effort === "" ? "border-transparent bg-[var(--color-text-primary)] text-[var(--color-bg-primary,#fff)]" : "border-[var(--glass-border-subtle)]",
                )}
                onClick={() => setEffort("")}
              >
                {t("switchEffortDefault")}
              </button>
              {efforts.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={classNames(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    effort === level ? "border-transparent bg-[var(--color-text-primary)] text-[var(--color-bg-primary,#fff)]" : "border-[var(--glass-border-subtle)]",
                  )}
                  onClick={() => setEffort(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy || !model || Boolean(pendingOp)}
            className={classNames(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-opacity",
              "bg-violet-600 text-white hover:opacity-90 disabled:opacity-50",
            )}
            onClick={() => void apply()}
          >
            {t("switchApply")}
          </button>
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-text-tertiary)]" title={status}>
            {status}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
