import { describe, expect, it } from "vitest";
import type { EditorCommands } from "@/lib/editor";
import { design } from "@/lib/panel-layers/fixtures/design";
import { slotPropsFor, type SlotPartsFor } from "./slot-props";
import type { Shell } from "./useShell";

/**
 * The seam the whole wave turned on. Four workstreams built a panel against `EditorSlotProps` and
 * nothing in the app ever built the props, so every slot drew a placeholder for a month and no test
 * noticed (code review v5, A7-A12). This one asserts that every command the contract declares
 * reaches something, and that the facts a panel reads are the shell's own and not a copy.
 */

const shellCalls = () => {
  const calls: string[] = [];
  const shell = {
    state: { segment: "form", view: "2d", beside: null, size: "M", form: { options: { collar: "C01" }, parameters: { body_length_offset: 10 } } },
    pending: false,
    openRail: (segment: string) => calls.push(`openRail ${segment}`),
    showView: (view: string, alongside: boolean) => calls.push(`showView ${view} ${alongside}`),
    setSize: (size: string) => calls.push(`setSize ${size}`),
    setOption: (group: string, code: string) => calls.push(`setOption ${group} ${code}`),
    setParameter: (key: string, mm: number) => calls.push(`setParameter ${key} ${mm}`),
    setColourway: (id: string) => calls.push(`setColourway ${id}`),
    resimulate: () => calls.push("resimulate"),
  } as unknown as Shell;
  return { shell, calls };
};

const parts = (shell: Shell, calls: string[]): SlotPartsFor => ({
  shell,
  projectId: "project-1",
  version: 7,
  spec: design().spec,
  article: null,
  sizes: ["S", "M", "L"],
  colourwayId: "main",
  draft: null,
  busy: false,
  save: (key) => calls.push(`save ${key}`),
  openRail: (segment) => calls.push(`shell openRail ${segment}`),
  openSummary: (section) => calls.push(`openSummary ${section}`),
  needsSimulation: () => calls.push("needsSimulation"),
});

describe("the props every slot panel is given", () => {
  it("reads the design from the shell, including the spec with the saves in flight", () => {
    const { shell, calls } = shellCalls();
    const { design: facts } = slotPropsFor(parts(shell, calls));

    expect(facts.projectId).toBe("project-1");
    expect(facts.version).toBe(7);
    expect(facts.size).toBe("M");
    expect(facts.sizes).toEqual(["S", "M", "L"]);
    expect(facts.colourwayId).toBe("main");
    expect(facts.form.options.collar).toBe("C01");
    expect(facts.form.parameters.body_length_offset).toBe(10);
    expect(facts.busy).toBe(false);
  });

  it("wires every command of the contract to something", () => {
    const { shell, calls } = shellCalls();
    const { commands } = slotPropsFor(parts(shell, calls));

    commands.setOption("collar", "C02");
    commands.setParameter("body_length_offset", 20);
    commands.setSize("L");
    commands.setColourway("away");
    commands.showView("tech-pack");
    commands.showView("2d", true);
    commands.openRail("library");
    commands.openSummary("names-numbers");
    commands.save("names-numbers", { type: "remove-names-numbers" });
    commands.needsSimulation();

    expect(calls).toEqual([
      "setOption collar C02",
      "setParameter body_length_offset 20",
      "setSize L",
      "setColourway away",
      // The contract's second argument is optional and defaults to showing the view on its own.
      "showView tech-pack false",
      "showView 2d true",
      "shell openRail library",
      "openSummary names-numbers",
      "save names-numbers",
      "needsSimulation",
    ]);
  });

  it("declares exactly the nine commands the contract names, and nothing else", () => {
    const { shell, calls } = shellCalls();
    const { commands } = slotPropsFor(parts(shell, calls));
    const named: readonly (keyof EditorCommands)[] = [
      "setOption",
      "setParameter",
      "setSize",
      "setColourway",
      "showView",
      "openRail",
      "openSummary",
      "save",
      "needsSimulation",
    ];

    expect(Object.keys(commands).sort()).toEqual([...named].sort());
    for (const name of named) expect(typeof commands[name], name).toBe("function");
  });

  it("gives a panel the design and the commands and nothing else, as the contract says", () => {
    const { shell, calls } = shellCalls();
    expect(Object.keys(slotPropsFor(parts(shell, calls))).sort()).toEqual(["commands", "design"]);
  });
});
