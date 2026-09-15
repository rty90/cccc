import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import {
  formatTraceDuration,
  traceEventGlyph,
  useTraceStore,
  type TraceEvent,
} from "./traceStore";

function eventToneClass(kind: string): string {
  switch (kind) {
    case "thinking":
      return "text-violet-600 dark:text-violet-300";
    case "tool":
      return "text-sky-600 dark:text-sky-300";
    case "text":
      return "text-emerald-600 dark:text-emerald-300";
    case "error":
      return "text-rose-600 dark:text-rose-300";
    default:
      return "text-[var(--color-text-tertiary)]";
  }
}

export function TraceEventList({ events }: { events: TraceEvent[] }) {
  const { t } = useTranslation("chat");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  return (
    <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-[12px] leading-5">
      {events.map((event, index) => {
        const key = `${event.ts}-${index}`;
        const canExpand = typeof event.full === "string" && event.full.length > 0;
        const isOpen = canExpand && !!expanded[key];
        return (
        <li
          key={key}
          className={classNames("flex gap-2", canExpand ? "cursor-pointer" : "")}
          onClick={canExpand ? () => toggle(key) : undefined}
          title={canExpand ? (isOpen ? t("traceCollapseFull") : t("traceShowFull")) : undefined}
        >
          <span
            className={classNames("w-3 shrink-0 text-center font-semibold", eventToneClass(event.kind))}
            aria-hidden="true"
          >
            {traceEventGlyph(event.kind)}
          </span>
          <span
            className={classNames(
              "min-w-0 flex-1 break-words [overflow-wrap:anywhere]",
              isOpen ? "whitespace-pre-wrap" : "",
              event.kind === "tool" ? "font-mono text-[11.5px]" : "",
              event.opaque ? "italic text-[var(--color-text-tertiary)]" : "text-[var(--color-text-secondary)]",
            )}
          >
            {isOpen ? event.full : event.summary}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
            {String(event.ts || "").slice(11, 19)}
          </span>
        </li>
        );
      })}
    </ol>
  );
}

/**
 * Collapsible "thinking process" section under an agent message: the reasoning and tool
 * calls the actor went through between its previous message and this one.
 */
export function ThinkingTrace({ messageId }: { messageId: string; isDark?: boolean }) {
  const { t } = useTranslation("chat");
  const connect = useTraceStore((state) => state.connect);
  const trace = useTraceStore((state) => state.traces[messageId]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    connect();
  }, [connect]);
  if (!trace || !trace.events || trace.events.length === 0) return null;
  const steps = trace.steps.thinking + trace.steps.tool + trace.steps.text;
  if (steps === 0) return null;
  const firstTool = trace.events.find((event) => event.kind === "tool");
  const duration =
    trace.duration_kind === "span"
      ? t("traceSpan", { duration: formatTraceDuration(trace.duration_ms) })
      : t("knotsTraceElapsed", { duration: formatTraceDuration(trace.duration_ms) });
  const label =
    trace.steps.tool === 1 && firstTool
      ? `${firstTool.summary} · ${t("traceSteps", { count: steps })}`
      : trace.steps.tool > 1
        ? `${duration} · ${t("traceToolCalls", { count: trace.steps.tool })}`
        : `${t("traceThinking")} · ${duration}`;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-1.5 text-[12px] leading-5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        aria-expanded={open}
        title={open ? t("traceCollapse") : t("traceExpand")}
      >
        <span
          className={classNames("w-3 shrink-0 text-center text-[14px] leading-none transition-transform", open ? "rotate-90" : "")}
          aria-hidden="true"
        >
          ›
        </span>
        <span className="min-w-0 truncate font-mono text-[11.5px]">{label}</span>
      </button>
      {open ? (
        <div className="mt-1 border-l-2 border-[var(--glass-border-subtle)] pl-3">
          <TraceEventList events={trace.events} />
        </div>
      ) : null}
    </div>
  );
}
