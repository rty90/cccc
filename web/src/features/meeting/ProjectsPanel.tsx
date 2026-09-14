import { useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { moderatorPost, useMeetingStore, type Project } from "./meetingStore";

/**
 * Projects tab: the human states a goal; one actor proposes, the debate tier argues for and against it,
 * the review tier verifies and gives verdicts, and the moderator condenses all of it into one card here.
 * The human adopts (steps become tasks), sends it back with a note (new round) or rejects.
 */
const CLOSED = new Set(["adopted", "rejected", "stopped"]);

function fieldClass(isDark: boolean): string {
  return classNames(
    "w-full rounded-lg border px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-violet-500",
    isDark ? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500" : "border-black/10 bg-white text-gray-800 placeholder:text-gray-400",
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "awaiting_human":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
    case "adopted":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "debating":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "reviewing":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "rejected":
    case "stopped":
      return "bg-black/8 text-[var(--color-text-tertiary)] dark:bg-white/10";
    default:
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
}

function Chip({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] dark:bg-white/[0.06]">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export function ProjectCard({ project, isDark }: { project: Project; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showFull, setShowFull] = useState(false);
  const roles = project.roles || { proposer: "", blue: [], red: [], reviewers: [] };
  const proposal = project.proposal || null;
  const closed = CLOSED.has(project.status);
  const waiting: string[] =
    project.status === "proposing" || project.status === "revising"
      ? [roles.proposer]
      : project.status === "debating"
        ? [...roles.blue.filter((a) => !project.pros.some((e) => e.by === a)), ...roles.red.filter((a) => !project.cons.some((e) => e.by === a))]
        : project.status === "reviewing"
          ? roles.reviewers.filter((a) => !project.reviews.some((r) => r.by === a))
          : [];
  const missing = [...(project.debate_missing || []), ...(project.review_missing || [])];

  const act = async (action: "adopt" | "revise" | "reject" | "stop") => {
    setBusy(true);
    setError("");
    const result = await moderatorPost<{ ok: boolean; error?: string }>(`/api/projects/${encodeURIComponent(project.id)}/${action}`, { note });
    setBusy(false);
    if (!result.ok) setError(result.error || t("projectRuleFailed"));
    else setNote("");
  };

  return (
    <div className={classNames("rounded-xl border p-2 text-[11px]", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">#{project.id}</span>
        <span className={classNames("rounded-full px-1.5 py-0.5 text-[10px] font-medium", statusClass(project.status))}>{t(`projectStatus_${project.status}`)}</span>
        {project.round > 1 ? <span className="text-[10px] text-[var(--color-text-tertiary)]">{t("projectRound", { n: project.round })}</span> : null}
        <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-tertiary)]">{String(project.created_at || "").slice(11, 16)}</span>
      </div>
      <div className="mt-1 text-[12px] font-medium leading-snug">{project.title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Chip label={t("projectRoleProposer")} value={roles.proposer} />
        <Chip label={t("projectRoleBlue")} value={roles.blue.join(", ")} />
        <Chip label={t("projectRoleRed")} value={roles.red.join(", ")} />
        <Chip label={t("projectRoleReviewers")} value={roles.reviewers.join(", ")} />
      </div>

      {waiting.length > 0 ? <div className="mt-1.5 text-[10px] text-[var(--color-text-tertiary)]">{t("projectWaiting", { actors: waiting.join(", ") })}</div> : null}

      {proposal && (project.status === "awaiting_human" || closed || project.status === "reviewing") ? (
        <div className="mt-2 space-y-1.5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-50">{t("projectSummary")}</div>
            <div className="leading-snug">{proposal.summary || "—"}</div>
          </div>
          {proposal.steps && proposal.steps.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-50">{t("projectSteps")}</div>
              <ol className="list-decimal space-y-0.5 pl-4">
                {proposal.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {project.pros.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600 opacity-80 dark:text-emerald-300">{t("projectPros")}</div>
              <ul className="space-y-0.5">
                {project.pros.flatMap((entry) => entry.points.map((point, index) => (
                  <li key={`${entry.by}-${index}`} className="flex gap-1">
                    <span className="text-emerald-500">+</span>
                    <span>
                      {point} <span className="opacity-50">({entry.by})</span>
                    </span>
                  </li>
                )))}
              </ul>
            </div>
          ) : null}
          {project.cons.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-600 opacity-80 dark:text-rose-300">{t("projectCons")}</div>
              <ul className="space-y-0.5">
                {project.cons.flatMap((entry) => entry.points.map((point, index) => (
                  <li key={`${entry.by}-${index}`} className="flex gap-1">
                    <span className="text-rose-500">−</span>
                    <span>
                      {point} <span className="opacity-50">({entry.by})</span>
                    </span>
                  </li>
                )))}
              </ul>
            </div>
          ) : null}
          {project.reviews.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-50">{t("projectReviews")}</div>
              <ul className="space-y-0.5">
                {project.reviews.map((review) => (
                  <li key={review.by}>
                    <span className="font-medium">{review.by}</span> · {t(`projectVerdict_${review.verdict}`)}
                    {review.reason ? <span className="opacity-80"> — {review.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {missing.length > 0 ? <div className="text-[10px] text-amber-600 dark:text-amber-300">{t("projectMissing", { actors: missing.join(", ") })}</div> : null}
          {project.suggestion ? (
            <div className="text-[10px] font-medium text-violet-700 dark:text-violet-300">{t("projectSuggestion", { verdict: t(`projectVerdict_${project.suggestion}`) })}</div>
          ) : null}
          {proposal.text ? (
            <div>
              <button type="button" className="knots-press text-[10px] text-[var(--color-text-tertiary)] underline-offset-2 hover:underline" onClick={() => setShowFull((v) => !v)}>
                {t("projectFullText")}
              </button>
              {showFull ? <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/5 p-2 text-[10px] dark:bg-white/5">{proposal.text}</pre> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {project.status === "awaiting_human" ? (
        <div className="mt-2 space-y-1.5">
          <textarea className={fieldClass(isDark)} rows={2} placeholder={t("projectNotePlaceholder")} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} className="knots-press rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50" onClick={() => void act("adopt")}>
              {t("projectAdopt")}
            </button>
            <button type="button" disabled={busy || !note.trim()} className="knots-press rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50" onClick={() => void act("revise")}>
              {t("projectRevise")}
            </button>
            <button type="button" disabled={busy} className="knots-press rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50" onClick={() => void act("reject")}>
              {t("projectReject")}
            </button>
          </div>
        </div>
      ) : null}
      {project.status === "adopted" && project.tasks && project.tasks.length > 0 ? (
        <div className="mt-1.5 text-[10px] text-[var(--color-text-tertiary)]">{t("projectTasks", { ids: project.tasks.join(", ") })}</div>
      ) : null}
      {!closed && project.status !== "awaiting_human" ? (
        <div className="mt-1.5">
          <button type="button" disabled={busy} className="knots-press rounded-full border border-[var(--glass-border-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] disabled:opacity-50" onClick={() => void act("stop")}>
            {t("projectStop")}
          </button>
        </div>
      ) : null}
      {error ? <div className="mt-1 text-[10px] text-rose-500">{error}</div> : null}
    </div>
  );
}

export function ProjectsTab({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation("chat");
  const projects = useMeetingStore((state) => state.projects);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ordered = projects.slice().reverse();

  const create = async () => {
    setBusy(true);
    setError("");
    const result = await moderatorPost<{ ok: boolean; error?: string }>("/api/projects", { title, brief });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("projectCreateFailed"));
      return;
    }
    setTitle("");
    setBrief("");
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {showForm ? (
        <div className="space-y-1.5">
          <input className={fieldClass(isDark)} placeholder={t("projectTitlePlaceholder")} value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea className={fieldClass(isDark)} rows={4} placeholder={t("projectBriefPlaceholder")} value={brief} onChange={(event) => setBrief(event.target.value)} />
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={busy || !title.trim()} className="knots-press rounded-full bg-violet-600 px-3 py-1 text-[11px] font-medium text-white disabled:opacity-50" onClick={() => void create()}>
              {t("projectCreate")}
            </button>
            <button type="button" className="knots-press rounded-full px-2 py-1 text-[11px] text-[var(--color-text-secondary)]" onClick={() => setShowForm(false)}>
              {t("common:cancel", { defaultValue: "Cancel" })}
            </button>
            {error ? <span className="text-[10px] text-rose-500">{error}</span> : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={classNames("knots-press w-full rounded-xl border border-dashed px-2 py-1.5 text-[11px]", isDark ? "border-white/15 text-slate-300" : "border-black/15 text-gray-600")}
          onClick={() => setShowForm(true)}
        >
          + {t("projectNew")}
        </button>
      )}
      <div className="text-[10px] text-[var(--color-text-tertiary)]">{t("projectChatHint")}</div>
      {ordered.length === 0 ? <div className="text-[11px] text-[var(--color-text-tertiary)]">{t("projectNone")}</div> : null}
      {ordered.map((project) => (
        <ProjectCard key={project.id} project={project} isDark={isDark} />
      ))}
    </div>
  );
}
