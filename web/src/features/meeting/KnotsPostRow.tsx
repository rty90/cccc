import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { ModeBadge, StatusPill } from "./MeetingPanel";
import { useMeetingStore, voteNeedsRuling, type Meeting } from "./meetingStore";
import { knotsPostFocus, type KnotsPost } from "./knotsPosts";

const TONE: Record<KnotsPost["kind"], string> = {
  meeting: "border-l-violet-400/70",
  vote: "border-l-violet-400/70",
  decision: "border-l-emerald-400/70",
  project: "border-l-sky-400/70",
  task: "border-l-sky-400/70",
  lesson: "border-l-violet-400/70",
  notice: "border-l-amber-400/70",
  stop: "border-l-rose-400/70",
  retro: "border-l-slate-400/70",
  review: "border-l-sky-400/70",
  help: "border-l-amber-400/70",
};

/**
 * One compact row for a moderator post: the kind and id, the first line (two lines when there is
 * nothing else to show), two lines of summary and, for a meeting, the live facts (status, mode,
 * participants, open votes, rulings waiting). "View" opens the rail on that item; "full text"
 * swaps the row for the ordinary bubble. Sits in the same column as the agents' bubbles.
 */
export function KnotsPostRow({
  post,
  timestamp,
  fullTimestamp,
  isDark,
  isHighlighted,
  onShowRaw,
}: {
  post: KnotsPost;
  timestamp: string;
  fullTimestamp: string;
  isDark: boolean;
  isHighlighted: boolean;
  onShowRaw: () => void;
}) {
  const { t } = useTranslation("chat");
  const meetings = useMeetingStore((state) => state.meetings);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  const focus = knotsPostFocus(post);
  const meeting: Meeting | undefined =
    focus?.kind === "meeting"
      ? meetings.find((item) => item.id === focus.id)
      : focus?.kind === "vote"
        ? meetings.find((item) => item.votes.some((vote) => vote.id === focus.id))
        : undefined;
  const openVotes = meeting ? meeting.votes.filter((vote) => vote.status === "open").length : 0;
  const rulings = meeting ? meeting.votes.filter((vote) => voteNeedsRuling(vote, meeting)).length : 0;
  const label = `${t(`knotsKind_${post.kind}`)}${post.id ? ` #${post.id}` : ""}${post.tag ? ` · ${post.tag.toLowerCase()}` : ""}`;
  const linkClass =
    "knots-press rounded-full px-2 py-0.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.08]";
  return (
    <div
      className={classNames(
        "w-full rounded-xl border border-l-[3px] px-3 py-2",
        TONE[post.kind],
        isDark ? "border-white/10 bg-white/[0.03]" : "border-black/[0.08] bg-black/[0.02]",
        isHighlighted ? "outline outline-2 outline-[var(--glass-accent-border)] outline-offset-2" : "",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={classNames(
              "text-[14px] font-medium leading-5 text-[var(--color-text-primary)]",
              post.summary || meeting ? "truncate" : "line-clamp-2",
            )}
            title={post.title}
          >
            <span
              className={classNames(
                "mr-1.5 inline-flex rounded-full px-1.5 py-0.5 align-[1px] text-[11px] font-semibold leading-none",
                isDark ? "bg-white/10 text-slate-200" : "bg-black/[0.06] text-gray-700",
              )}
            >
              {label}
            </span>
            {post.title}
          </div>
          {meeting ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--color-text-tertiary)]">
              <StatusPill status={meeting.status} />
              <ModeBadge mode={meeting.mode || "agents"} />
              <span>{t("railParticipants", { count: meeting.participants.length })}</span>
              {openVotes > 0 ? <span>· {t("railOpenVotes", { count: openVotes })}</span> : null}
              {rulings > 0 ? (
                <span className="font-medium text-rose-600 dark:text-rose-300">· {t("railRulings", { count: rulings })}</span>
              ) : null}
            </div>
          ) : null}
          {post.summary ? (
            <div className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{post.summary}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-[12px] text-[var(--color-text-tertiary)]">
          <span className="px-1 tabular-nums" title={fullTimestamp}>
            {timestamp}
          </span>
          {focus ? (
            <button type="button" className={linkClass} onClick={() => setSidebar(true, "overview", focus)}>
              {t("popupView")}
            </button>
          ) : null}
          <button type="button" className={linkClass} onClick={onShowRaw}>
            {t("knotsPostRaw")}
          </button>
        </div>
      </div>
    </div>
  );
}
