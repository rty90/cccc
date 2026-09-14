import { useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { moderatorPost, type Lesson } from "./meetingStore";

/** A principle an actor distilled; the human keeps it (announced to everyone) or drops it. Not a rule either way. */
export function LessonCard({ lesson, isDark }: { lesson: Lesson; isDark: boolean }) {
  const { t } = useTranslation("chat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const act = async (action: "keep" | "drop") => {
    setBusy(true);
    setError("");
    const result = await moderatorPost<{ ok: boolean; error?: string }>(`/api/lessons/${encodeURIComponent(lesson.id)}/${action}`, {});
    setBusy(false);
    if (!result.ok) setError(result.error || t("lessonRuleFailed"));
  };
  return (
    <div className={classNames("rounded-xl border p-2 text-[11px]", isDark ? "border-violet-400/20 bg-violet-500/[0.06]" : "border-violet-500/20 bg-violet-500/[0.04]")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">{t("lessonCandidate")}</span>
        <span className="font-semibold">#{lesson.id}</span>
        <span className="text-[var(--color-text-tertiary)]">{lesson.by}</span>
      </div>
      <div className="mt-1 text-[12px] font-medium leading-snug">{lesson.principle}</div>
      {lesson.why ? (
        <div className="mt-1 text-[var(--color-text-secondary)]">
          <span className="opacity-60">{t("lessonWhy")} </span>
          {lesson.why}
        </div>
      ) : null}
      {lesson.apply ? (
        <div className="mt-0.5 text-[var(--color-text-secondary)]">
          <span className="opacity-60">{t("lessonApply")} </span>
          {lesson.apply}
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={busy} className="knots-press rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50" onClick={() => void act("keep")}>
          {t("lessonKeep")}
        </button>
        <button type="button" disabled={busy} className="knots-press rounded-full border border-[var(--glass-border-subtle)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] disabled:opacity-50" onClick={() => void act("drop")}>
          {t("lessonDrop")}
        </button>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">{t("lessonNotARule")}</span>
        {error ? <span className="text-[10px] text-rose-500">{error}</span> : null}
      </div>
    </div>
  );
}
