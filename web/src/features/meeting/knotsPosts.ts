import type { RailFocus } from "./meetingStore";

/**
 * The moderator's own posts in the chat. Meeting kickoffs, vote cards, decisions and project rounds
 * reach the participants as the human ("user"); notices and lesson candidates come back to the human
 * as "knots-moderator". Both are rendered as one compact row (kind · id · first line, two lines of
 * summary) instead of a full bubble, so the room's bookkeeping stops competing with the discussion.
 * Agents' own tagged messages ([VOTE REQUEST], [LESSON], [HELP] without an id) are conversation and
 * stay bubbles; so does anything the human types that merely starts with a bracket.
 */
export const MODERATOR_BY = "knots-moderator";

export type KnotsPostKind =
  | "meeting"
  | "vote"
  | "decision"
  | "project"
  | "task"
  | "lesson"
  | "notice"
  | "stop"
  | "retro"
  | "review"
  | "help";

export type KnotsPost = {
  kind: KnotsPostKind;
  id: string;
  tag: string;
  title: string;
  summary: string;
  /** Addressed to the human only (sent as knots-moderator); the agents never see it. */
  system: boolean;
};

const KINDS: Record<string, KnotsPostKind> = {
  CONFERENCE: "meeting",
  VOTE: "vote",
  DECISION: "decision",
  PROJECT: "project",
  TASK: "task",
  LESSON: "lesson",
  NOTICE: "notice",
  STOP: "stop",
  RETRO: "retro",
  REVIEW: "review",
  HELP: "help",
};

const HEAD =
  /^\[(CONFERENCE|VOTE|DECISION|PROJECT|TASK|LESSON|NOTICE|STOP|RETRO|REVIEW|HELP)(?:\s+#([A-Za-z0-9_-]+))?([^\]]*)\]\s*/;

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseKnotsPost(by: string, text: string): KnotsPost | null {
  const sender = String(by || "").trim();
  const body = String(text || "").trim();
  if (!body) return null;
  const system = sender === MODERATOR_BY;
  if (!system && sender !== "user") return null;
  const match = HEAD.exec(body);
  if (!match) {
    if (!system) return null;
    const parts = lines(body);
    return { kind: "notice", id: "", tag: "", title: parts[0] || "", summary: parts.slice(1).join(" "), system };
  }
  const kind = KINDS[match[1]];
  const id = String(match[2] || "").trim();
  // A bracketed message from the human without an id is their own text; the moderator always numbers
  // its posts, except the [NOTICE] broadcasts it sends to the agents on the human's behalf.
  if (!system && !id && kind !== "notice") return null;
  const parts = lines(body.slice(match[0].length));
  return {
    kind,
    id,
    tag: String(match[3] || "").trim(),
    title: parts[0] || "",
    summary: parts.slice(1).join(" "),
    system,
  };
}

/** Where "view" lands in the rail for a post, when the post is about something the rail can show. */
export function knotsPostFocus(post: KnotsPost): RailFocus | null {
  if (!post.id) return null;
  switch (post.kind) {
    case "meeting":
    case "decision":
    case "stop":
    case "retro":
      return { kind: "meeting", id: post.id };
    case "vote":
      return { kind: "vote", id: post.id };
    case "project":
      return { kind: "project", id: post.id };
    case "lesson":
      return { kind: "lesson", id: post.id };
    case "help":
      return { kind: "help", id: post.id };
    default:
      return null;
  }
}
