import { useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { isComposingKeyEvent } from "../../utils/imeKey";
import { moderatorPost, type Meeting, type Vote } from "./meetingStore";

/**
 * The human moderator's ruling on a vote (human decision mode). Shared by the meeting card and the popup.
 * Options are fixed to the vote's options; the reason is announced to the participants verbatim.
 */
export function HumanRulingForm({
  vote,
  meeting,
  isDark,
  onDone,
}: {
  vote: Vote;
  meeting: Meeting;
  isDark: boolean;
  onDone?: () => void;
}) {
  const { t } = useTranslation("chat");
  const [option, setOption] = useState(vote.result?.winner || "");
  const [reason, setReason] = useState("");
  const [closeMeeting, setCloseMeeting] = useState(meeting.status !== "closed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!option) return;
    setBusy(true);
    setError("");
    let result: { ok: boolean; error?: string };
    try {
      result = await moderatorPost<{ ok: boolean; error?: string }>(`/api/votes/${vote.id}/human`, {
        option,
        reason,
        close_meeting: closeMeeting && meeting.status !== "closed",
      });
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error || t("meetingStartFailed"));
      return;
    }
    onDone?.();
  };

  return (
    <div className={classNames("rounded-xl border p-2", isDark ? "border-violet-400/25 bg-violet-500/10" : "border-violet-300/60 bg-violet-50/80")}>
      <div className="text-[12px] font-semibold">{t("voteHumanRuling")}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {vote.options.map((item) => (
          <button
            key={item}
            type="button"
            className={classNames(
              "knots-press rounded-full border px-2.5 py-0.5 text-[12px] font-medium",
              option === item ? "border-transparent bg-violet-600 text-white" : "border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)]",
            )}
            onClick={() => setOption(item)}
          >
            {item}
            {vote.result?.counts?.[item] ? <span className="ml-1 opacity-70">{vote.result.counts[item]}</span> : null}
          </button>
        ))}
      </div>
      <input
        className={classNames(
          "mt-1.5 w-full rounded-xl border px-2.5 py-1.5 text-[13px] outline-none",
          isDark ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-white text-gray-800",
        )}
        placeholder={t("voteHumanReasonPlaceholder")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        onKeyDown={(event) => {
          // A ruling is final: the Enter that confirms an IME candidate while typing the reason is not a submit.
          if (event.key === "Enter" && !isComposingKeyEvent(event) && option && !busy) void submit();
        }}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="knots-press rounded-full bg-violet-600 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
          disabled={!option || busy}
          onClick={() => void submit()}
        >
          {t("voteHumanSubmit")}
        </button>
        {meeting.status !== "closed" ? (
          <label className="flex items-center gap-1 text-[12px] text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={closeMeeting} onChange={(event) => setCloseMeeting(event.target.checked)} />
            {t("voteHumanCloseMeeting")}
          </label>
        ) : null}
        {error ? <span className="text-[12px] text-rose-500">{error}</span> : null}
      </div>
    </div>
  );
}
