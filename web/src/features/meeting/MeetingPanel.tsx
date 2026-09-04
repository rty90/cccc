import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { moderatorPost, useMeetingStore, type Meeting, type Vote } from "./meetingStore";

const ROLE_TONE: Record<string, string> = {
  proposer: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "red-team": "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  auditor: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  experimenter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  synthesizer: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  observer: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

function fieldClass(isDark: boolean): string {
  return classNames(
    "w-full rounded-xl border px-2.5 py-1.5 text-[12px] outline-none",
    isDark ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-white text-gray-800",
  );
}

function buttonClass(tone: "primary" | "ghost" | "danger"): string {
  return classNames(
    "rounded-full px-3 py-1 text-[11px] font-semibold transition-opacity disabled:opacity-50",
    tone === "primary"
      ? "bg-violet-600 text-white hover:opacity-90"
      : tone === "danger"
        ? "bg-rose-600/90 text-white hover:opacity-90"
        : "border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] text-[var(--color-text-secondary)] hover:opacity-100",
  );
}

function StatusPill({ status }: { status: Meeting["status"] | Vote["status"] }) {
  const { t } = useTranslation("chat");
  const tone =
    status === "closed"
      ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
      : status === "voting"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)}>{t(`meetingStatus_${status}`)}</span>;
}

function VoteCard({ vote, meeting, isDark }: { vote: Vote; meeting: Meeting; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [detail, setDetail] = useState(false);
  const total = meeting.participants.length;
  const counts = vote.result?.counts || vote.options.reduce<Record<string, number>>((acc, option) => ({ ...acc, [option]: 0 }), {});
  if (!vote.result) {
    for (const ballot of Object.values(vote.ballots)) counts[ballot.option] = (counts[ballot.option] || 0) + 1;
  }
  const cast = Object.keys(vote.ballots).length;
  return (
    <div className={classNames("rounded-xl border p-2", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]")}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold">{t("voteCard")} #{vote.id}</span>
        <StatusPill status={vote.status} />
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
          {cast}/{total}
        </span>
        {vote.status === "open" ? (
          <button type="button" className={buttonClass("ghost")} onClick={() => void moderatorPost(`/api/votes/${vote.id}/close`, {})}>
            {t("voteClose")}
          </button>
        ) : null}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-[12px] text-[var(--color-text-secondary)]">{vote.summary}</div>
      <div className="mt-2 space-y-1">
        {vote.options.map((option) => {
          const value = counts[option] || 0;
          const width = total > 0 ? Math.round((value / total) * 100) : 0;
          const winner = vote.result?.winner === option;
          return (
            <div key={option} className="flex items-center gap-2 text-[11px]">
              <span className={classNames("w-16 shrink-0 truncate", winner ? "font-semibold" : "")}>{option}</span>
              <span className={classNames("h-2 flex-1 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
                <span className={classNames("block h-full rounded-full", winner ? "bg-violet-500" : "bg-sky-500/70")} style={{ width: `${width}%` }} />
              </span>
              <span className="w-5 text-right tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
      {vote.result ? (
        <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
          {vote.result.tie ? t("voteTie") : vote.result.winner ? t("voteWinner", { option: vote.result.winner }) : ""}
        </div>
      ) : null}
      <button type="button" className={classNames("mt-2 text-[11px] underline-offset-2 hover:underline", "text-[var(--color-text-tertiary)]")} onClick={() => setDetail((value) => !value)}>
        {detail ? t("voteHideBallots") : t("voteShowBallots")}
      </button>
      {detail ? (
        <div className="mt-1 space-y-1.5">
          {meeting.participants.map((actor) => {
            const ballot = vote.ballots[actor];
            return (
              <div key={actor} className={classNames("rounded-lg px-2 py-1 text-[11px]", isDark ? "bg-white/5" : "bg-black/[0.04]")}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{actor}</span>
                  <span className={classNames("rounded-full px-1.5 py-0.5 text-[10px]", ROLE_TONE[meeting.roles[actor]] || "")}>{meeting.roles[actor]}</span>
                  <span className="ml-auto">{ballot ? ballot.option : t("voteNoBallot")}</span>
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

function MeetingCard({ meeting, isDark }: { meeting: Meeting; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [voteForm, setVoteForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [options, setOptions] = useState("agree, oppose, abstain, other");
  const [minutes, setMinutes] = useState("5");
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState("");
  const openVote = async () => {
    setBusy("vote");
    await moderatorPost(`/api/meetings/${meeting.id}/vote`, {
      summary,
      options: options.split(",").map((item) => item.trim()).filter(Boolean),
      deadline_s: Math.max(60, Number(minutes) * 60 || 300),
    });
    setBusy("");
    setVoteForm(false);
    setSummary("");
  };
  const close = async () => {
    setBusy("close");
    await moderatorPost(`/api/meetings/${meeting.id}/close`, { decision });
    setBusy("");
  };
  const stop = async () => {
    setBusy("stop");
    await moderatorPost(`/api/meetings/${meeting.id}/stop`, {});
    setBusy("");
  };
  return (
    <div className={classNames("rounded-2xl border p-3", isDark ? "border-white/10 bg-slate-950/60" : "border-black/8 bg-white/80")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold">#{meeting.id}</span>
            <StatusPill status={meeting.status} />
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{String(meeting.created_at).slice(11, 16)}</span>
          </div>
          <div className="mt-0.5 text-[13px] font-medium">{meeting.topic}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {meeting.participants.map((actor) => (
          <span key={actor} className={classNames("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", ROLE_TONE[meeting.roles[actor]] || "bg-slate-500/15")}>
            <span className="font-semibold">{actor}</span>
            <span className="opacity-70">{meeting.roles[actor]}</span>
          </span>
        ))}
      </div>
      {meeting.messages && meeting.messages.length > 0 ? (
        <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">{t("meetingMessages", { count: meeting.messages.length })}</div>
      ) : null}
      <div className="mt-2 space-y-2">
        {meeting.votes.map((vote) => (
          <VoteCard key={vote.id} vote={vote} meeting={meeting} isDark={isDark} />
        ))}
      </div>
      {meeting.status !== "closed" ? (
        <div className="mt-2 space-y-2">
          {voteForm ? (
            <div className="space-y-1.5">
              <textarea className={fieldClass(isDark)} rows={3} placeholder={t("voteSummaryPlaceholder")} value={summary} onChange={(event) => setSummary(event.target.value)} />
              <input className={fieldClass(isDark)} value={options} onChange={(event) => setOptions(event.target.value)} placeholder={t("voteOptionsPlaceholder")} />
              <div className="flex items-center gap-2">
                <input className={classNames(fieldClass(isDark), "w-16")} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
                <span className="text-[11px] text-[var(--color-text-tertiary)]">{t("voteDeadlineMinutes")}</span>
                <button type="button" className={buttonClass("primary")} disabled={!summary.trim() || busy === "vote"} onClick={() => void openVote()}>
                  {t("voteOpen")}
                </button>
                <button type="button" className={buttonClass("ghost")} onClick={() => setVoteForm(false)}>
                  {t("meetingCancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass("primary")} onClick={() => setVoteForm(true)}>
                {t("voteStart")}
              </button>
              <button type="button" className={buttonClass("danger")} disabled={busy === "stop"} onClick={() => void stop()}>
                {t("meetingStop")}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input className={fieldClass(isDark)} value={decision} onChange={(event) => setDecision(event.target.value)} placeholder={t("meetingDecisionPlaceholder")} />
            <button type="button" className={buttonClass("ghost")} disabled={busy === "close"} onClick={() => void close()}>
              {t("meetingClose")}
            </button>
          </div>
        </div>
      ) : meeting.decision ? (
        <div className="mt-2 whitespace-pre-wrap rounded-xl bg-violet-500/10 px-2.5 py-1.5 text-[11px]">
          <span className="font-semibold">{t("meetingDecision")}: </span>
          {meeting.decision}
        </div>
      ) : null}
    </div>
  );
}

export function MeetingPanel({ actors, isDark }: { actors: Actor[]; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const connect = useMeetingStore((state) => state.connect);
  const meetings = useMeetingStore((state) => state.meetings);
  const connected = useMeetingStore((state) => state.connected);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    connect();
  }, [connect]);
  const actorIds = useMemo(() => actors.map((actor) => String(actor.id || "")).filter(Boolean), [actors]);
  useEffect(() => {
    setSelected((current) => (current.length ? current.filter((id) => actorIds.includes(id)) : actorIds));
  }, [actorIds]);
  const active = meetings.filter((meeting) => meeting.status !== "closed").length;
  const ordered = meetings.slice().reverse();

  const start = async () => {
    setBusy(true);
    setError("");
    const result = await moderatorPost<{ ok: boolean; error?: string }>("/api/meetings", { topic, brief, participants: selected });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("meetingStartFailed"));
      return;
    }
    setTopic("");
    setBrief("");
    setShowForm(false);
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-auto fixed right-3 top-14 z-[900] flex flex-col items-end gap-2 sm:right-5 sm:top-16">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={classNames(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur",
          isDark ? "border-white/10 bg-slate-950/80 text-slate-100" : "border-black/8 bg-white/90 text-gray-800",
        )}
        title={connected ? "" : t("meetingOffline")}
      >
        <span className={classNames("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
        {t("meetingPanel")}
        {active > 0 ? <span className="rounded-full bg-violet-600 px-1.5 text-[10px] text-white">{active}</span> : null}
      </button>
      {open ? (
        <div
          className={classNames(
            "flex max-h-[70vh] w-[360px] max-w-[92vw] flex-col gap-2 overflow-y-auto rounded-2xl border p-3 shadow-2xl backdrop-blur",
            isDark ? "border-white/10 bg-slate-950/85" : "border-black/8 bg-white/95",
          )}
        >
          {showForm ? (
            <div className="space-y-1.5">
              <input className={fieldClass(isDark)} placeholder={t("meetingTopicPlaceholder")} value={topic} onChange={(event) => setTopic(event.target.value)} />
              <textarea className={fieldClass(isDark)} rows={3} placeholder={t("meetingBriefPlaceholder")} value={brief} onChange={(event) => setBrief(event.target.value)} />
              <div className="flex flex-wrap gap-1">
                {actorIds.map((id) => {
                  const on = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={classNames("rounded-full border px-2 py-0.5 text-[11px]", on ? "border-transparent bg-violet-600 text-white" : "border-[var(--glass-border-subtle)]")}
                      onClick={() => setSelected((current) => (on ? current.filter((item) => item !== id) : [...current, id]))}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-[var(--color-text-tertiary)]">{t("meetingRolesHint")}</div>
              {error ? <div className="text-[11px] text-rose-500">{error}</div> : null}
              <div className="flex items-center gap-2">
                <button type="button" className={buttonClass("primary")} disabled={busy || !topic.trim() || selected.length < 3} onClick={() => void start()}>
                  {t("meetingStart")}
                </button>
                <button type="button" className={buttonClass("ghost")} onClick={() => setShowForm(false)}>
                  {t("meetingCancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={buttonClass("primary")} onClick={() => setShowForm(true)}>
              {t("meetingNew")}
            </button>
          )}
          {ordered.length === 0 ? <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("meetingNone")}</div> : null}
          {ordered.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} isDark={isDark} />
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
