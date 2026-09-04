import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { HumanRulingForm } from "./HumanRuling";
import { HarnessTab, MeetingsTab, ModeBadge } from "./MeetingPanel";
import { useMeetingStore, type SidebarTab } from "./meetingStore";

/**
 * One docked column for everything the Knots moderator owns: meetings, the room protocol and
 * skills, the moderator log, and a "needs you" strip on top. It sits beside the message list
 * (the list shrinks; nothing floats over it). Below the md breakpoint it slides in as a sheet.
 */
export function KnotsSidebarToggle({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation("chat");
  const connect = useMeetingStore((state) => state.connect);
  const meetings = useMeetingStore((state) => state.meetings);
  const harness = useMeetingStore((state) => state.harness);
  const connected = useMeetingStore((state) => state.connected);
  const open = useMeetingStore((state) => state.ui.sidebarOpen);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  useEffect(() => {
    connect();
  }, [connect]);
  const active = meetings.filter((meeting) => meeting.status !== "closed").length;
  const pending = meetings.flatMap((meeting) => meeting.votes).filter((vote) => vote.status === "closed" && vote.awaiting_human && !vote.human).length;
  return (
    <button
      type="button"
      onClick={() => setSidebar(!open)}
      aria-pressed={open}
      title={connected ? t("knotsToggle") : t("meetingOffline")}
      className={classNames(
        "knots-press pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-xl backdrop-blur-xl ring-1",
        isDark ? "border-white/10 bg-slate-900/60 text-slate-200 ring-white/5" : "border-black/5 bg-white/70 text-gray-700 ring-black/5",
        open ? (isDark ? "bg-white/[0.08] text-white" : "bg-[rgb(245,245,245)] text-[rgb(35,36,37)]") : "",
      )}
    >
      <span className={classNames("h-1.5 w-1.5 shrink-0 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
      {t("knotsToggle")}
      {active > 0 ? <span className="rounded-full bg-violet-600 px-1.5 text-[10px] text-white">{active}</span> : null}
      {pending > 0 ? <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{pending}</span> : null}
      <span className="opacity-40">·</span>
      <span className="opacity-75">{t("harnessChip", { version: harness?.version ?? "?" })}</span>
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={classNames(
        "knots-press rounded-full px-2.5 py-1 text-[11px] font-medium",
        active ? "bg-[var(--color-text-primary)] text-[var(--color-bg-primary,#fff)]" : "text-[var(--color-text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}

export function KnotsSidebar({ actors, isDark }: { actors: Actor[]; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const open = useMeetingStore((state) => state.ui.sidebarOpen);
  const tab = useMeetingStore((state) => state.ui.tab);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  const meetings = useMeetingStore((state) => state.meetings);
  const log = useMeetingStore((state) => state.log);
  const harness = useMeetingStore((state) => state.harness);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && window.innerWidth < 768) setSidebar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setSidebar]);

  if (!open) return null;

  const pending = meetings
    .flatMap((meeting) => meeting.votes.map((vote) => ({ meeting, vote })))
    .filter(({ vote }) => vote.status === "open" || (vote.status === "closed" && vote.awaiting_human && !vote.human));
  const activeCount = meetings.filter((meeting) => meeting.status !== "closed").length;
  const tabs: Array<[SidebarTab, string]> = [
    ["meetings", `${t("sidebarTabMeetings")}${activeCount ? ` ${activeCount}` : ""}`],
    ["harness", `${t("sidebarTabHarness")} v${harness?.version ?? "?"}`],
    ["log", t("sidebarTabLog")],
  ];

  return (
    <aside
      aria-label={t("knotsToggle")}
      className={classNames(
        "fixed inset-y-0 right-0 z-[900] flex w-[min(92vw,380px)] flex-col border-l shadow-2xl",
        "md:static md:inset-auto md:z-auto md:w-[380px] md:min-h-0 md:flex-shrink-0 md:shadow-none",
        isDark ? "border-white/8 bg-slate-950/95 md:bg-slate-950/35" : "border-black/8 bg-white md:bg-white/55",
      )}
    >
      <div className={classNames("flex items-center gap-1 border-b px-2 py-1.5", isDark ? "border-white/8" : "border-black/8")} role="tablist">
        {tabs.map(([key, label]) => (
          <TabButton key={key} active={tab === key} onClick={() => setSidebar(true, key)}>
            {label}
          </TabButton>
        ))}
        <button
          type="button"
          className="knots-press ml-auto rounded-full p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          aria-label={t("sidebarClose")}
          title={t("sidebarClose")}
          onClick={() => setSidebar(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {pending.length > 0 ? (
        <div className={classNames("max-h-[46%] shrink-0 space-y-2 overflow-y-auto border-b px-2 py-2", isDark ? "border-white/8" : "border-black/8")}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("sidebarPending")}</div>
          {pending.map(({ meeting, vote }) => {
            const cast = Object.keys(vote.ballots).length;
            const total = meeting.participants.length;
            return (
              <div key={vote.id} className={classNames("rounded-xl border p-2", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]")}>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold">
                    #{meeting.id} · {t("voteCard")} #{vote.id}
                  </span>
                  <ModeBadge mode={meeting.mode || "agents"} />
                  <span className="ml-auto tabular-nums text-[var(--color-text-tertiary)]">
                    {cast}/{total}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-text-secondary)]">{vote.summary}</div>
                {vote.status === "open" ? (
                  <div className={classNames("mt-1.5 h-1.5 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
                    <span
                      className="block h-full origin-left rounded-full bg-violet-500 transition-transform duration-200"
                      style={{ transform: `scaleX(${total ? cast / total : 0})`, transitionTimingFunction: "var(--knots-ease-out)" }}
                    />
                  </div>
                ) : (
                  <div className="mt-2">
                    <HumanRulingForm vote={vote} meeting={meeting} isDark={isDark} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "meetings" ? <MeetingsTab actors={actors} isDark={isDark} /> : null}
        {tab === "harness" ? <HarnessTab isDark={isDark} /> : null}
        {tab === "log" ? (
          log.length === 0 ? (
            <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("sidebarNoLog")}</div>
          ) : (
            <div className="space-y-1">
              {log
                .slice()
                .reverse()
                .map((entry, index) => (
                  <div key={`${entry.ts}-${index}`} className="text-[11px]">
                    <span className="tabular-nums text-[var(--color-text-tertiary)]">{String(entry.ts).slice(11, 19)} </span>
                    <span className={classNames("rounded px-1 text-[10px] font-medium", entry.kind === "error" ? "bg-rose-500/15 text-rose-600" : "bg-black/5 dark:bg-white/10")}>{entry.kind}</span>{" "}
                    <span className="text-[var(--color-text-secondary)]">{entry.text}</span>
                  </div>
                ))}
            </div>
          )
        ) : null}
      </div>
    </aside>
  );
}
