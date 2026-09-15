/**
 * The room's own slash commands (Knots moderator + trace monitor), listed next to CCCC's builtin ones.
 * Only things the room already does: no command here invents a feature.
 */
export type KnotsCommandName =
  | "usage"
  | "status"
  | "meeting"
  | "project"
  | "lesson"
  | "offline"
  | "online"
  | "onboard"
  | "handoff"
  | "tier"
  | "model"
  | "meetings"
  | "projects"
  | "rules"
  | "log"
  | "style";

export const KNOTS_SLASH_COMMANDS: Array<{ name: KnotsCommandName; usage: string }> = [
  { name: "usage", usage: "" },
  { name: "status", usage: "" },
  { name: "meeting", usage: "<topic>" },
  { name: "project", usage: "<title>" },
  { name: "lesson", usage: "<principle>" },
  { name: "model", usage: "<actor> <model> [effort]" },
  { name: "tier", usage: "<actor> debate|review|both|reserve" },
  { name: "offline", usage: "<actor>" },
  { name: "online", usage: "<actor>" },
  { name: "onboard", usage: "<actor>" },
  { name: "handoff", usage: "<actor>" },
  { name: "meetings", usage: "" },
  { name: "projects", usage: "" },
  { name: "rules", usage: "" },
  { name: "log", usage: "" },
  { name: "style", usage: "flat|cards" },
];

export const KNOTS_TIERS = ["debate", "review", "both", "reserve"] as const;

export type ParsedKnotsArgs = { actor: string; words: string[]; text: string };

export function parseKnotsArgs(args: string): ParsedKnotsArgs {
  const text = String(args || "").trim();
  const words = text ? text.split(/\s+/) : [];
  return { actor: words[0] || "", words, text };
}
