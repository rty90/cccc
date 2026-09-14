import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActorAvatar } from "../../components/ActorAvatar";
import { PlusIcon } from "../../components/Icons";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { ModelSwitchPopover } from "../../features/trace/ModelSwitchPopover";
import { useTraceStore, type LiveTrace } from "../../features/trace/traceStore";
import { useMeetingStore, type ActorStatus, type HelpTicket } from "../../features/meeting/meetingStore";
import { useActorDisplayState } from "../../hooks/useActorDisplayState";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import type { LiveWorkCard } from "./liveWorkCards";
import { buildRuntimeDockItems, type RuntimeDockItem } from "./runtimeDockItems";

/**
 * "Members" in the chat toolbar: who is in the room, what each one is doing right now, and who is
 * asking for help. Replaces the floating avatar dock on desktop; the avatar still opens the model
 * switcher, "open" still opens the terminal or live-work view.
 */
function isFreshStatus(status: ActorStatus | undefined, now: number): status is ActorStatus {
  if (!status) return false;
  const age = now - Date.parse(status.ts);
  if (status.status === "starting" || status.status === "handoff") return age < 3 * 60 * 1000;
  if (status.status === "failed") return age < 30 * 60 * 1000;
  return age < 20 * 1000;
}

function phaseLabel(phase: string, t: (key: string) => string): string {
  switch (phase) {
    case "received":
      return t("traceReceived");
    case "tool":
      return t("traceUsingTool");
    case "writing":
      return t("traceWriting");
    default:
      return t("traceStillThinking");
  }
}

function MembersGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MemberRow({
  groupId,
  item,
  isDark,
  actorStatusProvisional,
  live,
  status,
  helpTicket,
  onOpen,
}: {
  groupId: string;
  item: RuntimeDockItem;
  isDark: boolean;
  actorStatusProvisional: boolean;
  live: LiveTrace | undefined;
  status: ActorStatus | undefined;
  helpTicket: HelpTicket | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation(["chat", "actors"]);
  const { isRunning, workingState } = useActorDisplayState({ groupId, actor: item.actor, actorStatusProvisional });
  const card = item.liveWorkCard;
  const cardActive = Boolean(card && (card.phase === "pending" || card.phase === "streaming"));
  let line = "";
  let tone: "busy" | "attention" | "off" | "idle" = "idle";
  if (status) {
    line = `${t(`chat:actorStatus_${status.status}`)}${status.detail ? ` · ${status.detail}` : ""}`;
    tone = status.status === "failed" ? "attention" : status.status === "offline" ? "off" : "busy";
  } else if (live?.working) {
    line = `${phaseLabel(live.phase, (key) => t(`chat:${key}`))}${live.last ? ` · ${live.last}` : ""}`;
    tone = "busy";
  } else if (cardActive && card) {
    line = `${card.phase === "pending" ? t("chat:liveWorkPhaseQueued", { defaultValue: "Queued" }) : t("chat:liveWorkPhaseWorking", { defaultValue: "Working" })}${card.text ? ` · ${card.text}` : ""}`;
    tone = "busy";
  } else if (item.actor.enabled === false || !isRunning) {
    line = t("actors:stopped", { defaultValue: "Stopped" });
    tone = "off";
  } else if (workingState === "working") {
    line = t("actors:working", { defaultValue: "Working" });
    tone = "busy";
  } else if (workingState === "stuck") {
    line = t("actors:stuck", { defaultValue: "Stuck" });
    tone = "attention";
  } else {
    line = t("chat:membersIdle");
  }
  const openLabel =
    item.runner === "headless"
      ? t("chat:runtimeDockOpenLiveWork", { name: item.actorLabel, defaultValue: `Open live work for ${item.actorLabel}` })
      : t("chat:runtimeDockOpenTerminal", { name: item.actorLabel, defaultValue: `Open terminal for ${item.actorLabel}` });
  const queued = Math.max(0, Number(item.webModelQueuedCount || 0));
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
      <ModelSwitchPopover actorId={item.actorId} runtime={item.runtime} label={item.actorLabel} isDark={isDark} onOpenInspector={onOpen} openInspectorLabel={openLabel}>
        <button type="button" className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60" aria-label={t("chat:switchModel")} title={t("chat:switchModel")}>
          <ActorAvatar
            avatarUrl={item.actor.avatar_url || undefined}
            runtime={item.runtime}
            title={item.actorLabel}
            isDark={isDark}
            dimmed={item.actor.enabled === false}
            sizeClassName="h-8 w-8"
          />
        </button>
      </ModelSwitchPopover>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium leading-5 text-[var(--color-text-primary)]">
          <span className="truncate">{item.actorLabel}</span>
          <span className="shrink-0 text-[12px] font-normal text-[var(--color-text-tertiary)]">
            {item.runtime}
            {live?.model ? ` · ${live.model}` : ""}
          </span>
          {helpTicket ? (
            <span className="shrink-0 rounded-full bg-rose-500/[0.12] px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {t("chat:membersNeedsHelp")} #{helpTicket.id}
            </span>
          ) : null}
          {queued > 0 ? (
            <span className="shrink-0 rounded-full bg-emerald-500/[0.12] px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {t("chat:membersQueued", { count: queued })}
            </span>
          ) : null}
        </div>
        <div
          className={classNames(
            "truncate text-[12px] leading-4",
            tone === "attention" ? "text-rose-600 dark:text-rose-300" : tone === "busy" ? "text-violet-700 dark:text-violet-300" : tone === "off" ? "text-[var(--color-text-tertiary)] opacity-70" : "text-[var(--color-text-tertiary)]",
          )}
          title={line}
        >
          {tone === "busy" ? (
            <span className="knots-breathe mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-500 align-middle" aria-hidden="true" />
          ) : null}
          {line}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="knots-press shrink-0 rounded-full border border-[var(--glass-border-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.08]"
        aria-label={openLabel}
        title={openLabel}
      >
        {t("chat:membersOpen")}
      </button>
    </div>
  );
}

export function MembersMenu({
  groupId,
  runtimeActors,
  liveWorkCards,
  actorStatusProvisional,
  isDark,
  readOnly,
  onOpenRuntimeActor,
  onAddAgent,
}: {
  groupId: string;
  runtimeActors: Actor[];
  liveWorkCards: LiveWorkCard[];
  actorStatusProvisional: boolean;
  isDark: boolean;
  readOnly?: boolean;
  onOpenRuntimeActor: (actorId: string) => void;
  onAddAgent?: () => void;
}) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const live = useTraceStore((state) => state.live);
  const actorStatus = useMeetingStore((state) => state.actorStatus);
  const help = useMeetingStore((state) => state.help);
  const items = useMemo(() => buildRuntimeDockItems({ actors: runtimeActors, liveWorkCards }), [liveWorkCards, runtimeActors]);
  const now = Date.now();
  const openHelpByActor = new Map<string, HelpTicket>();
  for (const ticket of help) {
    if (ticket.status !== "resolved" && !openHelpByActor.has(ticket.by)) openHelpByActor.set(ticket.by, ticket);
  }
  const attention = items.some((item) => {
    const status = actorStatus[item.actorId];
    return openHelpByActor.has(item.actorId) || (isFreshStatus(status, now) && status.status === "failed");
  });
  const working = items.some((item) => live[item.actorId]?.working);
  if (items.length <= 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={classNames(
            "knots-press inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium",
            isDark ? "border-white/10 text-slate-200" : "border-black/10 text-gray-700",
            open ? (isDark ? "bg-white/[0.08] text-white" : "bg-black/[0.06] text-[rgb(35,36,37)]") : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MembersGlyph />
          {t("membersButton")}
          <span className="tabular-nums opacity-60">{items.length}</span>
          {attention ? (
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          ) : working ? (
            <span className="knots-breathe h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[min(92vw,380px)] p-1.5">
        <div className="max-h-[60vh] overflow-y-auto">
          {items.map((item) => {
            const status = actorStatus[item.actorId];
            return (
              <MemberRow
                key={item.actorId}
                groupId={groupId}
                item={item}
                isDark={isDark}
                actorStatusProvisional={actorStatusProvisional}
                live={live[item.actorId]}
                status={isFreshStatus(status, now) ? status : undefined}
                helpTicket={openHelpByActor.get(item.actorId)}
                onOpen={() => {
                  setOpen(false);
                  onOpenRuntimeActor(item.actorId);
                }}
              />
            );
          })}
        </div>
        {!readOnly && onAddAgent ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddAgent();
            }}
            className="knots-press mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-black/[0.04] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.06]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[var(--glass-border-subtle)]">
              <PlusIcon size={14} strokeWidth={2.1} />
            </span>
            {t("addAgent", { defaultValue: "Add an agent" })}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
