// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { HumanRulingForm } from "./HumanRuling";
import * as store from "./meetingStore";
import type { Meeting, Vote } from "./meetingStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./meetingStore", () => ({ moderatorPost: vi.fn() }));

const vote = { id: "v1", options: ["A", "B"], result: { winner: "A", counts: { A: 2, B: 1 } } } as unknown as Vote;
const meeting = { id: "m1", status: "voting" } as unknown as Meeting;

function keydown(target: Element, init: KeyboardEventInit & { keyCode?: number }) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: init.key });
  // happy-dom may not take these from the init dictionary; own properties shadow the prototype getters either way.
  if (init.isComposing !== undefined) Object.defineProperty(event, "isComposing", { value: init.isComposing });
  if (init.keyCode !== undefined) Object.defineProperty(event, "keyCode", { value: init.keyCode });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe("HumanRulingForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(store.moderatorPost).mockReset();
    vi.mocked(store.moderatorPost).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not submit the ruling on the Enter that confirms an IME candidate", async () => {
    act(() => {
      root.render(<HumanRulingForm vote={vote} meeting={meeting} isDark={false} />);
    });
    const input = container.querySelector("input[placeholder]") as HTMLInputElement;
    expect(input).not.toBeNull();

    keydown(input, { key: "Enter", isComposing: true });
    keydown(input, { key: "Enter", keyCode: 229 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.moderatorPost).not.toHaveBeenCalled();

    keydown(input, { key: "Enter" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.moderatorPost).toHaveBeenCalledTimes(1);
    expect(store.moderatorPost).toHaveBeenCalledWith("/api/votes/v1/human", { option: "A", reason: "", close_meeting: true });
  });
});
