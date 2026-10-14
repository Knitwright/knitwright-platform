import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/production/contract";
import { NO_RULES, rig } from "../fixtures/setup";
import { polkaStack } from "../fixtures/stacks";
import { boundsOf } from "../geometry/polygon";
import type { FillItem } from "../scene";

const r = rig(["48"]);
const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
const text = (extra: Record<string, unknown> = {}) => ({
  ...common,
  id: "sponsor-line",
  kind: "text",
  views: ["front"],
  text: "ACME",
  placement: { kind: "zone", zoneId: "sponsor" },
  offsetMm: { x: 0, y: 0 },
  heightMm: 40,
  rotationDeg: 0,
  colourId: "navy",
  ...extra,
});
const row = (patch: Partial<RosterRow> = {}): RosterRow => ({ name: "RIVERA", number: "9", sizeLabel: "48", cut: "mens", quantity: 1, ...patch });
const fills = (items: readonly unknown[], id: string) => (items as FillItem[]).filter((i) => i.kind === "fill" && i.layerId === id);

describe("text layer", () => {
  it("draws the text as outlines in its place, in its colour, and clears the pattern round it", async () => {
    const { scene, marks } = await r.scene(polkaStack([text()]), "48", "front");
    const drawn = fills(scene.items, "sponsor-line");
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.colour).toBe("#1b2a49");
    expect(marks.find((m) => m.layerId === "sponsor-line")?.inZone).toBe(true);
    const box = boundsOf(drawn[0]!.rings.flat());
    const across = Math.min(box.maxX - box.minX, box.maxY - box.minY);
    expect(across).toBeGreaterThan(39);
    expect(across).toBeLessThan(43); // round letters overshoot the capital height a little
  });

  it("steps text down to fit its place, and leaves it off, with a sentence, when it cannot fit", async () => {
    const wide = await r.scene(polkaStack([text({ text: "THE SPONSOR NAME LTD", heightMm: 60 })]), "48", "front");
    expect(wide.scene.issues.some((i) => /sponsor-line/.test(i.text) || /was made/.test(i.text) || /does not fit/.test(i.text))).toBe(true);
    const never = await r.scene(polkaStack([text({ text: "A VERY LONG SPONSOR LINE THAT CANNOT FIT", heightMm: 60 })]), "48", "front");
    expect(fills(never.scene.items, "sponsor-line")).toHaveLength(0);
    expect(never.scene.issues.some((i) => i.severity === "stop")).toBe(true);
  });

  it("works on a free anchor and turned, warns about a colour with no screen colour, and about text under the minimum", async () => {
    const free = text({ placement: { kind: "anchor", anchorId: "centre-chest" }, rotationDeg: 90, colourId: undefined, heightMm: 10 });
    const { scene } = await r.scene(polkaStack([free]), "48", "front", { rules: { ...NO_RULES, minTextHeightMm: 20 } });
    expect(fills(scene.items, "sponsor-line")).toHaveLength(1);
    expect(scene.issues.some((i) => /under the smallest/.test(i.text))).toBe(true);
    const unset = polkaStack([text()], {});
    const noScreen = { ...unset, colours: unset.colours.map((c) => (c.id === "navy" ? { ...c, screen: undefined } : c)) };
    expect((await r.scene(noScreen, "48", "front")).scene.issues.some((i) => /has no screen colour/.test(i.text))).toBe(true);
  });

  it("leaves text off when its place is not on the garment", async () => {
    const { scene } = await r.scene(polkaStack([text({ placement: { kind: "zone", zoneId: "nowhere" } })]), "48", "front");
    expect(fills(scene.items, "sponsor-line")).toHaveLength(0);
    expect(scene.issues.some((i) => /not one this garment has/.test(i.text))).toBe(true);
  });
});

describe("player marks", () => {
  it("clears the place and draws nothing without a player, and says where the names are", async () => {
    const { scene } = await r.scene(polkaStack(), "48", "back");
    expect(fills(scene.items, "back-name")).toHaveLength(0);
    expect(scene.noteLines).toContain("Names and numbers are in the player files.");
  });

  it("draws a player's name and number at their heights", async () => {
    const { scene } = await r.scene(polkaStack(), "48", "back", { player: row() });
    expect(fills(scene.items, "back-name")).toHaveLength(1);
    expect(fills(scene.items, "back-number")).toHaveLength(1);
    expect(scene.playerLabel).toBe("RIVERA 9");
    const number = boundsOf(fills(scene.items, "back-number")[0]!.rings.flat());
    expect(Math.min(number.maxX - number.minX, number.maxY - number.minY)).toBeGreaterThan(100);
  });

  it("draws only the number for a player with no name, and nothing for a place the layout has no zone for", async () => {
    const { scene } = await r.scene(polkaStack(), "48", "back", { player: row({ name: "" }) });
    expect(fills(scene.items, "back-name")).toHaveLength(0);
    expect(scene.playerLabel).toBe("9");
    const leg = { ...common, id: "leg", kind: "player-mark", views: ["front"], place: "leg-number", colourId: "navy" };
    const odd = await r.scene(polkaStack([leg]), "48", "front", { player: row() });
    expect(odd.scene.issues.some((i) => /no place for/.test(i.text))).toBe(true);
  });

  it("applies league rules to the number and warns about a colour with no screen colour", async () => {
    const rules = { ...NO_RULES, numberRules: { minHeightMm: 300, maxHeightMm: 400, allowedDigits: "30", source: "League A" } };
    const { scene } = await r.scene(polkaStack(), "48", "back", { player: row({ number: "31" }), rules });
    expect(scene.issues.filter((i) => /League A/.test(i.text))).toHaveLength(2);
  });

  it("builds a transfer-only set of just the marks that are transfers", async () => {
    const base = polkaStack();
    const marks = { ...base, layers: base.layers.map((l) => (l.kind === "player-mark" ? { ...l, technique: "transfer" as const } : l)) };
    const { scene } = await r.scene(marks, "48", "back", { player: row(), transferOnly: true });
    expect(scene.items.every((i) => i.layerId === "back-name" || i.layerId === "back-number")).toBe(true);
    expect(fills(scene.items, "ground")).toHaveLength(0);
  });
});
