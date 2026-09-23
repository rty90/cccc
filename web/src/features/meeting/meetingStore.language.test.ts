// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// A fake i18next: the store reads `language`, awaits `i18nReady` and subscribes to "languageChanged".
vi.mock("../../i18n", () => {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const i18n = {
    language: "zh-CN",
    isInitialized: true,
    on: (event: string, cb: (...args: unknown[]) => void) => {
      (listeners[event] ||= []).push(cb);
    },
    emit: (event: string, ...args: unknown[]) => {
      for (const cb of listeners[event] || []) cb(...args);
    },
    changeLanguage: async () => undefined,
  };
  return { default: i18n, i18nReady: Promise.resolve(i18n) };
});

type Listener = ((event: { data: string }) => void) | null;

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: Listener = null;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  close() {}
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

describe("meetingStore language sync", () => {
  const posts: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    posts.length = 0;
    window.localStorage.setItem("knots.moderatorToken", "t-test");
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") posts.push({ url: String(url), body: JSON.parse(String(init.body || "{}")) });
        return { ok: true, status: 200, json: async () => ({ ok: true, updates: {} }) };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("never pushes the page's language on a snapshot; pushes only a switch made at this page", async () => {
    const { useMeetingStore } = await import("./meetingStore");
    const { default: i18n } = (await import("../../i18n")) as unknown as { default: { emit: (event: string, ...args: unknown[]) => void } };
    useMeetingStore.getState().connect();
    await flush();
    const source = FakeEventSource.last;
    expect(source).not.toBeNull();
    source!.onopen?.();
    // The room writes English while this page shows Chinese: the page adopts that fact, it does not overrule it.
    source!.onmessage?.({ data: JSON.stringify({ type: "snapshot", language: "en", meetings: [], help: [], projects: [], lessons: [], log: [] }) });
    await flush();
    expect(useMeetingStore.getState().language).toBe("en");
    expect(posts.filter((p) => p.url.endsWith("/api/language"))).toEqual([]);

    // i18next re-announcing its own start language is not a switch either.
    i18n.emit("languageChanged", "zh-CN");
    await flush();
    expect(posts.filter((p) => p.url.endsWith("/api/language"))).toEqual([]);

    // The person switches the UI to Japanese: that is pushed, once.
    i18n.emit("languageChanged", "ja");
    await flush();
    const pushes = posts.filter((p) => p.url.endsWith("/api/language"));
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toMatchObject({ language: "ja" });
    expect(useMeetingStore.getState().language).toBe("ja");
  });
});
