import { describe, expect, it } from "vitest";
import { KNOTS_SLASH_COMMANDS, parseKnotsArgs } from "../../utils/knotsSlashCommands";
import { buildSlashCommands, filterSlashCommands, parseSlashCommandInput, slashCommandDisplayKind } from "../../utils/slashCommands";

describe("knots slash commands", () => {
  it("are listed with CCCC's commands, tagged as room commands, and parse back from the composer text", () => {
    const commands = buildSlashCommands({ state: null, includeRoomCommands: true });
    expect(buildSlashCommands({ state: null }).some((c) => c.sourceType === "knots_command")).toBe(false);
    const names = commands.filter((c) => c.sourceType === "knots_command").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(KNOTS_SLASH_COMMANDS.map((c) => c.name)));
    const usage = commands.find((c) => c.name === "usage");
    expect(usage?.command).toBe("/usage");
    expect(usage && slashCommandDisplayKind(usage)).toBe("room");
    expect(commands[0].sourceType).toBe("builtin_command");
    const parsed = parseSlashCommandInput("/tier qwen-1 reserve", commands);
    expect(parsed?.item.name).toBe("tier");
    expect(parsed?.argsText).toBe("qwen-1 reserve");
    expect(filterSlashCommands(commands, "/mo").map((c) => c.name)).toContain("model");
  });

  it("splits the actor and the words of an argument string", () => {
    expect(parseKnotsArgs("  qwen-1   qwen3.8-flash high ")).toEqual({ actor: "qwen-1", words: ["qwen-1", "qwen3.8-flash", "high"], text: "qwen-1   qwen3.8-flash high" });
    expect(parseKnotsArgs("")).toEqual({ actor: "", words: [], text: "" });
  });

  it("keeps command names unique", () => {
    const names = KNOTS_SLASH_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
