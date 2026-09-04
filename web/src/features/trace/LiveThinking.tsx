import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { TraceEventList } from "./ThinkingTrace";
import { formatTraceDuration, useTraceStore } from "./traceStore";

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

/**
 * One status line for the actors that are mid-turn: a breathing marker, then one chip per actor
 * (name, elapsed, phase). Clicking a chip unfolds that actor's steps so far below the line.
 * Replaces the earlier stack of one card per actor, which pushed the composer down and competed
 * with the runtime dock for the same band of the screen.
 */
export function LiveThinking({ actors, isDark }: { actors: Actor[]; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const connect = useTraceStore((state) => state.connect);
  const live = useTraceStore((state) => state.live);
  const [now, setNow] = useState(() => Date.now());
  const [openActor, setOpenActor] = useState<string | null>(null);
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
  const opened = openActor ? working.find((entry) => entry.actor === openActor) : undefined;
  return (
    <div
      className={classNames(
        "rounded-2xl border px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur",
        isDark ? "border-white/10 bg-slate-950/70 text-slate-200" : "border-black/8 bg-white/85 text-gray-700",
      )}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="knots-breathe shrink-0 text-[13px] leading-none text-violet-500 dark:text-violet-300" aria-hidden="true">
          ✳
        </span>
        <span className="shrink-0 opacity-60">{t("liveWorking")}</span>
        {working.map((entry) => {
          const startedAt = Date.parse(entry.started_at || entry.since || "");
          const elapsed = Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;
          const active = openActor === entry.actor;
          return (
            <button
              key={entry.actor}
              type="button"
              aria-expanded={active}
              onClick={() => setOpenActor((current) => (current === entry.actor ? null : entry.actor))}
              className={classNames(
                "knots-press inline-flex max-w-[260px] shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5",
                active
                  ? isDark
                    ? "border-transparent bg-white/10"
                    : "border-transparent bg-black/[0.06]"
                  : "border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)]",
              )}
            >
              <span className="font-semibold">{labelFor(entry.actor)}</span>
              <span className="tabular-nums opacity-70">{formatTraceDuration(elapsed)}</span>
              <span className="truncate opacity-80">{phaseLabel(entry.phase, t)}</span>
              {entry.steps.tool > 0 ? <span className="opacity-60">{t("traceToolCalls", { count: entry.steps.tool })}</span> : null}
            </button>
          );
        })}
      </div>
      {opened ? (
        <div className="mt-1.5 border-t border-[var(--glass-border-subtle)] pt-1.5">
          {opened.last ? <div className="truncate text-[var(--color-text-tertiary)]">{opened.last}</div> : null}
          <div className="max-h-40 overflow-y-auto">
            <TraceEventList events={opened.events} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
