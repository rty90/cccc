import { useState } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../../utils/classNames";
import { moderatorPost, type HelpTicket } from "./meetingStore";

/**
 * A stuck actor's help ticket, with the human's levers: assign it to another actor, grant or
 * deny a permission request, or close it with a note. Used in the sidebar strip and the toast.
 */
export function HelpTicketCard({ ticket, actorIds, isDark, compact }: { ticket: HelpTicket; actorIds: string[]; isDark: boolean; compact?: boolean }) {
  const { t } = useTranslation("chat");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [full, setFull] = useState(false);
  const open = ticket.status !== "resolved";
  const needTone =
    ticket.need === "permission" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : ticket.need === "takeover" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  const act = async (path: string, body: unknown) => {
    setBusy(path);
    await moderatorPost(`/api/help/${ticket.id}/${path}`, body);
    setBusy("");
    setNote("");
  };
  const buttonClass = "knots-press rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-tab-bg)] px-2 py-0.5 text-[10px] font-medium disabled:opacity-50";
  return (
    <div className={classNames("rounded-xl border p-2", isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]")}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-semibold">
          {t("helpTicket")} #{ticket.id} · {ticket.by}
        </span>
        <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", needTone)}>{t(`helpNeed_${ticket.need}`)}</span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{t(`helpStatus_${ticket.status}`)}{ticket.assignee ? ` → ${ticket.assignee}` : ""}</span>
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">{String(ticket.created_at).slice(11, 16)}</span>
      </div>
      <div className={classNames("mt-1 whitespace-pre-wrap text-[11px] text-[var(--color-text-secondary)]", full ? "" : compact ? "line-clamp-3" : "line-clamp-6")}>{ticket.text}</div>
      {ticket.text.length > 200 ? (
        <button type="button" className={classNames(buttonClass, "mt-1")} onClick={() => setFull((value) => !value)}>
          {full ? t("detailsLess") : t("detailsMore")}
        </button>
      ) : null}
      {ticket.resolution ? (
        <div className="mt-1 rounded-lg bg-violet-500/10 px-2 py-1 text-[11px]">
          <span className="font-semibold">{t(`helpOutcome_${ticket.outcome || "done"}`)}</span>
          {ticket.resolution ? <span className="text-[var(--color-text-secondary)]"> — {ticket.resolution}</span> : null}
        </div>
      ) : null}
      {open ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{t("helpAssignTo")}</span>
            {actorIds
              .filter((id) => id !== ticket.by)
              .map((id) => (
                <button key={id} type="button" className={classNames(buttonClass, ticket.assignee === id ? "bg-violet-600 text-white" : "")} disabled={busy !== ""} onClick={() => void act("assign", { actor: id })}>
                  {id}
                </button>
              ))}
          </div>
          <input
            className={classNames(
              "w-full rounded-xl border px-2.5 py-1.5 text-[12px] outline-none",
              isDark ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-white text-gray-800",
            )}
            placeholder={t("helpNotePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {ticket.need === "permission" ? (
              <>
                <button type="button" className={classNames(buttonClass, "bg-emerald-600 text-white")} disabled={busy !== ""} onClick={() => void act("resolve", { outcome: "granted", text: note })}>
                  {t("helpGrant")}
                </button>
                <button type="button" className={classNames(buttonClass, "bg-rose-600 text-white")} disabled={busy !== ""} onClick={() => void act("resolve", { outcome: "denied", text: note })}>
                  {t("helpDeny")}
                </button>
              </>
            ) : null}
            <button type="button" className={buttonClass} disabled={busy !== ""} onClick={() => void act("resolve", { outcome: "done", text: note })}>
              {t("helpClose")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
