import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { buildSeedTemplates } from "@/lib/templates/seed/build";
import { rowOf } from "@/lib/templates/seed/seed";
import { PANEL_KINDS, loadPanelTemplates, tagsOf, templatesView } from "./templates";

/**
 * The templates panel's own read and filter (plan v5, decision 0106).
 *
 * Two things matter most here, and both are proved rather than asserted in a comment: the read
 * names the kinds it can draw a card for, so a row of another kind can never reach a card that
 * would misread it; and the search and the filters are L8's own `matchesTags` and `matchesSearch`,
 * so there is one filter in the codebase and not two that can disagree.
 */

const seeds = buildSeedTemplates();
const ids = (at: number): string => `1111111${at}-1111-4111-8111-111111111111`;
const stored = (at: number) => ({ id: ids(at % 10), attribution: null, ...rowOf(seeds[at]!) });

/** A read that answers with rows and keeps what it was narrowed to, as `lib/templates` does. */
function readClient(rows: readonly unknown[], error: { message: string } | null = null) {
  const narrowed: { column: string; values: unknown }[] = [];
  const query = {
    select: () => query,
    order: () => query,
    in: (column: string, values: unknown) => (narrowed.push({ column, values }), query),
    limit: async () => ({ data: rows, error }),
  };
  return { client: { from: () => query } as unknown as SupabaseClient, narrowed };
}

const noFilters = { text: "", tags: {} };

describe("reading the library for the panel", () => {
  it("asks for the kinds a card can be drawn from, and no others", async () => {
    const { client, narrowed } = readClient([stored(0)]);
    await loadPanelTemplates(client);
    expect(narrowed).toEqual([{ column: "kind", values: [...PANEL_KINDS] }]);
    expect(PANEL_KINDS).toEqual(["design"]);
  });

  it("turns a row into a card with its garment, its review label and no design", async () => {
    const [first] = await loadPanelTemplates(readClient([stored(0)]).client);
    expect(first?.card.title).toBe(seeds[0]!.title);
    expect(first?.card.slug).toBe(seeds[0]!.slug);
    expect(first?.card.articleLabel.length).toBeGreaterThan(0);
    expect(first?.card.reviewLabel).toContain("not reviewed");
    expect(first?.card).not.toHaveProperty("snapshot");
  });

  /**
   * Seven of the eight launch articles publish no point of measure and no block (decision 0090),
   * so most starters carry a gap. A card must say it rather than looking ready to make.
   */
  it("says on the card what the article behind it has no data for, with that article's own rule", async () => {
    const many = seeds.slice(0, 40).map((_, at) => stored(at));
    const cards = (await loadPanelTemplates(readClient(many).client)).map((entry) => entry.card);
    const withGap = cards.filter((card) => card.gap !== null);
    expect(withGap.length).toBeGreaterThan(0);
    for (const card of withGap) {
      expect(card.gap?.ruleId).toMatch(/^R-[A-Z]{3}-\w+$/);
      expect(card.gap?.line).toContain("No measurement on file");
    }
  });

  it("reports a failed read, and a row it cannot read, as a fault rather than an empty panel", async () => {
    await expect(loadPanelTemplates(readClient([], { message: "boom" }).client)).rejects.toBeInstanceOf(AppError);
    await expect(loadPanelTemplates(readClient([{ id: "not an id" }]).client)).rejects.toBeInstanceOf(AppError);
  });

  it("keeps a row whose tag column holds a value the vocabulary does not, rather than going blank", async () => {
    const odd = { ...stored(0), era_tags: ["who-knows"], mood_tags: ["who-knows"], sport_tags: ["who-knows"] };
    const [only] = await loadPanelTemplates(readClient([odd]).client);
    expect(only?.tags.era).toEqual([]);
    expect(only?.tags.mood).toEqual([]);
    expect(only?.tags.sport).toEqual([]);
  });

  it("files a row with no sport group under the sport column's own name", async () => {
    const general = { ...stored(0), sport: "general" as const, sport_tags: [] };
    const [only] = await loadPanelTemplates(readClient([general]).client);
    expect(only?.card.collection).toBe("Club and team wear");
  });
});

describe("the tags one row carries", () => {
  it("are the five groups of 07, read from the row's own columns", () => {
    const tags = tagsOf(stored(0));
    expect(Object.keys(tags).sort()).toEqual(["colour", "era", "mood", "sport", "style"]);
    expect(tags.style.length).toBeGreaterThan(0);
    expect(tags.colour).toBe(seeds[0]!.colourFamily);
  });
});

describe("the view the panel is handed", () => {
  it("holds every card when nothing is asked for, and says how many there are in all", async () => {
    const all = await loadPanelTemplates(readClient([stored(0), stored(1), stored(2)]).client);
    const view = templatesView(all, noFilters);
    expect(view.cards).toHaveLength(3);
    expect(view.total).toBe(3);
    expect(view.kinds).toEqual(["design"]);
  });

  it("narrows on each group it offers, and counts each choice against the other groups", async () => {
    const all = await loadPanelTemplates(readClient([stored(0), stored(1), stored(2), stored(3)]).client);
    const view = templatesView(all, noFilters);
    const sport = view.filters.find((group) => group.group === "sport");
    expect(sport?.label).toBe("Sport");
    const chosen = sport!.choices[0]!;
    const narrowed = templatesView(all, { text: "", tags: { sport: chosen.id } });
    expect(narrowed.cards).toHaveLength(chosen.count);
    expect(narrowed.total).toBe(4);
  });

  it("offers no chip that could only ever show nothing", async () => {
    const all = await loadPanelTemplates(readClient([stored(0)]).client);
    for (const group of templatesView(all, noFilters).filters) {
      expect(group.choices.length).toBeGreaterThan(0);
      for (const choice of group.choices) expect(choice.count).toBeGreaterThan(0);
    }
  });

  it("finds a template by a word of its title and by the words of one of its tags", async () => {
    const all = await loadPanelTemplates(readClient([stored(0), stored(1)]).client);
    const word = seeds[0]!.title.split(" ")[0]!;
    expect(templatesView(all, { text: word, tags: {} }).cards.length).toBeGreaterThan(0);
    expect(templatesView(all, { text: "a word no starter has anywhere", tags: {} }).cards).toEqual([]);
  });

  it("shows nothing for a filter value the vocabulary does not hold, so a mistyped address is honest", async () => {
    const all = await loadPanelTemplates(readClient([stored(0), stored(1)]).client);
    expect(templatesView(all, { text: "", tags: { colour: "tartan" } }).cards).toEqual([]);
  });
});
