import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { TraceEventList } from "./ThinkingTrace";
import { formatTraceDuration, useTraceStore } from "./traceStore";
import { useMeetingStore } from "../meeting/meetingStore";

const MAX_WORKING_CHIPS = 3;

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
 * One quiet status line for the actors that are mid-turn, plus the moderator's actor statuses
 * (starting / handoff / failed) folded into one chip per status. Clicking a working chip unfolds
 * that actor's steps so far. Nothing is rendered when the room is idle.
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
  const actorStatus = useMeetingStore((state) => state.actorStatus);
  const statusEntries = Object.entries(actorStatus).filter(([, entry]) => {
    const age = now - Date.parse(entry.ts);
    if (entry.status === "starting" || entry.status === "handoff") return age < 3 * 60 * 1000;
    if (entry.status === "failed") return age < 30 * 60 * 1000;
    return age < 20 * 1000;
  });
  useEffect(() => {
    if (working.length === 0 && statusEntries.length === 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [working.length, statusEntries.length]);
  if (working.length === 0 && statusEntries.length === 0) return null;
  const labelFor = (actorId: string): string => {
    const actor = actors.find((item) => item.id === actorId);
    const title = String(actor?.title || "").trim();
    return title || actorId;
  };
  // One chip per status ("codex-1, claude-1 +2 · handing off"), names and details in the tooltip.
  const grouped = new Map<string, { names: string[]; details: string[] }>();
  for (const [actor, entry] of statusEntries) {
    const group = grouped.get(entry.status) || { names: [], details: [] };
    group.names.push(labelFor(actor));
    if (entry.detail) group.details.push(`${labelFor(actor)}: ${entry.detail}`);
    grouped.set(entry.status, group);
  }
  const shownWorking = working.slice(0, MAX_WORKING_CHIPS);
  const hiddenWorking = working.length - shownWorking.length;
  const opened = openActor ? working.find((entry) => entry.actor === openActor) : undefined;
  return (
    <div className={classNames("rounded-xl px-2 py-1 text-[11px]", isDark ? "text-slate-300" : "text-gray-600")}>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        <span className="knots-breathe shrink-0 text-[12px] leading-none text-violet-500 dark:text-violet-300" aria-hidden="true">
          ✳
        </span>
        {Array.from(grouped.entries()).map(([status, group]) => (
          <span
            key={`status-${status}`}
            title={group.details.join("\n") || group.names.join(", ")}
            className={classNames(
              "inline-flex max-w-[260px] shrink-0 items-center gap-1 rounded-full px-2 py-0.5",
              status === "failed"
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                : status === "online"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-violet-500/10 text-violet-700 dark:text-violet-300",
            )}
          >
            {status === "starting" || status === "handoff" ? <span className="knots-breathe" aria-hidden="true">⟳</span> : null}
            <span className="truncate font-medium">
              {group.names.slice(0, 2).join(", ")}
              {group.names.length > 2 ? ` +${group.names.length - 2}` : ""}
            </span>
            <span className="opacity-70">{t(`actorStatus_${status}`)}</span>
          </span>
        ))}
        {shownWorking.map((entry) => {
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
                "knots-press inline-flex max-w-[240px] shrink-0 items-center gap-1 rounded-full px-2 py-0.5",
                active ? (isDark ? "bg-white/10" : "bg-black/[0.06]") : "bg-[var(--glass-tab-bg)]",
              )}
            >
              <span className="font-medium">{labelFor(entry.actor)}</span>
              <span className="tabular-nums opacity-60">{formatTraceDuration(elapsed)}</span>
              <span className="truncate opacity-70">{phaseLabel(entry.phase, t)}</span>
            </button>
          );
        })}
        {hiddenWorking > 0 ? <span className="shrink-0 opacity-60">+{hiddenWorking}</span> : null}
      </div>
      {opened ? (
        <div className="mt-1 border-t border-[var(--glass-border-subtle)] pt-1">
          {opened.last ? <div className="truncate text-[var(--color-text-tertiary)]">{opened.last}</div> : null}
          <div className="max-h-40 overflow-y-auto">
            <TraceEventList events={opened.events} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
