import { useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { ROLE_TONE } from "./MeetingPanel";
import type { Meeting, Vote } from "./meetingStore";

/**
 * Everything the human needs to rule on a vote, in the card itself: the full summary (unfolds
 * past three lines), the proposal text or meeting background, and every ballot with its reason
 * (visible to the human only; peers never get these). Shared by the toast and the sidebar strip.
 */
export function VoteDetails({ vote, meeting, isDark }: { vote: Vote; meeting: Meeting; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [full, setFull] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showBallots, setShowBallots] = useState(false);
  const summary = String(vote.summary || "");
  const long = summary.length > 150 || summary.split("\n").length > 3;
  const ballotCount = Object.keys(vote.ballots || {}).length;
  const briefLabel = meeting.kind === "harness" ? t("harnessProposalBodyLabel") : t("meetingBriefLabel");
  const linkClass = "knots-press rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]";
  return (
    <div className="mt-1 text-[12px]">
      <div className={classNames("whitespace-pre-wrap text-[var(--color-text-secondary)]", full ? "" : "line-clamp-3")}>{summary}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {long ? (
          <button type="button" className={linkClass} onClick={() => setFull((value) => !value)} aria-expanded={full}>
            {full ? t("detailsLess") : t("detailsMore")}
          </button>
        ) : null}
        {meeting.brief ? (
          <button type="button" className={linkClass} onClick={() => setShowBrief((value) => !value)} aria-expanded={showBrief}>
            {showBrief ? t("detailsHide", { what: briefLabel }) : briefLabel}
          </button>
        ) : null}
        {ballotCount > 0 ? (
          <button type="button" className={linkClass} onClick={() => setShowBallots((value) => !value)} aria-expanded={showBallots}>
            {showBallots ? t("voteHideBallots") : `${t("voteShowBallots")} (${ballotCount})`}
          </button>
        ) : null}
      </div>
      {showBrief ? (
        <pre className={classNames("mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-2 text-[12px] leading-4", isDark ? "bg-white/5" : "bg-black/[0.04]")}>{meeting.brief}</pre>
      ) : null}
      {showBallots ? (
        <div className="mt-1 space-y-1">
          {meeting.participants.map((actor) => {
            const ballot = vote.ballots[actor];
            return (
              <div key={actor} className={classNames("rounded-lg px-2 py-1", isDark ? "bg-white/5" : "bg-black/[0.04]")}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{actor}</span>
                  <span className={classNames("rounded-full px-1.5 py-0.5 text-[11px]", ROLE_TONE[meeting.roles[actor]] || "")}>{meeting.roles[actor]}</span>
                  <span className="ml-auto font-medium">{ballot ? ballot.option : t("voteNoBallot")}</span>
                  {ballot?.confidence != null ? <span className="text-[var(--color-text-tertiary)]">{ballot.confidence}</span> : null}
                </div>
                {ballot?.reason ? <div className="mt-0.5 whitespace-pre-wrap text-[var(--color-text-secondary)]">{ballot.reason}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
