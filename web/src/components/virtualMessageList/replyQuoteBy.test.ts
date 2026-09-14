import { describe, expect, it } from "vitest";
import type { LedgerEvent } from "../../types";
import { getReplyQuoteBy } from "../virtualMessageListHelpers";

describe("getReplyQuoteBy", () => {
  const senders = new Map<string, string>([
    ["e1", "codex-1"],
    ["e2", "user"],
  ]);
  const event = (data: Record<string, unknown>): LedgerEvent =>
    ({ id: "e9", kind: "chat.message", by: "claude-1", ts: "2026-09-14T00:00:00Z", data }) as unknown as LedgerEvent;

  it("names the author of the message being answered", () => {
    expect(getReplyQuoteBy(event({ reply_to: "e1" }), senders)).toBe("codex-1");
    expect(getReplyQuoteBy(event({ reply_to: "e2" }), senders)).toBe("user");
  });

  it("is empty for a plain message or an unknown target", () => {
    expect(getReplyQuoteBy(event({}), senders)).toBe("");
    expect(getReplyQuoteBy(event({ reply_to: "gone" }), senders)).toBe("");
    expect(getReplyQuoteBy(undefined, senders)).toBe("");
  });
});
