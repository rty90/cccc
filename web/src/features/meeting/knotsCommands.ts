import { KNOTS_TIERS, parseKnotsArgs } from "../../utils/knotsSlashCommands";
import { traceBaseUrl } from "../trace/traceStore";
import { moderatorHeaders, moderatorPost, useMeetingStore } from "./meetingStore";

export type KnotsCommandResult = { ok: true; notice?: string } | { ok: false; error: string };

type Translate = (key: string, options?: Record<string, unknown>) => string;

type ActorAction = "enable" | "disable" | "onboard" | "handoff";

const ACTOR_ACTIONS: Record<string, ActorAction> = {
  online: "enable",
  offline: "disable",
  onboard: "onboard",
  handoff: "handoff",
};

/**
 * Runs one of the room's slash commands. Panels and sidebar tabs open through the meeting store; everything else is a
 * moderator or monitor request. Errors come back as text for the composer's error line; nothing throws.
 */
export async function runKnotsCommand(name: string, args: string, t: Translate): Promise<KnotsCommandResult> {
  const store = useMeetingStore.getState();
  const parsed = parseKnotsArgs(args);
  switch (name) {
    case "usage":
      store.setPanel("usage");
      return { ok: true };
    case "status":
      store.setPanel("status");
      return { ok: true };
    case "meetings":
      store.setSidebar(true, "meetings");
      return { ok: true };
    case "projects":
      store.setSidebar(true, "projects");
      return { ok: true };
    case "rules":
      store.setSidebar(true, "harness");
      return { ok: true };
    case "log":
      store.setSidebar(true, "log");
      return { ok: true };
    case "meeting": {
      if (!parsed.text) return { ok: false, error: t("knotsCmdNeedText") };
      const r = await moderatorPost<{ ok: boolean; error?: string; meeting?: { id: string } }>("/api/meetings", {
        topic: parsed.text,
        brief: "",
        participants: [],
        mode: "agents",
      });
      if (!r.ok) return { ok: false, error: r.error || t("meetingStartFailed") };
      store.setSidebar(true, "meetings");
      return { ok: true, notice: t("popupMeetingOpened", { id: r.meeting?.id || "" }) };
    }
    case "project": {
      if (!parsed.text) return { ok: false, error: t("knotsCmdNeedText") };
      const r = await moderatorPost<{ ok: boolean; error?: string; project?: { id: string } }>("/api/projects", {
        title: parsed.text,
        brief: "",
      });
      if (!r.ok) return { ok: false, error: r.error || t("projectCreateFailed") };
      store.setSidebar(true, "projects");
      return { ok: true, notice: t("knotsCmdProjectOpened", { id: r.project?.id || "" }) };
    }
    case "lesson": {
      if (!parsed.text) return { ok: false, error: t("knotsCmdNeedText") };
      const r = await moderatorPost<{ ok: boolean; error?: string; lesson?: { id: string } }>("/api/lessons", {
        principle: parsed.text,
        why: "",
        apply: "",
      });
      if (!r.ok) return { ok: false, error: r.error || t("lessonRuleFailed") };
      return { ok: true, notice: t("knotsCmdLessonSaved", { id: r.lesson?.id || "" }) };
    }
    case "online":
    case "offline":
    case "onboard":
    case "handoff": {
      if (!parsed.actor) return { ok: false, error: t("knotsCmdNeedActor") };
      const action = ACTOR_ACTIONS[name];
      const r = await moderatorPost<{ ok: boolean; error?: string }>(`/api/actors/${encodeURIComponent(parsed.actor)}/${action}`, {});
      if (!r.ok) return { ok: false, error: r.error || t("knotsCmdUnknownActor", { actor: parsed.actor }) };
      return { ok: true, notice: t("knotsCmdActorDone", { actor: parsed.actor, action: t(`slashKnots_${name}`) }) };
    }
    case "tier": {
      if (!parsed.actor) return { ok: false, error: t("knotsCmdNeedActor") };
      const tier = String(parsed.words[1] || "").toLowerCase();
      if (!(KNOTS_TIERS as readonly string[]).includes(tier)) return { ok: false, error: t("knotsCmdTierValues") };
      // One actor only: the moderator merges tiers, so nobody else's tier is touched (a read that failed here once
      // sent an almost empty table and reset everyone).
      const r = await moderatorPost<{ ok: boolean; error?: string }>("/api/policy", { tiers: { [parsed.actor]: tier } });
      if (!r.ok) return { ok: false, error: r.error || t("knotsCmdUnknownActor", { actor: parsed.actor }) };
      return { ok: true, notice: t("knotsCmdTierSet", { actor: parsed.actor, tier }) };
    }
    case "model": {
      if (!parsed.actor) return { ok: false, error: t("knotsCmdNeedActor") };
      const model = String(parsed.words[1] || "");
      if (!model) return { ok: false, error: t("knotsCmdNeedModel") };
      const effort = String(parsed.words[2] || "");
      try {
        const response = await fetch(`${traceBaseUrl()}/api/switch`, {
          method: "POST",
          headers: moderatorHeaders(),
          body: JSON.stringify({ actor: parsed.actor, model, effort }),
        });
        const r = (await response.json()) as { ok?: boolean; error?: string; log?: string[] };
        if (!r.ok) return { ok: false, error: r.error || (r.log || []).join(" ") || t("switchFailed") };
        return { ok: true, notice: t("knotsCmdSwitched", { actor: parsed.actor, model }) };
      } catch (error) {
        return { ok: false, error: `${t("switchFailed")}: ${String(error)}` };
      }
    }
    case "style": {
      const style = String(parsed.words[0] || "").toLowerCase();
      if (style !== "flat" && style !== "cards") return { ok: false, error: t("knotsCmdStyleValues") };
      store.setMessageStyle(style);
      return { ok: true, notice: t("knotsCmdStyleSet", { style }) };
    }
    default:
      return { ok: false, error: t("knotsCmdUnknown", { name }) };
  }
}
