/**
 * One colour per agent: the mockup's palette by runtime, a hashed hue for anything else. Returned as CSS colour
 * strings so avatars, names and bars tint through color-mix instead of a Tailwind class per actor.
 */
const HUE_BY_RUNTIME: Record<string, number> = {
  claude: 40,
  codex: 160,
  antigravity: 255,
  gemini: 255,
  kimi: 300,
  deepseek: 235,
  qwen: 325,
  opencode: 325,
  moderator: 70,
};

function hashHue(id: string): number {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 360;
}

function runtimeKey(actorId: string, runtime?: string | null, command?: string[] | null): string {
  const id = String(actorId || "").trim().toLowerCase();
  if (id === "knots-moderator" || id === "moderator") return "moderator";
  const rt = String(runtime || "").trim().toLowerCase();
  if (rt && rt !== "custom" && rt in HUE_BY_RUNTIME) return rt;
  const first = (String((command || [])[0] || "").split(/[\\/]/).pop() || "").toLowerCase();
  if (first in HUE_BY_RUNTIME) return first;
  const prefix = id.split(/[-_\d]/)[0] || "";
  return prefix in HUE_BY_RUNTIME ? prefix : rt || id;
}

export function agentHue(actorId: string, runtime?: string | null, command?: string[] | null): number {
  const key = runtimeKey(actorId, runtime, command);
  return HUE_BY_RUNTIME[key] ?? hashHue(String(actorId || "").toLowerCase());
}

export function agentColor(
  actorId: string,
  runtime: string | null | undefined,
  isDark: boolean,
  command?: string[] | null,
): string {
  const hue = agentHue(actorId, runtime, command);
  return isDark ? `oklch(0.76 0.12 ${hue})` : `oklch(0.56 0.15 ${hue})`;
}

/** Two-letter mark for the avatar: Cl, Cx, Ge, DS, Qw, Ki, K for the moderator. */
export function agentMonogram(actorId: string, title?: string | null, runtime?: string | null): string {
  const key = runtimeKey(actorId, runtime);
  if (key === "moderator") return "K";
  if (key === "codex") return "Cx";
  if (key === "deepseek") return "DS";
  const name = String(title || actorId || "").trim();
  if (!name) return "?";
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  if (!letters) return name.slice(0, 1).toUpperCase();
  if (letters.length >= 2 && /^[a-z]/i.test(letters)) return letters[0].toUpperCase() + letters[1].toLowerCase();
  return letters.slice(0, 1).toUpperCase();
}
