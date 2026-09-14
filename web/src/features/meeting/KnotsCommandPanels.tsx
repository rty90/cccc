import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { traceBaseUrl } from "../trace/traceStore";
import { moderatorGet, useMeetingStore, voteNeedsRuling } from "./meetingStore";

/**
 * The two panels behind /usage and /status: read-only tables from the trace monitor (calls and tokens per provider,
 * model and actor) and the moderator (messages per actor, tiers, what is pending). Opened by the slash commands only.
 */
type Bucket = {
  requests: number;
  input: number;
  output: number;
  cached: number;
  cache_write: number;
  thinking: number;
  model?: string;
  provider?: string;
};
type DayUsage = { actors: Record<string, Bucket>; models: Record<string, Bucket>; providers: Record<string, Bucket> };
type Balance = { currency: string; total: number; spent_today?: number; ts: string };
type MonitorUsage = {
  today: string;
  days: Record<string, DayUsage>;
  rate_limits: Record<string, Record<string, unknown>>;
  balances?: Record<string, Balance>;
  actor_providers: Record<string, string>;
  notes: Record<string, string>;
};
type ModeratorUsage = { today?: Record<string, { turns: number; chars: number }>; alert_turns?: number; tiers?: Record<string, string> };
type MonitorActor = { id?: string; runtime?: string; running?: boolean | null; phase?: string; model?: string; effort?: string; state?: string };
type MonitorState = { actors?: Record<string, MonitorActor> };

function fmt(n: number | undefined): string {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(v);
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            {head.map((h, i) => (
              <th key={i} className={classNames("px-2 py-1 font-semibold", i > 0 ? "text-right" : "")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-[var(--glass-border-subtle)]">
              {row.map((cell, c) => (
                <td key={c} className={classNames("px-2 py-1 tabular-nums", c > 0 ? "text-right text-[var(--color-text-secondary)]" : "font-medium")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{title}</div>
      {children}
    </section>
  );
}

function UsagePanel() {
  const { t } = useTranslation("chat");
  const [monitor, setMonitor] = useState<MonitorUsage | null>(null);
  const [moderator, setModerator] = useState<ModeratorUsage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setError("");
    fetch(`${traceBaseUrl()}/api/usage`)
      .then((r) => r.json())
      .then((d: MonitorUsage) => {
        if (!cancelled) setMonitor(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    void moderatorGet<ModeratorUsage>("/api/usage").then((d) => {
      if (!cancelled) setModerator(d || {});
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const day = monitor?.days?.[monitor.today] || { actors: {}, models: {}, providers: {} };
  const byRequests = (a: [string, Bucket], b: [string, Bucket]) => b[1].requests - a[1].requests;
  const providers = Object.entries(day.providers || {}).sort(byRequests);
  const models = Object.entries(day.models || {}).sort(byRequests);
  const turns = moderator?.today || {};
  const tiers = moderator?.tiers || {};
  const actorIds = Array.from(new Set([...Object.keys(day.actors || {}), ...Object.keys(turns)])).sort();
  const numeric = (b: Bucket) => [fmt(b.requests), fmt(b.input), fmt(b.cached), fmt(b.output), fmt(b.thinking)];
  const balances = Object.entries(monitor?.balances || {});
  const notes = Object.entries(monitor?.notes || {}).filter(([provider]) => providers.some(([p]) => p === provider) || Object.values(monitor?.actor_providers || {}).includes(provider));
  return (
    <div className="space-y-4">
      <DialogTitle className="text-[15px] font-semibold">{t("usagePanelTitle")}</DialogTitle>
      <DialogDescription className="text-[12px] text-[var(--color-text-tertiary)]">
        {t("usagePanelDesc", { day: monitor?.today || "" })}
      </DialogDescription>
      {error ? <div className="text-[12px] text-rose-500">{error}</div> : null}
      {!monitor && !error ? <div className="text-[13px] text-[var(--color-text-tertiary)]">{t("usageLoading")}</div> : null}
      {monitor && providers.length === 0 && actorIds.length === 0 ? <div className="text-[13px] text-[var(--color-text-tertiary)]">{t("usageEmpty")}</div> : null}
      {providers.length > 0 ? (
        <Section title={t("usageProviders")}>
          <Table head={[t("usageProviders"), t("usageRequests"), t("usageInput"), t("usageCached"), t("usageOutput"), t("usageThinking")]} rows={providers.map(([name, b]) => [name, ...numeric(b)])} />
        </Section>
      ) : null}
      {balances.length > 0 ? (
        <div className="space-y-0.5 text-[13px] text-[var(--color-text-secondary)]">
          {balances.map(([provider, b]) => (
            <div key={provider}>
              {t("usageBalance", {
                provider,
                amount: `${b.currency} ${Number(b.total || 0).toFixed(2)}`,
                spent: `${b.currency} ${Number(b.spent_today || 0).toFixed(2)}`,
              })}
            </div>
          ))}
        </div>
      ) : null}
      {models.length > 0 ? (
        <Section title={t("usageModels")}>
          <Table head={[t("usageModels"), t("usageRequests"), t("usageInput"), t("usageCached"), t("usageOutput"), t("usageThinking")]} rows={models.map(([name, b]) => [<span key={name}>{name} <span className="text-[11px] text-[var(--color-text-tertiary)]">{b.provider || ""}</span></span>, ...numeric(b)])} />
        </Section>
      ) : null}
      {actorIds.length > 0 ? (
        <Section title={t("usageActors")}>
          <Table
            head={[t("usageActors"), t("usageTurns"), t("usageRequests"), t("usageInput"), t("usageOutput"), t("usageTier")]}
            rows={actorIds.map((aid) => {
              const b = day.actors?.[aid];
              return [
                <span key={aid}>{aid} <span className="text-[11px] text-[var(--color-text-tertiary)]">{b?.model || monitor?.actor_providers?.[aid] || ""}</span></span>,
                fmt(turns[aid]?.turns),
                b ? fmt(b.requests) : "–",
                b ? fmt(b.input) : "–",
                b ? fmt(b.output) : "–",
                tiers[aid] || "both",
              ];
            })}
          />
        </Section>
      ) : null}
      {Object.keys(monitor?.rate_limits || {}).length > 0 ? (
        <Section title={t("usageRateLimits")}>
          <pre className="max-h-40 overflow-auto rounded-lg bg-black/5 p-2 text-[11px] dark:bg-white/5">{JSON.stringify(monitor?.rate_limits, null, 1)}</pre>
        </Section>
      ) : null}
      {notes.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] text-[var(--color-text-tertiary)]">
          {notes.map(([provider, note]) => (
            <li key={provider}>
              <span className="font-medium">{provider}</span>: {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusPanel({ actors }: { actors: Actor[] }) {
  const { t } = useTranslation("chat");
  const connected = useMeetingStore((state) => state.connected);
  const harness = useMeetingStore((state) => state.harness);
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const lessons = useMeetingStore((state) => state.lessons);
  const help = useMeetingStore((state) => state.help);
  const updates = useMeetingStore((state) => state.updates);
  const [monitor, setMonitor] = useState<MonitorState | null>(null);
  const [tiers, setTiers] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`${traceBaseUrl()}/api/state`)
      .then((r) => r.json())
      .then((d: MonitorState) => {
        if (!cancelled) setMonitor(d);
      })
      .catch(() => undefined);
    void moderatorGet<ModeratorUsage>("/api/usage").then((d) => {
      if (!cancelled) setTiers(d?.tiers || {});
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const openMeetings = meetings.filter((m) => m.status !== "closed").length;
  const openProjects = projects.filter((p) => p.status !== "adopted" && p.status !== "rejected" && p.status !== "stopped").length;
  const pending =
    meetings.flatMap((m) => m.votes.filter((v) => voteNeedsRuling(v, m))).length +
    help.filter((h) => h.status !== "resolved").length +
    projects.filter((p) => p.status === "awaiting_human").length +
    lessons.filter((l) => l.status === "candidate").length +
    Object.values(updates || {}).filter((u) => u.status === "available" || u.status === "failed").length;
  const rows = actors.map((actor) => {
    const id = String(actor.id || "");
    const m = monitor?.actors?.[id] || {};
    const running = typeof m.running === "boolean" ? m.running : typeof actor.running === "boolean" ? actor.running : Boolean(actor.enabled);
    return [
      <span key={id}>{String(actor.title || id)} <span className="text-[11px] text-[var(--color-text-tertiary)]">{id}</span></span>,
      running ? t("statusRunning") : t("statusStopped"),
      String(m.phase || m.state || "–"),
      `${m.model || ""}${m.effort ? ` · ${m.effort}` : ""}` || "–",
      tiers[id] || "both",
    ];
  });
  return (
    <div className="space-y-4">
      <DialogTitle className="text-[15px] font-semibold">{t("statusPanelTitle")}</DialogTitle>
      <DialogDescription className="text-[12px] text-[var(--color-text-tertiary)]">
        {connected ? t("statusConnected") : t("statusDisconnected")} · {t("statusProtocol", { version: harness?.version ?? "?" })} ·{" "}
        {t("statusOpenMeetings", { count: openMeetings })} · {t("statusOpenProjects", { count: openProjects })} · {t("statusPending", { count: pending })}
      </DialogDescription>
      <Section title={t("statusActors")}>
        <Table head={[t("statusActors"), t("statusRunningHead"), t("statusPhase"), t("statusModel"), t("usageTier")]} rows={rows} />
      </Section>
    </div>
  );
}

export function KnotsCommandPanels({ actors }: { actors: Actor[] }) {
  const panel = useMeetingStore((state) => state.panel);
  const setPanel = useMeetingStore((state) => state.setPanel);
  return (
    <Dialog open={panel !== null} onOpenChange={(open) => (open ? undefined : setPanel(null))}>
      <DialogContent className="max-h-[85vh] w-[min(96vw,760px)] max-w-none overflow-y-auto p-5">
        {panel === "usage" ? <UsagePanel /> : panel === "status" ? <StatusPanel actors={actors} /> : null}
      </DialogContent>
    </Dialog>
  );
}
