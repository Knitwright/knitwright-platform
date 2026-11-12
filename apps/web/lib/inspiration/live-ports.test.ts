import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildSeedTemplates } from "@/lib/templates/seed/build";
import { buildContextQuery } from "./context-query";
import {
  LIBRARY_UNSAVEABLE,
  articleContextFrom,
  brandMoodFrom,
  cardScreen,
  inspirationPorts,
  libraryTagsOf,
  templateLibraryFrom,
  type TemplateRow,
} from "./live-ports";
import { UNWIRED_ARTICLES, UNWIRED_INSPIRATION_PORTS, UNWIRED_LIBRARY, UNWIRED_MOOD, UNWIRED_SCREEN } from "./ports";
import { libraryProvider } from "./sources/library";
import { stubCard } from "./sources/stubs";

/**
 * The real ports of the inspiration board (plan v6 D4, decision 0135): the base article catalogue for the sport tags,
 * Brand Studio for the mood words, the template library for Knitwright's own cards, and moderation for card screening.
 * The database is a stand-in that answers the few queries the ports make; nothing reaches the network.
 */

type Answer = Readonly<{ data: unknown; error: unknown }>;
type Tables = Readonly<Record<string, { list?: unknown[]; single?: unknown; snapshots?: unknown[] }>>;

/** A stand-in Supabase client. Every chain call returns the chain; `await` gives the table's list, `maybeSingle` its row. */
function fakeClient(tables: Tables, fail: readonly string[] = []) {
  const asked: string[] = [];
  const client = {
    from(table: string) {
      let columns = "";
      const answer = (): Answer => {
        if (fail.includes(table)) return { data: null, error: { message: "down" } };
        const entry = tables[table] ?? {};
        return { data: columns.includes("snapshot") ? (entry.snapshots ?? []) : (entry.list ?? []), error: null };
      };
      const chain: Record<string, unknown> = {
        select: (cols: string) => ((columns = cols), asked.push(`${table}:${cols}`), chain),
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => (fail.includes(table) ? { data: null, error: { message: "down" } } : { data: tables[table]?.single ?? null, error: null }),
        then: (resolve: (value: Answer) => unknown) => Promise.resolve(answer()).then(resolve),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, asked };
}

const seeds = buildSeedTemplates();
const hoops = seeds.find((seed) => seed.styleTags.includes("hoops"))!;
const plain = seeds.find((seed) => seed.styleTags.includes("plain"))!;
const uuid = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;

const row = (n: number, seed: (typeof seeds)[number], over: Partial<TemplateRow> = {}): TemplateRow => ({
  id: uuid(n),
  slug: seed.slug,
  title: seed.title,
  sport: seed.sport,
  article_id: seed.articleId,
  style_tags: [...seed.styleTags],
  colour_family: seed.colourFamily,
  sport_tags: [],
  era_tags: [],
  mood_tags: [],
  ...over,
});

const query = (tags: Readonly<{ sports?: string[]; styleTags?: string[]; moodWords?: string[] }>) =>
  buildContextQuery({ sports: tags.sports ?? [], articleName: null, colourNames: [], styleTags: tags.styleTags ?? [], moodWords: tags.moodWords ?? [] });

describe("the article port", () => {
  it("gives the catalogue's name and sport tags for a garment type that maps to an article", async () => {
    const { client } = fakeClient({ base_articles: { single: { code: "JSY-SS-01", name: "Short sleeve jersey", sport_tags: ["football", "training"] } } });
    expect(await articleContextFrom(client).articleFor("team-jersey")).toEqual({ name: "Short sleeve jersey", sportTags: ["football", "training"] });
  });

  it("gives nothing for a type with no article, without asking the database", async () => {
    const { client, asked } = fakeClient({});
    expect(await articleContextFrom(client).articleFor("no-such-type")).toBeNull();
    expect(asked).toEqual([]);
  });

  it("gives nothing when the catalogue does not hold the article, or cannot be read", async () => {
    expect(await articleContextFrom(fakeClient({}).client).articleFor("team-jersey")).toBeNull();
    expect(await articleContextFrom(fakeClient({}, ["base_articles"]).client).articleFor("team-jersey")).toBeNull();
  });
});

describe("the mood port", () => {
  it("gives the brand's own voice words from Brand Studio", async () => {
    const { client } = fakeClient({ brand_profiles: { single: { voice_tags: ["playful", "bold", "nonsense"] } } });
    expect(await brandMoodFrom(client).moodWordsFor("brand-1")).toEqual(["bold", "playful"]);
  });

  it("gives none for a brand that saved none, or when the profile cannot be read", async () => {
    expect(await brandMoodFrom(fakeClient({}).client).moodWordsFor("brand-1")).toEqual([]);
    expect(await brandMoodFrom(fakeClient({}, ["brand_profiles"]).client).moodWordsFor("brand-1")).toEqual([]);
  });
});

describe("the library port", () => {
  it("tags a template with its sport, garment, styles, colour family and look-and-feel tags, in lower case", () => {
    const tags = libraryTagsOf(row(1, hoops, { sport_tags: ["running-gym"], mood_tags: ["bold"], era_tags: ["retro-90s"] }));
    expect(tags).toEqual(expect.arrayContaining([hoops.sport, "hoops", hoops.colourFamily, "running-gym", "running", "gym", "bold", "retro-90s"]));
    expect(tags.every((tag) => tag === tag.toLowerCase())).toBe(true);
  });

  it("lists matching design templates with a picture Knitwright draws, opening the template library", async () => {
    const { client } = fakeClient({
      templates: {
        list: [row(1, hoops), row(2, plain, { sport: "cricket", sport_tags: [] })],
        snapshots: [
          { id: uuid(1), snapshot: hoops.snapshot },
          { id: uuid(2), snapshot: plain.snapshot },
        ],
      },
    });
    const items = await templateLibraryFrom(client, "https://studio.example").search("brand-1", query({ styleTags: ["hoops"] }));
    expect(items.map((item) => item.id)).toEqual([uuid(1)]);
    const [item] = items;
    expect(item!.title).toBe(hoops.title);
    expect(item!.kindLabel).toBe("Template");
    expect(item!.previewUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(item!.openUrl.startsWith("https://studio.example/templates?")).toBe(true);
    expect(item!.unsaveable).toBe(LIBRARY_UNSAVEABLE);
  });

  it("asks for the pictures of the best matches only, and leaves out a template that cannot be drawn", async () => {
    const { client } = fakeClient({ templates: { list: [row(1, hoops)], snapshots: [{ id: uuid(1), snapshot: { typeId: "nothing" } }] } });
    expect(await templateLibraryFrom(client, "https://studio.example").search("brand-1", query({ styleTags: ["hoops"] }))).toEqual([]);
  });

  it("does not read pictures at all when nothing matches", async () => {
    const { client, asked } = fakeClient({ templates: { list: [row(1, hoops)] } });
    expect(await templateLibraryFrom(client, "https://studio.example").search("brand-1", query({ styleTags: ["sash"] }))).toEqual([]);
    expect(asked.some((entry) => entry.includes("snapshot"))).toBe(false);
  });

  it("drops a row it cannot read and faults when the library cannot be read, so the board says so", async () => {
    const { client } = fakeClient({ templates: { list: [{ id: "not-a-uuid" }, row(1, hoops)], snapshots: [{ id: uuid(1), snapshot: hoops.snapshot }] } });
    expect(await templateLibraryFrom(client, "https://studio.example").search("brand-1", query({ styleTags: ["hoops"] }))).toHaveLength(1);
    await expect(templateLibraryFrom(fakeClient({}, ["templates"]).client, "https://studio.example").search("brand-1", query({}))).rejects.toThrow();
  });

  it("gives cards the library source marks as Knitwright's own and as not saveable", async () => {
    const { client } = fakeClient({ templates: { list: [row(1, hoops)], snapshots: [{ id: uuid(1), snapshot: hoops.snapshot }] } });
    const cards = await libraryProvider(templateLibraryFrom(client, "https://studio.example"), "brand-1").search(query({ styleTags: ["hoops"] }));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.owned).toBe(true);
    expect(cards[0]!.unsaveable).toBe(LIBRARY_UNSAVEABLE);
  });
});

describe("the card screen", () => {
  it("drops a card whose title or creator holds a word moderation blocks, and keeps the rest", async () => {
    const clean = stubCard("unsplash", "a", { title: "Navy hoops at dusk" });
    const rude = stubCard("unsplash", "b", { title: "nigger kit" });
    const rudeCreator = stubCard("pexels", "c", { attribution: { ...clean.attribution, creator: "nigger" } });
    expect(await cardScreen.screen([clean, rude, rudeCreator])).toEqual([clean]);
  });

  it("keeps a card that only names a brand: a competitor's product is what the link-preview row is for", async () => {
    const product = stubCard("link-preview", "d", { title: "Inspired by Nike: a dupe of the home shirt" });
    expect(await cardScreen.screen([product])).toEqual([product]);
  });
});

describe("the production wiring", () => {
  it("passes a real port for every one of the four, never an unwired one", () => {
    const { client } = fakeClient({});
    const ports = inspirationPorts(client, "https://studio.example");
    expect(ports).not.toBe(UNWIRED_INSPIRATION_PORTS);
    expect(ports.articles).not.toBe(UNWIRED_ARTICLES);
    expect(ports.mood).not.toBe(UNWIRED_MOOD);
    expect(ports.library).not.toBe(UNWIRED_LIBRARY);
    expect(ports.screen).not.toBe(UNWIRED_SCREEN);
  });
});
