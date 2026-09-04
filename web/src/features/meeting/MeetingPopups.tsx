import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { classNames } from "../../utils/classNames";
import { HumanRulingForm } from "./HumanRuling";
import { VoteDetails } from "./VoteDetails";
import { HelpTicketCard } from "./HelpTicketCard";
import type { Actor } from "../../types";
import { MeetingCard, ModeBadge, ROLE_TONE } from "./MeetingPanel";
import { useMeetingStore, voteCounts, type Meeting, type Notice, type NoticeKind, type Vote } from "./meetingStore";

/**
 * Popups for the human moderator: a meeting called by an agent, a vote card, a tally, a ruling the human
 * has to make. Non-modal toasts (bottom-right, newest at the bottom) that expand into a modal card.
 * Motion: transitions only (interruptible), transform + opacity, strong ease-out, enter 220 ms / exit 160 ms,
 * reduced-motion keeps the fade and drops the movement. Timers pause while the stack is hovered.
 */
const AUTO_DISMISS_MS: Record<NoticeKind, number | null> = {
  opened: 15000,
  vote_opened: null,
  vote_closed: 15000,
  needs_human: null,
  human_decided: 10000,
  closed: 12000,
  escalated: 12000,
  help: null,
};
const MAX_VISIBLE = 3;

function TallyBars({ vote, total, isDark }: { vote: Vote; total: number; isDark: boolean }) {
  const counts = voteCounts(vote);
  return (
    <div className="mt-1.5 space-y-1">
      {vote.options.map((option) => {
        const value = counts[option] || 0;
        const ratio = total > 0 ? value / total : 0;
        const winner = (vote.human?.option || vote.result?.winner) === option;
        return (
          <div key={option} className="flex items-center gap-2 text-[11px]">
            <span className={classNames("w-16 shrink-0 truncate", winner ? "font-semibold" : "")}>{option}</span>
            <span className={classNames("h-1.5 flex-1 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
              <span
                className={classNames("block h-full origin-left rounded-full transition-transform duration-200", winner ? "bg-violet-500" : "bg-sky-500/70")}
                style={{ transform: `scaleX(${ratio})`, transitionTimingFunction: "var(--knots-ease-out)" }}
              />
            </span>
            <span className="w-4 text-right tabular-nums">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function Toast({
  notice,
  meeting,
  vote,
  isDark,
  hovered,
  onDismiss,
  onView,
}: {
  notice: Notice;
  meeting: Meeting;
  vote?: Vote;
  isDark: boolean;
  hovered: boolean;
  onDismiss: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation("chat");
  const [phase, setPhase] = useState<"entering" | "open" | "closing">("entering");
  const closingRef = useRef(false);
  const expiresAt = useRef<number | null>(AUTO_DISMISS_MS[notice.kind] ? Date.now() + (AUTO_DISMISS_MS[notice.kind] as number) : null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPhase("open"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("closing");
    window.setTimeout(onDismiss, 170);
  };

  useEffect(() => {
    if (expiresAt.current == null) return undefined;
    const timer = window.setInterval(() => {
      if (expiresAt.current == null) return;
      if (hovered) {
        expiresAt.current = Math.max(expiresAt.current, Date.now() + 1500);
        return;
      }
      if (Date.now() >= expiresAt.current) close();
    }, 400);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered]);

  const total = meeting.participants.length;
  const cast = vote ? Object.keys(vote.ballots).length : 0;
  const harness = meeting.kind === "harness";
  const accent = notice.kind === "needs_human" ? "border-violet-500/50" : harness ? "border-fuchsia-400/40" : isDark ? "border-white/10" : "border-black/10";

  let title = "";
  switch (notice.kind) {
    case "opened":
      title = harness ? t("popupProposalOpened", { id: meeting.id }) : t("popupMeetingOpened", { id: meeting.id });
      break;
    case "vote_opened":
      title = `${t("popupVoteOpened", { id: vote?.id || "" })} · ${cast}/${total}`;
      break;
    case "vote_closed":
      title = t("popupVoteClosed", { id: vote?.id || "" });
      break;
    case "needs_human":
      title = t("popupHumanNeeded", { id: vote?.id || "" });
      break;
    case "human_decided":
      title = t("popupHumanDecided", { option: vote?.human?.option || "" });
      break;
    case "closed":
      title = t("popupMeetingClosed", { id: meeting.id });
      break;
    case "escalated":
      title = t("popupEscalated", { id: meeting.id });
      break;
    default:
      title = meeting.topic;
  }

  return (
    <div
      role="status"
      data-state={phase}
      className={classNames(
        "knots-toast pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur",
        accent,
        isDark ? "bg-slate-950/90 text-slate-100" : "bg-white/95 text-gray-800",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold">{title}</span>
            <ModeBadge mode={meeting.mode || "agents"} />
          </div>
          {notice.kind === "opened" ? (
            <>
              {meeting.requested_by ? (
                <div className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{t("meetingRequestedBy", { by: meeting.requested_by })}</div>
              ) : null}
              <div className="mt-1 line-clamp-3 text-[12px]">{meeting.topic}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {meeting.participants.map((actor) => (
                  <span key={actor} className={classNames("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", ROLE_TONE[meeting.roles[actor]] || "bg-slate-500/15")}>
                    <span className="font-semibold">{actor}</span>
                    <span className="opacity-70">{meeting.roles[actor]}</span>
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {notice.kind === "vote_opened" && vote ? (
            <>
              <VoteDetails vote={vote} meeting={meeting} isDark={isDark} />
              <div className={classNames("mt-1.5 h-1.5 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
                <span
                  className="block h-full origin-left rounded-full bg-violet-500 transition-transform duration-200"
                  style={{ transform: `scaleX(${total ? cast / total : 0})`, transitionTimingFunction: "var(--knots-ease-out)" }}
                />
              </div>
            </>
          ) : null}
          {(notice.kind === "vote_closed" || notice.kind === "needs_human") && vote ? (
            <>
              <VoteDetails vote={vote} meeting={meeting} isDark={isDark} />
              <TallyBars vote={vote} total={total} isDark={isDark} />
              {notice.kind === "needs_human" && !vote.human ? (
                <div className="mt-2">
                  <HumanRulingForm vote={vote} meeting={meeting} isDark={isDark} onDone={close} />
                </div>
              ) : null}
              {vote.result?.tie && notice.kind === "vote_closed" ? <div className="mt-1 text-[11px]">{t("voteTie")}</div> : null}
            </>
          ) : null}
          {notice.kind === "human_decided" && vote?.human?.reason ? (
            <div className="mt-1 line-clamp-3 text-[12px] text-[var(--color-text-secondary)]">{vote.human.reason}</div>
          ) : null}
          {notice.kind === "closed" ? (
            <div className="mt-1 line-clamp-3 text-[12px] text-[var(--color-text-secondary)]">{meeting.decision || meeting.topic}</div>
          ) : null}
          {notice.kind === "escalated" && meeting.escalations?.length ? (
            <div className="mt-1 line-clamp-2 text-[12px] text-[var(--color-text-secondary)]">{meeting.escalations[meeting.escalations.length - 1]}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="knots-press -mr-1 -mt-1 rounded-full p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          aria-label={t("popupDismiss")}
          onClick={close}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="knots-press rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] px-2.5 py-0.5 text-[11px] font-medium" onClick={onView}>
          {t("popupView")}
        </button>
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">{String(meeting.created_at).slice(11, 16)}</span>
      </div>
    </div>
  );
}

export function MeetingPopups({ isDark, actors }: { isDark: boolean; actors?: Actor[] }) {
  const { t } = useTranslation("chat");
  const connect = useMeetingStore((state) => state.connect);
  const meetings = useMeetingStore((state) => state.meetings);
  const notices = useMeetingStore((state) => state.notices);
  const dismissNotice = useMeetingStore((state) => state.dismissNotice);
  const help = useMeetingStore((state) => state.help);
  const actorIds = (actors || []).map((actor) => String(actor.id || "")).filter(Boolean);
  const sidebarOpen = useMeetingStore((state) => state.ui.sidebarOpen);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  const byId = useMemo(() => new Map(meetings.map((meeting) => [meeting.id, meeting])), [meetings]);
  const ordered = notices.slice().sort((a, b) => a.ts - b.ts);
  const visible = expanded ? ordered : ordered.slice(-MAX_VISIBLE);
  const hidden = ordered.length - visible.length;
  const viewing = viewId ? byId.get(viewId) : undefined;

  useEffect(() => {
    if (!hidden) setExpanded(false);
  }, [hidden]);

  if (typeof document === "undefined" || sidebarOpen) return null;
  return createPortal(
    <>
      <div
        className="pointer-events-none fixed bottom-24 right-4 z-[950] flex w-[360px] max-w-[92vw] flex-col gap-2 sm:right-5"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hidden > 0 ? (
          <button
            type="button"
            className={classNames(
              "knots-press pointer-events-auto self-end rounded-full border px-2.5 py-1 text-[11px] shadow backdrop-blur",
              isDark ? "border-white/10 bg-slate-950/85 text-slate-200" : "border-black/8 bg-white/95 text-gray-700",
            )}
            onClick={() => setExpanded(true)}
          >
            {t("popupMore", { count: hidden })}
          </button>
        ) : expanded && ordered.length > MAX_VISIBLE ? (
          <button
            type="button"
            className={classNames(
              "knots-press pointer-events-auto self-end rounded-full border px-2.5 py-1 text-[11px] shadow backdrop-blur",
              isDark ? "border-white/10 bg-slate-950/85 text-slate-200" : "border-black/8 bg-white/95 text-gray-700",
            )}
            onClick={() => setExpanded(false)}
          >
            {t("popupCollapse")}
          </button>
        ) : null}
        {visible.map((notice) => {
          if (notice.kind === "help") {
            const ticket = help.find((item) => item.id === notice.helpId);
            if (!ticket) return null;
            return (
              <div key={notice.id} className={classNames("knots-toast pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur border-amber-400/50", isDark ? "bg-slate-950/90 text-slate-100" : "bg-white/95 text-gray-800")} data-state="open" role="status">
                <HelpTicketCard ticket={ticket} actorIds={actorIds} isDark={isDark} compact />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" className="knots-press rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] px-2.5 py-0.5 text-[11px] font-medium" onClick={() => dismissNotice(notice.id)}>
                    {t("popupDismiss")}
                  </button>
                </div>
              </div>
            );
          }
          const meeting = byId.get(notice.meetingId);
          if (!meeting) return null;
          const vote = notice.voteId ? meeting.votes.find((item) => item.id === notice.voteId) : undefined;
          return (
            <Toast
              key={notice.id}
              notice={notice}
              meeting={meeting}
              vote={vote}
              isDark={isDark}
              hovered={hovered}
              onDismiss={() => dismissNotice(notice.id)}
              onView={() => setViewId(meeting.id)}
            />
          );
        })}
      </div>
      <Dialog open={!!viewing} onOpenChange={(open) => (!open ? setViewId(null) : undefined)}>
        {viewing ? (
          <DialogContent className="w-[min(calc(100vw-1rem),34rem)] p-4" aria-describedby={undefined}>
            <DialogTitle className="pr-8 text-[14px]">
              #{viewing.id} · {viewing.topic}
            </DialogTitle>
            <DialogDescription className="sr-only">{viewing.topic}</DialogDescription>
            <div className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
              <MeetingCard meeting={viewing} isDark={isDark} />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>,
    document.body,
  );
}
