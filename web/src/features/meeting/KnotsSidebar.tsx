import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Actor, Task } from "../../types";
import { classNames } from "../../utils/classNames";
import { useModalStore } from "../../stores";
import { HumanRulingForm } from "./HumanRuling";
import { VoteDetails } from "./VoteDetails";
import { HelpTicketCard } from "./HelpTicketCard";
import { HarnessTab, MeetingCard, MeetingsTab, ModeBadge, StatusPill } from "./MeetingPanel";
import { ProjectCard, ProjectsTab } from "./ProjectsPanel";
import { LessonCard } from "./LessonCard";
import {
  moderatorPost,
  useMeetingStore,
  voteNeedsRuling,
  type HarnessUpdate,
  type Meeting,
  type Project,
  type RailFocus,
  type SidebarTab,
  type Vote,
} from "./meetingStore";

/**
 * The right rail: what to look at now. By default three sections — the current goal, what is in
 * progress, what needs the human — as one-line rows that open a detail view (the list keeps its
 * scroll position). The full meeting and project lists, the rules with the update cards, and the
 * moderator log sit behind the footer nav. Docked beside the chat from xl up, a drawer below.
 */
const isOpenProject = (project: Project) => project.status !== "adopted" && project.status !== "rejected" && project.status !== "stopped";
const isOpenMeeting = (meeting: Meeting) => meeting.status !== "closed";
const isPendingUpdate = (update: HarnessUpdate) => update.status === "available" || update.status === "updating" || update.status === "failed";

type Tone = "rose" | "violet" | "amber" | "sky" | "slate";

function toneClass(tone: Tone): string {
  switch (tone) {
    case "rose":
      return "bg-rose-500/[0.12] text-rose-700 dark:text-rose-300";
    case "amber":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "sky":
      return "bg-sky-500/[0.12] text-sky-700 dark:text-sky-300";
    case "violet":
      return "bg-violet-500/[0.12] text-violet-700 dark:text-violet-300";
    default:
      return "bg-black/[0.06] text-[var(--color-text-secondary)] dark:bg-white/10";
  }
}

export function KnotsSidebarToggle({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation("chat");
  const connect = useMeetingStore((state) => state.connect);
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const lessons = useMeetingStore((state) => state.lessons);
  const help = useMeetingStore((state) => state.help);
  const updates = useMeetingStore((state) => state.updates);
  const connected = useMeetingStore((state) => state.connected);
  const open = useMeetingStore((state) => state.ui.sidebarOpen);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  useEffect(() => {
    connect();
  }, [connect]);
  const active = meetings.filter(isOpenMeeting).length + projects.filter(isOpenProject).length;
  const pending =
    meetings.flatMap((meeting) => meeting.votes.filter((vote) => voteNeedsRuling(vote, meeting))).length +
    help.filter((ticket) => ticket.status !== "resolved").length +
    projects.filter((project) => project.status === "awaiting_human").length +
    lessons.filter((lesson) => lesson.status === "candidate").length +
    Object.values(updates || {}).filter((update) => update.status === "available" || update.status === "failed").length;
  return (
    <button
      type="button"
      onClick={() => setSidebar(!open)}
      aria-pressed={open}
      title={connected ? t("railTitle") : t("meetingOffline")}
      className={classNames(
        "knots-press inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
        isDark ? "border-white/10 text-slate-200" : "border-black/10 text-gray-700",
        open ? (isDark ? "bg-white/[0.08] text-white" : "bg-black/[0.06] text-[rgb(35,36,37)]") : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
      )}
    >
      <span className={classNames("h-1.5 w-1.5 shrink-0 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
      {t("railTitle")}
      {pending > 0 ? (
        <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">{pending}</span>
      ) : active > 0 ? (
        <span className="rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold text-white">{active}</span>
      ) : null}
    </button>
  );
}

/** Compact row: one line of title, two of summary. The detail opens on click; the list keeps its place. */
function RailRow({
  label,
  tone = "slate",
  title,
  summary,
  meta,
  onClick,
}: {
  label?: string;
  tone?: Tone;
  title: string;
  summary?: string;
  meta?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        {label ? <span className={classNames("shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", toneClass(tone))}>{label}</span> : null}
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-5 text-[var(--color-text-primary)]">{title}</span>
        {meta ? <span className="shrink-0 text-[12px] tabular-nums text-[var(--color-text-tertiary)]">{meta}</span> : null}
        {onClick ? (
          <span className="shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true">
            ›
          </span>
        ) : null}
      </div>
      {summary ? <div className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{summary}</div> : null}
    </>
  );
  if (!onClick) return <div className="block w-full rounded-xl px-2.5 py-2 text-left">{content}</div>;
  return (
    <button type="button" onClick={onClick} className="knots-press block w-full rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
      {content}
    </button>
  );
}

function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 px-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
      {children}
      {count ? <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold normal-case tracking-normal text-white">{count}</span> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-2.5 text-[13px] leading-5 text-[var(--color-text-tertiary)]">{children}</div>;
}

function UpdateCard({ update, isDark }: { update: HarnessUpdate; isDark: boolean }) {
  const { t } = useTranslation("chat");
  return (
    <div className={classNames("rounded-xl border px-3 py-2 text-[13px]", isDark ? "border-sky-400/20 bg-sky-500/[0.08]" : "border-sky-200 bg-sky-50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{t("updateAvailable", { runtime: update.runtime, current: update.current, latest: update.latest })}</span>
        <span className="text-[12px] text-[var(--color-text-tertiary)]">{(update.actors || []).join(", ")}</span>
      </div>
      {update.status === "updating" ? (
        <div className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
          {t("updateWorking")} {update.log || ""}
        </div>
      ) : update.status === "failed" ? (
        <div className="mt-1 text-[12px] text-rose-500">{update.log || t("updateFailed")}</div>
      ) : (
        <div className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">{t("updateHint")}</div>
      )}
      {update.status !== "updating" ? (
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" className="knots-press rounded-full bg-violet-600 px-3 py-1 text-[12px] font-semibold text-white" onClick={() => void moderatorPost(`/api/updates/${update.runtime}/apply`, {})}>
            {t("updateApply")}
          </button>
          <button type="button" className="knots-press rounded-full px-3 py-1 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10" onClick={() => void moderatorPost(`/api/updates/${update.runtime}/ignore`, {})}>
            {t("updateIgnore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A vote as the human sees it: tally progress while open, the ruling form once closed. */
function VoteRailCard({ meeting, vote, isDark }: { meeting: Meeting; vote: Vote; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const cast = Object.keys(vote.ballots).length;
  const total = meeting.participants.length;
  const needsRuling = voteNeedsRuling(vote, meeting);
  return (
    <div className={classNames("rounded-xl border p-2.5", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/[0.08] bg-black/[0.02]")}>
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="font-semibold">
          #{meeting.id} · {t("voteCard")} #{vote.id}
        </span>
        <StatusPill status={vote.status} />
        <ModeBadge mode={meeting.mode || "agents"} />
        <span className="ml-auto tabular-nums text-[var(--color-text-tertiary)]">
          {cast}/{total}
        </span>
      </div>
      <div className="mt-1 text-[13px] font-medium">{meeting.topic}</div>
      <VoteDetails vote={vote} meeting={meeting} isDark={isDark} />
      {vote.status === "open" ? (
        <div className={classNames("mt-2 h-1.5 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
          <span
            className="block h-full origin-left rounded-full bg-violet-500 transition-transform duration-200"
            style={{ transform: `scaleX(${total ? cast / total : 0})`, transitionTimingFunction: "var(--knots-ease-out)" }}
          />
        </div>
      ) : needsRuling ? (
        <div className="mt-2">
          <HumanRulingForm vote={vote} meeting={meeting} isDark={isDark} />
        </div>
      ) : vote.human ? (
        <div className="mt-2 rounded-lg bg-violet-500/10 px-2 py-1 text-[13px]">
          <span className="font-semibold">{t("voteHumanDecided", { option: vote.human.option })}</span>
          {vote.human.reason ? <span className="text-[var(--color-text-secondary)]"> — {vote.human.reason}</span> : null}
        </div>
      ) : vote.result ? (
        <div className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
          {vote.result.tie ? t("voteTie") : vote.result.winner ? t("voteWinner", { option: vote.result.winner }) : ""}
        </div>
      ) : null}
    </div>
  );
}

type NeedItem = { key: string; focus: RailFocus; label: string; tone: Tone; title: string; summary: string; meta?: string };

function Overview({ taskById, onFocus }: { taskById?: Map<string, Task>; onFocus: (focus: RailFocus) => void }) {
  const { t } = useTranslation("chat");
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const lessons = useMeetingStore((state) => state.lessons);
  const help = useMeetingStore((state) => state.help);
  const updates = useMeetingStore((state) => state.updates);
  const openContextTask = useModalStore((state) => state.openContextTask);

  const goalProject = projects.slice().reverse().find(isOpenProject);
  const goalMeeting = goalProject ? undefined : meetings.slice().reverse().find(isOpenMeeting);

  const needs = useMemo<NeedItem[]>(() => {
    const items: NeedItem[] = [];
    for (const ticket of help.filter((item) => item.status !== "resolved")) {
      items.push({
        key: `help:${ticket.id}`,
        focus: { kind: "help", id: ticket.id },
        label: t("helpTicket"),
        tone: ticket.need === "permission" ? "rose" : "amber",
        title: `${ticket.by} · ${t(`helpNeed_${ticket.need}`)}`,
        summary: ticket.text,
      });
    }
    for (const project of projects.filter((item) => item.status === "awaiting_human")) {
      const suggestion = project.suggestion ? t("projectSuggestion", { verdict: t(`projectVerdict_${project.suggestion}`) }) : "";
      const summary = project.proposal?.summary || "";
      items.push({
        key: `project:${project.id}`,
        focus: { kind: "project", id: project.id },
        label: t("projectStatus_awaiting_human"),
        tone: "rose",
        title: project.title,
        summary: [suggestion, summary].filter(Boolean).join(" · "),
        meta: project.round > 1 ? t("projectRound", { n: project.round }) : undefined,
      });
    }
    for (const meeting of meetings) {
      for (const vote of meeting.votes) {
        if (!voteNeedsRuling(vote, meeting)) continue;
        items.push({
          key: `vote:${vote.id}`,
          focus: { kind: "vote", id: vote.id },
          label: `${t("voteCard")} #${vote.id}`,
          tone: "violet",
          title: meeting.topic,
          summary: vote.summary,
          meta: `${Object.keys(vote.ballots).length}/${meeting.participants.length}`,
        });
      }
    }
    for (const lesson of lessons.filter((item) => item.status === "candidate")) {
      items.push({
        key: `lesson:${lesson.id}`,
        focus: { kind: "lesson", id: lesson.id },
        label: t("lessonCandidate"),
        tone: "violet",
        title: lesson.principle,
        summary: lesson.why || "",
        meta: lesson.by,
      });
    }
    for (const update of Object.values(updates || {}).filter(isPendingUpdate)) {
      items.push({
        key: `update:${update.runtime}`,
        focus: { kind: "update", id: update.runtime },
        label: update.status === "failed" ? t("updateFailed") : update.status === "updating" ? t("updateWorking") : t("railUpdate"),
        tone: update.status === "failed" ? "rose" : "sky",
        title: t("updateAvailable", { runtime: update.runtime, current: update.current, latest: update.latest }),
        summary: update.log || "",
      });
    }
    return items;
  }, [help, lessons, meetings, projects, t, updates]);

  const activeTasks = useMemo(() => {
    const tasks = taskById ? Array.from(taskById.values()) : [];
    return tasks
      .filter((task) => String(task.status || "") === "active")
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
      .slice(0, 6);
  }, [taskById]);

  const runningMeetings = meetings.filter((meeting) => isOpenMeeting(meeting) && meeting.id !== goalMeeting?.id);
  const runningProjects = projects.filter((project) => isOpenProject(project) && project.id !== goalProject?.id);
  const hasProgress = runningMeetings.length > 0 || runningProjects.length > 0 || activeTasks.length > 0;

  const meetingSummary = (meeting: Meeting): string => {
    const openVotes = meeting.votes.filter((vote) => vote.status === "open").length;
    const rulings = meeting.votes.filter((vote) => voteNeedsRuling(vote, meeting)).length;
    return [
      t("railParticipants", { count: meeting.participants.length }),
      openVotes ? t("railOpenVotes", { count: openVotes }) : "",
      rulings ? t("railRulings", { count: rulings }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const projectSummary = (project: Project): string => {
    const roles = project.roles || { proposer: "", blue: [], red: [], reviewers: [] };
    const waiting =
      project.status === "proposing" || project.status === "revising"
        ? [roles.proposer]
        : project.status === "debating"
          ? [...roles.blue.filter((actor) => !project.pros.some((entry) => entry.by === actor)), ...roles.red.filter((actor) => !project.cons.some((entry) => entry.by === actor))]
          : project.status === "reviewing"
            ? roles.reviewers.filter((actor) => !project.reviews.some((review) => review.by === actor))
            : [];
    return waiting.length ? t("projectWaiting", { actors: waiting.join(", ") }) : project.proposal?.summary || project.brief || "";
  };

  return (
    <div className="space-y-4 py-1">
      <section>
        <SectionTitle>{t("railGoal")}</SectionTitle>
        {goalProject ? (
          <RailRow
            label={t(`projectStatus_${goalProject.status}`)}
            tone={goalProject.status === "awaiting_human" ? "rose" : "sky"}
            title={goalProject.title}
            summary={goalProject.brief || goalProject.proposal?.summary || projectSummary(goalProject)}
            meta={goalProject.round > 1 ? t("projectRound", { n: goalProject.round }) : undefined}
            onClick={() => onFocus({ kind: "project", id: goalProject.id })}
          />
        ) : goalMeeting ? (
          <RailRow
            label={t(`meetingStatus_${goalMeeting.status}`)}
            tone="violet"
            title={goalMeeting.topic}
            summary={goalMeeting.brief || meetingSummary(goalMeeting)}
            onClick={() => onFocus({ kind: "meeting", id: goalMeeting.id })}
          />
        ) : (
          <Empty>{t("railGoalEmpty")}</Empty>
        )}
      </section>

      <section>
        <SectionTitle>{t("railInProgress")}</SectionTitle>
        {hasProgress ? (
          <div className="space-y-0.5">
            {runningProjects.map((project) => (
              <RailRow
                key={`project:${project.id}`}
                label={t(`projectStatus_${project.status}`)}
                tone={project.status === "awaiting_human" ? "rose" : "sky"}
                title={project.title}
                summary={projectSummary(project)}
                onClick={() => onFocus({ kind: "project", id: project.id })}
              />
            ))}
            {runningMeetings.map((meeting) => (
              <RailRow
                key={`meeting:${meeting.id}`}
                label={t(`meetingStatus_${meeting.status}`)}
                tone="violet"
                title={meeting.topic}
                summary={meetingSummary(meeting)}
                onClick={() => onFocus({ kind: "meeting", id: meeting.id })}
              />
            ))}
            {activeTasks.map((task) => (
              <RailRow
                key={`task:${task.id}`}
                label={t("railTask")}
                tone="slate"
                title={String(task.title || task.id)}
                summary={[task.assignee ? t("railAssignee", { name: task.assignee }) : "", String(task.current_step || task.outcome || "")].filter(Boolean).join(" · ")}
                meta={typeof task.progress === "number" ? `${Math.round(task.progress * (task.progress <= 1 ? 100 : 1))}%` : undefined}
                onClick={() => openContextTask(task.id)}
              />
            ))}
          </div>
        ) : (
          <Empty>{t("railNothingInProgress")}</Empty>
        )}
      </section>

      <section>
        <SectionTitle count={needs.length}>{t("railNeedsYou")}</SectionTitle>
        {needs.length ? (
          <div className="space-y-0.5">
            {needs.map((item) => (
              <RailRow key={item.key} label={item.label} tone={item.tone} title={item.title} summary={item.summary} meta={item.meta} onClick={() => onFocus(item.focus)} />
            ))}
          </div>
        ) : (
          <Empty>{t("railNothingForYou")}</Empty>
        )}
      </section>
    </div>
  );
}

function DetailView({ focus, actors, isDark }: { focus: RailFocus; actors: Actor[]; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const lessons = useMeetingStore((state) => state.lessons);
  const help = useMeetingStore((state) => state.help);
  const updates = useMeetingStore((state) => state.updates);
  const actorIds = actors.map((actor) => String(actor.id || "")).filter(Boolean);
  const gone = <Empty>{t("railGone")}</Empty>;
  switch (focus.kind) {
    case "meeting": {
      const meeting = meetings.find((item) => item.id === focus.id);
      return meeting ? <MeetingCard meeting={meeting} isDark={isDark} /> : gone;
    }
    case "vote": {
      const meeting = meetings.find((item) => item.votes.some((vote) => vote.id === focus.id));
      const vote = meeting?.votes.find((item) => item.id === focus.id);
      return meeting && vote ? <VoteRailCard meeting={meeting} vote={vote} isDark={isDark} /> : gone;
    }
    case "help": {
      const ticket = help.find((item) => item.id === focus.id);
      return ticket ? <HelpTicketCard ticket={ticket} actorIds={actorIds} isDark={isDark} /> : gone;
    }
    case "project": {
      const project = projects.find((item) => item.id === focus.id);
      return project ? <ProjectCard project={project} isDark={isDark} /> : gone;
    }
    case "lesson": {
      const lesson = lessons.find((item) => item.id === focus.id);
      return lesson ? <LessonCard lesson={lesson} isDark={isDark} /> : gone;
    }
    case "update": {
      const update = updates?.[focus.id];
      return update ? <UpdateCard update={update} isDark={isDark} /> : gone;
    }
    default:
      return gone;
  }
}

function RailNav({ tab, onSelect }: { tab: SidebarTab; onSelect: (tab: SidebarTab) => void }) {
  const { t } = useTranslation("chat");
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const harness = useMeetingStore((state) => state.harness);
  const updates = useMeetingStore((state) => state.updates);
  const activeMeetings = meetings.filter(isOpenMeeting).length;
  const openProjects = projects.filter(isOpenProject).length;
  const pendingUpdates = Object.values(updates || {}).filter(isPendingUpdate).length;
  const items: Array<[SidebarTab, string]> = [
    ["overview", t("railOverview")],
    ["meetings", `${t("sidebarTabMeetings")}${activeMeetings ? ` ${activeMeetings}` : ""}`],
    ["projects", `${t("sidebarTabProjects")}${openProjects ? ` ${openProjects}` : ""}`],
    ["harness", `${t("sidebarTabHarness")} v${harness?.version ?? "?"}${pendingUpdates ? ` · ${pendingUpdates}` : ""}`],
    ["log", t("sidebarTabLog")],
  ];
  return (
    <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-[var(--glass-border-subtle)] px-1.5 py-1 scrollbar-hide" role="tablist">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onSelect(key)}
          className={classNames(
            "knots-press shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium",
            tab === key ? "bg-[var(--color-text-primary)] text-[var(--color-bg-primary,#fff)]" : "text-[var(--color-text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function focusExists(focus: RailFocus, state: { meetings: Meeting[]; projects: Project[]; lessons: { id: string }[]; help: { id: string }[]; updates: Record<string, HarnessUpdate> }): boolean {
  switch (focus.kind) {
    case "meeting":
      return state.meetings.some((item) => item.id === focus.id);
    case "vote":
      return state.meetings.some((item) => item.votes.some((vote) => vote.id === focus.id));
    case "help":
      return state.help.some((item) => item.id === focus.id);
    case "project":
      return state.projects.some((item) => item.id === focus.id);
    case "lesson":
      return state.lessons.some((item) => item.id === focus.id);
    case "update":
      return Boolean(state.updates?.[focus.id]);
    default:
      return false;
  }
}

export function KnotsSidebar({ actors, isDark, taskById }: { actors: Actor[]; isDark: boolean; taskById?: Map<string, Task> }) {
  const { t } = useTranslation("chat");
  const connect = useMeetingStore((state) => state.connect);
  const open = useMeetingStore((state) => state.ui.sidebarOpen);
  const tab = useMeetingStore((state) => state.ui.tab);
  const focus = useMeetingStore((state) => state.ui.focus);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  const setFocus = useMeetingStore((state) => state.setFocus);
  const meetings = useMeetingStore((state) => state.meetings);
  const projects = useMeetingStore((state) => state.projects);
  const lessons = useMeetingStore((state) => state.lessons);
  const help = useMeetingStore((state) => state.help);
  const updates = useMeetingStore((state) => state.updates);
  const log = useMeetingStore((state) => state.log);
  const authRequired = useMeetingStore((state) => state.authRequired);
  const setModeratorToken = useMeetingStore((state) => state.setModeratorToken);
  const [tokenDraft, setTokenDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTop = useRef(0);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (focus) setFocus(null);
      else if (window.innerWidth < 1280) setSidebar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, open, setFocus, setSidebar]);

  // A ruled vote, a kept lesson or a resolved ticket leaves the lists; the detail follows it out.
  const present = focus ? focusExists(focus, { meetings, projects, lessons, help, updates }) : true;
  useEffect(() => {
    if (focus && !present) setFocus(null);
  }, [focus, present, setFocus]);

  // Back to the list lands where the reader left it.
  useLayoutEffect(() => {
    if (focus || !bodyRef.current) return;
    bodyRef.current.scrollTop = savedScrollTop.current;
  }, [focus]);

  const openFocus = (next: RailFocus) => {
    savedScrollTop.current = bodyRef.current?.scrollTop || 0;
    setFocus(next);
  };

  if (!open) return null;

  const pendingUpdates = Object.values(updates || {}).filter(isPendingUpdate);
  const title = focus
    ? `${t(focus.kind === "vote" ? "voteCard" : focus.kind === "help" ? "helpTicket" : focus.kind === "lesson" ? "knotsKind_lesson" : focus.kind === "update" ? "railUpdate" : `knotsKind_${focus.kind}`)}${focus.kind === "update" ? ` · ${focus.id}` : ` #${focus.id}`}`
    : tab === "overview"
      ? t("railTitle")
      : tab === "meetings"
        ? t("sidebarTabMeetings")
        : tab === "projects"
          ? t("sidebarTabProjects")
          : tab === "harness"
            ? t("railRules")
            : t("sidebarTabLog");
  const canGoBack = Boolean(focus) || tab !== "overview";

  return (
    <aside
      aria-label={t("railTitle")}
      className={classNames(
        "fixed inset-y-0 right-0 z-[900] flex w-[min(92vw,380px)] flex-col border-l shadow-2xl",
        "xl:static xl:inset-auto xl:z-auto xl:w-[360px] xl:min-h-0 xl:flex-shrink-0 xl:shadow-none", // docked only when the chat keeps ~600px
        "bg-[var(--color-bg-secondary)]",
        isDark ? "border-white/8" : "border-black/8",
      )}
    >
      <div className={classNames("flex h-11 shrink-0 items-center gap-1 border-b px-2", isDark ? "border-white/8" : "border-black/8")}>
        {canGoBack ? (
          <button
            type="button"
            className="knots-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.08]"
            aria-label={t("railBack")}
            title={t("railBack")}
            onClick={() => (focus ? setFocus(null) : setSidebar(true, "overview"))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : null}
        <div className="min-w-0 flex-1 truncate px-1 text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</div>
        <button
          type="button"
          className="knots-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-tertiary)] hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.08]"
          aria-label={t("sidebarClose")}
          title={t("sidebarClose")}
          onClick={() => setSidebar(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {authRequired ? (
        <div className={classNames("flex items-center gap-1.5 border-b px-2 py-1.5", isDark ? "border-white/8 bg-amber-500/8" : "border-black/8 bg-amber-50")} title={t("knotsTokenHint")}>
          <span className="shrink-0 text-[12px] text-amber-600 dark:text-amber-300" aria-hidden="true">
            ●
          </span>
          <input
            type="password"
            className={classNames("min-w-0 flex-1 rounded-lg border px-2 py-1 text-[13px] outline-none", isDark ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-white text-gray-800")}
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && tokenDraft.trim()) setModeratorToken(tokenDraft);
            }}
            placeholder={t("knotsTokenLabel") + " · ~/.knots/moderator.token"}
            aria-label={t("knotsTokenLabel")}
          />
          <button type="button" className="knots-press shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-violet-600 hover:bg-violet-500/10 disabled:opacity-40 dark:text-violet-300" disabled={!tokenDraft.trim()} onClick={() => setModeratorToken(tokenDraft)}>
            {t("knotsTokenSave")}
          </button>
        </div>
      ) : null}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {focus ? (
          <DetailView focus={focus} actors={actors} isDark={isDark} />
        ) : tab === "overview" ? (
          <Overview taskById={taskById} onFocus={openFocus} />
        ) : tab === "meetings" ? (
          <MeetingsTab actors={actors} isDark={isDark} />
        ) : tab === "projects" ? (
          <ProjectsTab isDark={isDark} />
        ) : tab === "harness" ? (
          <div className="space-y-3">
            {pendingUpdates.length > 0 ? (
              <div className="space-y-1.5">
                {pendingUpdates.map((update) => (
                  <UpdateCard key={update.runtime} update={update} isDark={isDark} />
                ))}
              </div>
            ) : null}
            <HarnessTab isDark={isDark} />
          </div>
        ) : log.length === 0 ? (
          <Empty>{t("sidebarNoLog")}</Empty>
        ) : (
          <div className="space-y-1">
            {log
              .slice()
              .reverse()
              .map((entry, index) => (
                <div key={`${entry.ts}-${index}`} className="text-[13px] leading-5">
                  <span className="tabular-nums text-[var(--color-text-tertiary)]">{String(entry.ts).slice(11, 19)} </span>
                  <span className={classNames("rounded px-1 text-[11px] font-medium", entry.kind === "error" ? "bg-rose-500/15 text-rose-600" : "bg-black/5 dark:bg-white/10")}>{entry.kind}</span>{" "}
                  <span className="text-[var(--color-text-secondary)]">{entry.text}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      <RailNav tab={tab} onSelect={(next) => setSidebar(true, next, null)} />
    </aside>
  );
}
