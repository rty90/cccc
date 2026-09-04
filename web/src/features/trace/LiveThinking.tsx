import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { TraceEventList } from "./ThinkingTrace";
import { formatTraceDuration, useTraceStore, type LiveTrace } from "./traceStore";

function phaseLabel(phase: string, t: (key: string) => string): string {
  switch (phase) {
    case "received":
      return t("traceReceived");
    case "tool":
      return t("traceUsingTool");
    case "writing":
      return t("traceWriting");
    default:
      return t("traceStillThinking");
  }
}

function LiveRow({ live, label, isDark, now }: { live: LiveTrace; label: string; isDark: boolean; now: number }) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const startedAt = Date.parse(live.started_at || live.since || "");
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;
  const steps = live.steps.thinking + live.steps.tool + live.steps.text;
  return (
    <div
      className={classNames(
        "pointer-events-auto max-w-[min(720px,100%)] rounded-2xl border px-3 py-2 text-[12px] shadow-lg backdrop-blur",
        isDark ? "border-white/10 bg-slate-950/80 text-slate-200" : "border-black/8 bg-white/90 text-gray-700",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="knots-breathe text-[14px] leading-none text-violet-500 dark:text-violet-300" aria-hidden="true">
          ✳
        </span>
        <span className="font-semibold">{label}</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums">{formatTraceDuration(elapsed)}</span>
        <span className="opacity-50">·</span>
        <span>{t("traceSteps", { count: steps })}</span>
        {live.steps.tool > 0 ? (
          <>
            <span className="opacity-50">·</span>
            <span>{t("traceToolCalls", { count: live.steps.tool })}</span>
          </>
        ) : null}
        <span className="opacity-50">·</span>
        <span className="min-w-0 flex-1 truncate opacity-80">{phaseLabel(live.phase, t)}</span>
        <span className={classNames("text-[10px] transition-transform", open ? "rotate-90" : "")} aria-hidden="true">
          ▸
        </span>
      </button>
      {!open && live.last ? (
        <div className="mt-1 truncate pl-6 text-[11px] text-[var(--color-text-tertiary)]">{live.last}</div>
      ) : null}
      {open ? <TraceEventList events={live.events} /> : null}
    </div>
  );
}

/**
 * "Still thinking" rows for actors that are mid-turn: breathing indicator, elapsed time,
 * step counts and the latest reasoning snippet; expands to the steps so far.
 */
export function LiveThinking({ actors, isDark }: { actors: Actor[]; isDark: boolean }) {
  const connect = useTraceStore((state) => state.connect);
  const live = useTraceStore((state) => state.live);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    connect();
  }, [connect]);
  const working = Object.values(live).filter((entry) => entry && entry.working);
  useEffect(() => {
    if (working.length === 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [working.length]);
  if (working.length === 0) return null;
  const labelFor = (actorId: string): string => {
    const actor = actors.find((item) => item.id === actorId);
    const title = String(actor?.title || "").trim();
    return title || actorId;
  };
  return (
    <div className="flex flex-col items-start gap-2">
      {working.map((entry) => (
        <LiveRow key={entry.actor} live={entry} label={labelFor(entry.actor)} isDark={isDark} now={now} />
      ))}
    </div>
  );
}
