import { describe, expect, it } from "vitest";
import { knotsPostFocus, parseKnotsPost } from "./knotsPosts";

describe("parseKnotsPost", () => {
  it("turns a meeting kickoff sent as the human into a meeting post", () => {
    const post = parseKnotsPost("user", "[CONFERENCE #7] Cache the model list\n\nBrief: it is fetched on every render.\nMode: agents");
    expect(post).toMatchObject({ kind: "meeting", id: "7", tag: "", title: "Cache the model list", system: false });
    expect(post?.summary).toBe("Brief: it is fetched on every render. Mode: agents");
    expect(knotsPostFocus(post!)).toEqual({ kind: "meeting", id: "7" });
  });

  it("keeps the tag of a vote result and points at the vote", () => {
    const post = parseKnotsPost("user", "[VOTE #3 RESULT] adopt 4, reject 1. adopt wins.");
    expect(post).toMatchObject({ kind: "vote", id: "3", tag: "RESULT" });
    expect(knotsPostFocus(post!)).toEqual({ kind: "vote", id: "3" });
  });

  it("treats everything from knots-moderator as a system post, bracketed or not", () => {
    expect(parseKnotsPost("knots-moderator", "[NOTICE] claude has an update: 1 -> 2")).toMatchObject({ kind: "notice", id: "", system: true });
    expect(parseKnotsPost("knots-moderator", "plain words\nmore")).toMatchObject({ kind: "notice", title: "plain words", summary: "more", system: true });
    expect(parseKnotsPost("knots-moderator", "[LESSON #2] candidate from codex-1: measure first")).toMatchObject({ kind: "lesson", id: "2" });
  });

  it("leaves the agents' tagged conversation and the human's own bracketed text alone", () => {
    expect(parseKnotsPost("codex-1", "[VOTE REQUEST] should we cache it?")).toBeNull();
    expect(parseKnotsPost("claude-1", "[LESSON] PRINCIPLE: measure")).toBeNull();
    expect(parseKnotsPost("user", "[CONFERENCE] I mean the one from last week")).toBeNull();
    expect(parseKnotsPost("user", "hello")).toBeNull();
  });

  it("accepts the moderator's [NOTICE] broadcast sent on the human's behalf", () => {
    expect(parseKnotsPost("user", "[NOTICE] Output language switched to zh")).toMatchObject({ kind: "notice", id: "" });
  });
});
