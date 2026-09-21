import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import { HumanRulingForm } from "./HumanRuling";
import { ROLE_TONE } from "./roleTone";
import { moderatorPost, useMeetingStore, voteCounts, type Meeting, type MeetingMode, type Vote, voteNeedsRuling } from "./meetingStore";


function fieldClass(isDark: boolean): string {
  return classNames(
    "w-full rounded-xl border px-2.5 py-1.5 text-[13px] outline-none",
    isDark ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-white text-gray-800",
  );
}

function buttonClass(tone: "primary" | "ghost" | "danger"): string {
  return classNames(
    "knots-press rounded-full px-3 py-1 text-[12px] font-semibold disabled:opacity-50",
    tone === "primary"
      ? "bg-violet-600 text-white hover:opacity-90"
      : tone === "danger"
        ? "bg-rose-600/90 text-white hover:opacity-90"
        : "border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] text-[var(--color-text-secondary)] hover:opacity-100",
  );
}

export function StatusPill({ status }: { status: Meeting["status"] | Vote["status"] }) {
  const { t } = useTranslation("chat");
  const tone =
    status === "closed"
      ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
      : status === "voting"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return <span className={classNames("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>{t(`meetingStatus_${status}`)}</span>;
}

export function ModeBadge({ mode }: { mode: MeetingMode }) {
  const { t } = useTranslation("chat");
  return (
    <span
      className={classNames(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        mode === "human" ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      )}
      title={t("meetingModeHint")}
    >
      {t(`meetingMode_${mode}`)}
    </span>
  );
}

function VoteCard({ vote, meeting, isDark }: { vote: Vote; meeting: Meeting; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [detail, setDetail] = useState(false);
  const total = meeting.participants.length;
  const counts = voteCounts(vote);
  const cast = Object.keys(vote.ballots).length;
  const humanMode = (meeting.mode || "agents") === "human";
  const needsHuman = voteNeedsRuling(vote, meeting);
  return (
    <div className={classNames("rounded-xl border p-2", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold">{t("voteCard")} #{vote.id}</span>
        <StatusPill status={vote.status} />
        {humanMode ? <span className="text-[11px] text-violet-600 dark:text-violet-300">{t("voteAdvisory")}</span> : null}
        {vote.source && vote.source !== "moderator" && vote.source !== "harness" ? (
          <span className="text-[11px] text-[var(--color-text-tertiary)]">{t("voteRequestedBy", { by: vote.source })}</span>
        ) : null}
        <span className="ml-auto text-[11px] text-[var(--color-text-tertiary)]">
          {cast}/{total}
        </span>
        {vote.status === "open" ? (
          <button type="button" className={buttonClass("ghost")} onClick={() => void moderatorPost(`/api/votes/${vote.id}/close`, {})}>
            {t("voteClose")}
          </button>
        ) : null}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--color-text-secondary)]">{vote.summary}</div>
      <div className="mt-2 space-y-1">
        {vote.options.map((option) => {
          const value = counts[option] || 0;
          const ratio = total > 0 ? value / total : 0;
          const winner = (vote.human?.option || vote.result?.winner) === option;
          return (
            <div key={option} className="flex items-center gap-2 text-[12px]">
              <span className={classNames("w-16 shrink-0 truncate", winner ? "font-semibold" : "")}>{option}</span>
              <span className={classNames("h-2 flex-1 overflow-hidden rounded-full", isDark ? "bg-white/8" : "bg-black/8")}>
                <span
                  className={classNames("block h-full origin-left rounded-full transition-transform duration-200", winner ? "bg-violet-500" : "bg-sky-500/70")}
                  style={{ transform: `scaleX(${ratio})`, transitionTimingFunction: "var(--knots-ease-out)" }}
                />
              </span>
              <span className="w-5 text-right tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
      {vote.human ? (
        <div className="mt-1.5 rounded-lg bg-violet-500/10 px-2 py-1 text-[12px]">
          <span className="font-semibold">{t("voteHumanDecided", { option: vote.human.option })}</span>
          {vote.human.reason ? <span className="text-[var(--color-text-secondary)]"> — {vote.human.reason}</span> : null}
        </div>
      ) : vote.result ? (
        <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
          {needsHuman ? t("voteAwaitingHuman") : vote.result.tie ? t("voteTie") : vote.result.winner ? t("voteWinner", { option: vote.result.winner }) : ""}
        </div>
      ) : null}
      {needsHuman ? (
        <div className="mt-2">
          <HumanRulingForm vote={vote} meeting={meeting} isDark={isDark} />
        </div>
      ) : null}
      <button type="button" className={classNames("mt-2 text-[12px] underline-offset-2 hover:underline", "text-[var(--color-text-tertiary)]")} onClick={() => setDetail((value) => !value)}>
        {detail ? t("voteHideBallots") : t("voteShowBallots")}
      </button>
      {detail ? (
        <div className="mt-1 space-y-1.5">
          {meeting.participants.map((actor) => {
            const ballot = vote.ballots[actor];
            return (
              <div key={actor} className={classNames("rounded-lg px-2 py-1 text-[12px]", isDark ? "bg-white/5" : "bg-black/[0.04]")}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{actor}</span>
                  <span className={classNames("rounded-full px-1.5 py-0.5 text-[11px]", ROLE_TONE[meeting.roles[actor]] || "")}>{meeting.roles[actor]}</span>
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

export function MeetingCard({ meeting, isDark }: { meeting: Meeting; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [voteForm, setVoteForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [options, setOptions] = useState("agree, oppose, abstain, other");
  const [minutes, setMinutes] = useState("5");
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState("");
  const mode: MeetingMode = meeting.mode || "agents";
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
  const switchMode = async () => {
    setBusy("mode");
    await moderatorPost(`/api/meetings/${meeting.id}/mode`, { mode: mode === "human" ? "agents" : "human" });
    setBusy("");
  };
  const lastEscalation = meeting.escalations && meeting.escalations.length ? meeting.escalations[meeting.escalations.length - 1] : "";
  return (
    <div className={classNames("rounded-2xl border p-3", isDark ? "border-white/10 bg-slate-950/60" : "border-black/8 bg-white/80")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">#{meeting.id}</span>
            {meeting.kind === "harness" ? (
              <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">{t("meetingKind_harness")}</span>
            ) : null}
            <StatusPill status={meeting.status} />
            <ModeBadge mode={mode} />
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{String(meeting.created_at).slice(11, 16)}</span>
          </div>
          <div className="mt-0.5 text-[13px] font-medium">{meeting.topic}</div>
          {meeting.requested_by ? <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("meetingRequestedBy", { by: meeting.requested_by })}</div> : null}
          {lastEscalation ? <div className="mt-0.5 text-[11px] text-violet-600 dark:text-violet-300">{t("meetingEscalated", { reason: lastEscalation })}</div> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {meeting.participants.map((actor) => (
          <span key={actor} className={classNames("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", ROLE_TONE[meeting.roles[actor]] || "bg-slate-500/15")}>
            <span className="font-semibold">{actor}</span>
            <span className="opacity-70">{meeting.roles[actor]}</span>
          </span>
        ))}
      </div>
      {meeting.kind === "harness" && meeting.brief ? (
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-[var(--color-text-tertiary)]">{t("harnessProposalBodyLabel")}</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/5 p-2 text-[12px] dark:bg-white/5">{meeting.brief}</pre>
        </details>
      ) : null}
      {meeting.messages && meeting.messages.length > 0 ? (
        <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{t("meetingMessages", { count: meeting.messages.length })}</div>
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
                <span className="text-[12px] text-[var(--color-text-tertiary)]">{t("voteDeadlineMinutes")}</span>
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
              <button type="button" className={buttonClass("ghost")} disabled={busy === "mode"} onClick={() => void switchMode()}>
                {t("meetingSwitchMode", { mode: t(`meetingMode_${mode === "human" ? "agents" : "human"}`) })}
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
        <div className="mt-2 whitespace-pre-wrap rounded-xl bg-violet-500/10 px-2.5 py-1.5 text-[12px]">
          <span className="font-semibold">{t("meetingDecision")}: </span>
          {meeting.decision}
        </div>
      ) : null}
    </div>
  );
}

/** Protocol, adopted skills, history and the human's proposal form (sidebar tab). */
export function HarnessTab({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation("chat");
  const harness = useMeetingStore((state) => state.harness);
  const fetchHarness = useMeetingStore((state) => state.fetchHarness);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    void fetchHarness();
  }, [fetchHarness]);
  const submit = async () => {
    setBusy(true);
    setStatus("");
    const result = await moderatorPost<{ ok: boolean; error?: string; meeting?: Meeting }>("/api/harness/proposals", { title, body });
    setBusy(false);
    if (result.ok) {
      setStatus(`#${result.meeting?.id || ""}`);
      setTitle("");
      setBody("");
    } else {
      setStatus(result.error || t("meetingStartFailed"));
    }
  };
  return (
    <div className="space-y-3 text-[13px]">
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("harnessSkills")}</div>
        {harness?.skills?.length ? (
          <div className="space-y-1">
            {harness.skills.map((skill) => (
              <div key={skill.name} className={classNames("rounded-lg px-2 py-1", isDark ? "bg-white/5" : "bg-black/[0.04]")}>
                <span className="font-semibold">{skill.name}</span>
                <span className="text-[var(--color-text-tertiary)]">
                  {" "}· {skill.source}
                  {skill.path && skill.path !== "." && skill.path !== "inline" ? `/${skill.path}` : ""}
                </span>
                {skill.runtimes ? (
                  <div className="text-[11px] text-[var(--color-text-tertiary)]">
                    {t("harnessRuntimes")}: {Object.keys(skill.runtimes).filter((runtime) => !String(skill.runtimes?.[runtime] || "").startsWith("error")).join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--color-text-tertiary)]">{t("harnessNoSkills")}</div>
        )}
      </section>
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("harnessPropose")}</div>
        <input className={fieldClass(isDark)} placeholder={t("harnessProposalTitle")} value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className={classNames(fieldClass(isDark), "mt-1.5 font-mono text-[12px]")} rows={5} placeholder={t("harnessProposalBody")} value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{t("harnessProposalHint")}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" className={buttonClass("primary")} disabled={busy || !title.trim()} onClick={() => void submit()}>
            {t("harnessSubmit")}
          </button>
          <span className="text-[12px] text-[var(--color-text-tertiary)]">{status}</span>
        </div>
      </section>
      {harness?.history?.length ? (
        <section>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("harnessHistory")}</div>
          <div className="space-y-1">
            {harness.history
              .slice()
              .reverse()
              .map((entry, index) => (
                <div key={`${entry.ts}-${index}`} className="text-[12px]">
                  <span className="text-[var(--color-text-tertiary)]">{String(entry.ts).slice(5, 16)} </span>
                  <span className="font-medium">{entry.outcome}</span> · {entry.title}
                  {entry.detail ? <span className="text-[var(--color-text-tertiary)]"> — {entry.detail}</span> : null}
                </div>
              ))}
          </div>
        </section>
      ) : null}
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50">{t("harnessProtocol")}</div>
        <pre className={classNames("max-h-[48vh] overflow-auto whitespace-pre-wrap rounded-xl p-2 text-[12px] leading-5", isDark ? "bg-white/5" : "bg-black/[0.04]")}>
          {harness?.protocol || "…"}
        </pre>
      </section>
    </div>
  );
}

/** Meeting list plus the "start a meeting" form (sidebar tab). */
export function MeetingsTab({ actors, isDark }: { actors: Actor[]; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const meetings = useMeetingStore((state) => state.meetings);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<MeetingMode>("agents");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const actorIds = useMemo(() => actors.map((actor) => String(actor.id || "")).filter(Boolean), [actors]);
  useEffect(() => {
    setSelected((current) => (current.length ? current.filter((id) => actorIds.includes(id)) : actorIds));
  }, [actorIds]);
  const ordered = meetings.slice().reverse();

  const start = async () => {
    setBusy(true);
    setError("");
    let result: { ok: boolean; error?: string };
    try {
      result = await moderatorPost<{ ok: boolean; error?: string }>("/api/meetings", { topic, brief, participants: selected, mode });
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error || t("meetingStartFailed"));
      return;
    }
    setTopic("");
    setBrief("");
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("meetingChatHint")}</div>
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
                  className={classNames("knots-press rounded-full border px-2 py-0.5 text-[12px]", on ? "border-transparent bg-violet-600 text-white" : "border-[var(--glass-border-subtle)]")}
                  onClick={() => setSelected((current) => (on ? current.filter((item) => item !== id) : [...current, id]))}
                >
                  {id}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-[var(--color-text-tertiary)]">{t("meetingMode")}</span>
            {(["agents", "human"] as MeetingMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={classNames("knots-press rounded-full border px-2 py-0.5", mode === item ? "border-transparent bg-violet-600 text-white" : "border-[var(--glass-border-subtle)]")}
                onClick={() => setMode(item)}
              >
                {t(`meetingMode_${item}`)}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("meetingModeHint")}</div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("meetingRolesHint")}</div>
          {error ? <div className="text-[12px] text-rose-500">{error}</div> : null}
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-[var(--color-text-tertiary)]">{ordered.length === 0 ? t("meetingNone") : ""}</span>
          <button type="button" className={buttonClass("ghost")} onClick={() => setShowForm(true)}>
            + {t("meetingNew")}
          </button>
        </div>
      )}
      {ordered.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} isDark={isDark} />
      ))}
    </div>
  );
}
