// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ModelSwitchPopover } from "./ModelSwitchPopover";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../meeting/meetingStore", () => ({ moderatorHeaders: () => ({}) }));

// The real popover is a Radix portal; this stand-in renders the content whenever `open` is true and exposes the
// open callback, which is all the component logic under test needs.
vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  const OpenContext = React.createContext(false);
  type Props = { open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode };
  return {
    Popover: ({ open, onOpenChange, children }: Props) => {
      (globalThis as { __openPopover?: (open: boolean) => void }).__openPopover = onOpenChange;
      return React.createElement(OpenContext.Provider, { value: Boolean(open) }, children);
    },
    PopoverTrigger: ({ children }: Props) => React.createElement(React.Fragment, null, children),
    PopoverContent: ({ children }: Props) =>
      React.useContext(OpenContext) ? React.createElement("div", { "data-testid": "content" }, children) : null,
  };
});

type Actor = { model: string; effort: string; runtime: string; switching: unknown; last_switch: unknown };

describe("ModelSwitchPopover", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();
  const actor: Actor = { model: "gpt-5.5", effort: "", runtime: "codex", switching: null, last_switch: null };
  const presets = { codex: { models: [{ id: "gpt-5.5", label: "GPT-5.5" }, { id: "gpt-6-astra", label: "GPT-6 Astra" }], efforts: ["low", "high"] } };

  const flush = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

  const open = async () => {
    act(() => {
      root.render(
        <ModelSwitchPopover actorId="codex-1" runtime="codex" label="codex-1" isDark={false}>
          <button type="button">avatar</button>
        </ModelSwitchPopover>,
      );
    });
    act(() => {
      (globalThis as { __openPopover?: (open: boolean) => void }).__openPopover?.(true);
    });
    await flush();
  };

  const clickButton = async (text: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((b) => (b.textContent || "").includes(text));
    expect(button, text).toBeDefined();
    act(() => {
      button!.click();
    });
    await flush();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(actor, { model: "gpt-5.5", effort: "", switching: null, last_switch: null });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/api/switch")) return { json: async () => ({ ok: true, async: true, op: "op1", log: ["queued"] }) };
      return { json: async () => ({ presets, actors: { "codex-1": { ...actor } } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("treats the queued reply as queued and marks the model current only on the reported outcome", async () => {
    await open();
    await clickButton("GPT-6 Astra");
    await clickButton("switchApply");
    expect(container.textContent).toContain("switchQueued");
    expect(container.textContent).toContain("· gpt-5.5");
    expect(container.textContent).not.toContain("· gpt-6-astra");
    expect(container.textContent).not.toContain("switchDone");

    actor.switching = { op: "op1", stage: "restarting" };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(container.textContent).toContain("switchStageRestarting");
    expect(container.textContent).toContain("· gpt-5.5");

    actor.switching = null;
    actor.last_switch = { op: "op1", ok: true, model: "gpt-6-astra", effort: "high" };
    actor.model = "gpt-6-astra";
    actor.effort = "high";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(container.textContent).toContain("switchDone");
    expect(container.textContent).toContain("· gpt-6-astra · high");
  });

  it("reports a switch that failed after it was queued", async () => {
    await open();
    await clickButton("GPT-6 Astra");
    await clickButton("switchApply");
    actor.last_switch = { op: "op1", ok: false, error: "update rc=1 no such actor" };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(container.textContent).toContain("switchFailed: update rc=1 no such actor");
    expect(container.textContent).toContain("· gpt-5.5");
    expect(container.textContent).not.toContain("switchDone");
  });

  it("shows the new model with the failure when the restart worked but the onboarding was refused", async () => {
    await open();
    await clickButton("GPT-6 Astra");
    await clickButton("switchApply");
    actor.last_switch = { op: "op1", ok: false, restarted: true, onboarding: "failed", error: "restarted with gpt-6-astra, but onboarding was refused: down" };
    actor.model = "gpt-6-astra";
    actor.effort = "high";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(container.textContent).toContain("switchFailed: restarted with gpt-6-astra, but onboarding was refused: down");
    expect(container.textContent).toContain("· gpt-6-astra · high");
    expect(container.textContent).not.toContain("switchDone");
  });

  it("shows a switch that is already running when it opens", async () => {
    actor.switching = { op: "op0", stage: "handoff" };
    await open();
    expect(container.textContent).toContain("switchStageHandoff");
    const apply = Array.from(container.querySelectorAll("button")).find((b) => (b.textContent || "").includes("switchApply"));
    expect(apply?.disabled).toBe(true);
  });
});
