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
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={classNames(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
          "border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] text-[var(--color-text-secondary)] hover:opacity-100",
        )}
        aria-expanded={open}
        title={open ? t("traceCollapse") : t("traceExpand")}
      >
        <span className="text-[12px] leading-none text-violet-500 dark:text-violet-300" aria-hidden="true">
          ✳
        </span>
        <span>{t("traceThinking")}</span>
        <span className="opacity-55">·</span>
        <span>{formatTraceDuration(trace.duration_ms)}</span>
        <span className="opacity-55">·</span>
        <span>{t("traceSteps", { count: steps })}</span>
        {trace.steps.tool > 0 ? (
          <>
            <span className="opacity-55">·</span>
            <span>{t("traceToolCalls", { count: trace.steps.tool })}</span>
          </>
        ) : null}
        <span className={classNames("ml-0.5 text-[10px] transition-transform", open ? "rotate-90" : "")} aria-hidden="true">
          ▸
        </span>
      </button>
      {open ? (
        <div className="mt-2 rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] px-3 py-2">
          <TraceEventList events={trace.events} />
        </div>
      ) : null}
    </div>
  );
}
