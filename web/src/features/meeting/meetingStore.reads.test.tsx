// @vitest-environment happy-dom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Actor } from "../../types";
import { KnotsCommandPanels } from "./KnotsCommandPanels";
import { moderatorGet, useMeetingStore, type Harness } from "./meetingStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/ui/dialog", () => {
  const Content = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Content, DialogContent: Content, DialogTitle: Content, DialogDescription: Content };
});

const harness: Harness = { version: 9, skills: [{ name: "kept-skill", source: "local" }], history: [], protocol: "kept protocol" };
const fetchMock = vi.fn();

beforeEach(() => {
  useMeetingStore.setState(useMeetingStore.getInitialState(), true);
  useMeetingStore.setState({ harness, connected: true });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("moderator reads", () => {
  it("stores a successful harness response", async () => {
    const updated = { ...harness, version: 10 };
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(updated)));
    await useMeetingStore.getState().fetchHarness();
    expect(useMeetingStore.getState().harness).toEqual(updated);
  });

  it.each(["network", "unauthorized", "invalid JSON"])("preserves the last harness after %s failure", async (failure) => {
    fetchMock.mockImplementation(async () => {
      if (failure === "network") throw new Error("offline");
      if (failure === "unauthorized") return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
      return new Response("not JSON");
    });
    await expect(moderatorGet("/api/harness")).rejects.toThrow();
    await useMeetingStore.getState().fetchHarness();
    expect(useMeetingStore.getState().harness).toBe(harness);
    if (failure === "unauthorized") expect(useMeetingStore.getState().authRequired).toBe(true);
  });
});

describe("command panels with unavailable moderator data", () => {
  it.each(["usage", "status"] as const)("keeps monitor data and shows the %s read error", async (panel) => {
    const bucket = { requests: 12, input: 80, output: 15, cached: 0, cache_write: 0, thinking: 0 };
    fetchMock.mockImplementation(async (url: string) => {
      if (!String(url).includes(":18849/")) return new Response("unavailable", { status: 503 });
      const data = panel === "usage"
        ? { today: "2026-09-30", days: { "2026-09-30": { actors: { "codex-1": bucket }, models: {}, providers: {} } }, actor_providers: {}, notes: {}, rate_limits: {} }
        : { actors: { "codex-1": { running: true, phase: "thinking", model: "known-model" } } };
      return new Response(JSON.stringify(data));
    });
    useMeetingStore.getState().setPanel(panel);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(<KnotsCommandPanels actors={[{ id: "codex-1", enabled: true } as Actor]} />);
      });
      expect(container.textContent).toContain("moderator replied 503");
      const cells = Array.from(container.querySelectorAll("tbody td")).map((cell) => cell.textContent);
      if (panel === "usage") expect(cells.slice(1)).toEqual(["–", "12", "80", "15", "–"]);
      else expect(cells.slice(1)).toEqual(["statusRunning", "thinking", "known-model", "–"]);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
