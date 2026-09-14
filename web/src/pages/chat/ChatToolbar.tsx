import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, CloseIcon } from "../../components/Icons";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { KnotsSidebarToggle } from "../../features/meeting/KnotsSidebar";
import { useMeetingStore } from "../../features/meeting/meetingStore";
import type { ChatFilter } from "../../stores/useUIStore";
import type { Actor } from "../../types";
import { classNames } from "../../utils/classNames";
import type { LiveWorkCard } from "./liveWorkCards";
import { MembersMenu } from "./MembersMenu";

/**
 * The desktop chat toolbar, in the flow above the messages: members, the filter behind a button
 * (the active filter shows as a chip), the current goal, and the toggle for the right rail.
 * Nothing floats over the messages any more.
 */
function FilterMenu({
  isDark,
  chatFilter,
  onChange,
  options,
}: {
  isDark: boolean;
  chatFilter: ChatFilter;
  onChange: (filter: ChatFilter) => void;
  options: Array<[ChatFilter, string]>;
}) {
  const { t } = useTranslation("chat");
  const [open, setOpen] = useState(false);
  const activeLabel = chatFilter === "all" ? "" : options.find(([key]) => key === chatFilter)?.[1] || chatFilter;
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={classNames(
              "knots-press inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] font-medium",
              isDark ? "border-white/10 text-slate-200" : "border-black/10 text-gray-700",
              open ? (isDark ? "bg-white/[0.08] text-white" : "bg-black/[0.06] text-[rgb(35,36,37)]") : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
            )}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t("chatFilters")}
          >
            {t("filterButton")}
            <ChevronDownIcon size={13} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-44 p-1" role="menu" aria-label={t("chatFilters")}>
          {options.map(([key, label]) => {
            const active = chatFilter === key;
            return (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={classNames(
                  "knots-press flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px]",
                  active ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:bg-black/[0.04] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.06]",
                )}
              >
                {label}
                {active ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      {activeLabel ? (
        <span
          className={classNames(
            "inline-flex h-8 items-center gap-1 rounded-full pl-2.5 pr-1 text-[13px] font-medium",
            isDark ? "bg-violet-500/15 text-violet-200" : "bg-violet-500/10 text-violet-700",
          )}
        >
          {t("filterActive", { label: activeLabel })}
          <button
            type="button"
            className="knots-press flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/[0.08] dark:hover:bg-white/10"
            aria-label={t("filterClear")}
            title={t("filterClear")}
            onClick={() => onChange("all")}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ) : null}
    </div>
  );
}

function CurrentGoal() {
  const { t } = useTranslation("chat");
  const projects = useMeetingStore((state) => state.projects);
  const meetings = useMeetingStore((state) => state.meetings);
  const setSidebar = useMeetingStore((state) => state.setSidebar);
  const project = projects.slice().reverse().find((item) => item.status !== "adopted" && item.status !== "rejected" && item.status !== "stopped");
  const meeting = project ? undefined : meetings.slice().reverse().find((item) => item.status !== "closed");
  if (!project && !meeting) return null;
  const title = project ? project.title : meeting?.topic || "";
  const focus = project ? { kind: "project" as const, id: project.id } : { kind: "meeting" as const, id: meeting?.id || "" };
  return (
    <button
      type="button"
      className="knots-press hidden min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] text-[var(--color-text-secondary)] hover:bg-black/[0.04] hover:text-[var(--color-text-primary)] lg:inline-flex dark:hover:bg-white/[0.06]"
      onClick={() => setSidebar(true, "overview", focus)}
      title={title}
    >
      <span className="shrink-0 opacity-60">{t("railGoal")}</span>
      <span className="min-w-0 truncate font-medium">{title}</span>
    </button>
  );
}

export function ChatToolbar({
  isDark,
  groupId,
  runtimeActors,
  liveWorkCards,
  actorStatusProvisional,
  readOnly,
  onOpenRuntimeActor,
  onAddAgent,
  showFilters,
  chatFilter,
  onChangeFilter,
  filterOptions,
}: {
  isDark: boolean;
  groupId: string;
  runtimeActors: Actor[];
  liveWorkCards: LiveWorkCard[];
  actorStatusProvisional: boolean;
  readOnly?: boolean;
  onOpenRuntimeActor: (actorId: string) => void;
  onAddAgent?: () => void;
  showFilters: boolean;
  chatFilter: ChatFilter;
  onChangeFilter: (filter: ChatFilter) => void;
  filterOptions: Array<[ChatFilter, string]>;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--glass-border-subtle)] px-3 py-1.5 sm:px-4">
      <MembersMenu
        groupId={groupId}
        runtimeActors={runtimeActors}
        liveWorkCards={liveWorkCards}
        actorStatusProvisional={actorStatusProvisional}
        isDark={isDark}
        readOnly={readOnly}
        onOpenRuntimeActor={onOpenRuntimeActor}
        onAddAgent={onAddAgent}
      />
      {showFilters ? <FilterMenu isDark={isDark} chatFilter={chatFilter} onChange={onChangeFilter} options={filterOptions} /> : null}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <CurrentGoal />
      </div>
      <KnotsSidebarToggle isDark={isDark} />
    </div>
  );
}
