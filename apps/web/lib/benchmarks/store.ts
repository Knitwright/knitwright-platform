import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import type { StoredCard } from "./compare";
import { benchmarkFailure } from "./errors";
import { benchmarkCardSchema, type BenchmarkCard } from "./schema";
import { SOURCE_KINDS, type SourceKind } from "./vocabulary";

/**
 * Where benchmarks are kept. An interface, so the service is tested against the in-memory double
 * (`fixtures/memory-store.ts`) and the database one is tested against the real database
 * (tests/integration/benchmarks.test.ts).
 *
 * The one thing this file guarantees: **only a card goes in**. A page's source, a third-party picture and a reviewer's
 * words have no column to go in, and `storable` re-checks every card against the schema before it is written, so a
 * string with markup in it cannot be stored even if a caller tries.
 */

export type Who = Readonly<{ brandId: string; userId: string }>;

export type BenchmarkSummary = Readonly<{ id: string; title: string; projectId: string | null; cards: number; createdAt: string }>;
export type BenchmarkDetail = Readonly<{ id: string; title: string; projectId: string | null; createdAt: string; cards: readonly StoredCard[] }>;

export type NewCard = Readonly<{
  benchmarkId: string;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  sourceHost: string | null;
  /** The user's own uploaded photo, kept private. Never a third-party image. */
  sourceFileId: string | null;
  card: BenchmarkCard;
  extractor: string;
}>;

export type FetchClaim = "ok" | "already";

export interface BenchmarkStore {
  create(who: Who, input: Readonly<{ title: string; projectId: string | null }>): Promise<string>;
  /** Says whether this brand may fetch this URL now. "already" means it has read it before: it is fetched once. */
  claimFetch(who: Who, input: Readonly<{ urlKey: string; host: string }>): Promise<FetchClaim>;
  settleFetch(who: Who, input: Readonly<{ urlKey: string; outcome: "fetched" | "robots_refused" | "failed" }>): Promise<void>;
  addCard(who: Who, card: NewCard): Promise<string>;
  confirmCard(who: Who, input: Readonly<{ cardId: string; card: BenchmarkCard }>): Promise<void>;
  list(who: Who): Promise<readonly BenchmarkSummary[]>;
  read(who: Who, benchmarkId: string): Promise<BenchmarkDetail | null>;
}

/** The card, checked again on its way to the database. Anything the schema refuses never reaches a column. */
export function storable(card: BenchmarkCard): BenchmarkCard {
  const parsed = benchmarkCardSchema.safeParse(card);
  if (!parsed.success) throw new AppError("invalid_input", "That card is not in the shape a benchmark card takes.");
  return parsed.data;
}

type Db = Pick<SupabaseClient, "rpc" | "from">;

const cardRow = z.object({
  id: z.string(),
  source_kind: z.enum(SOURCE_KINDS),
  source_url: z.string().nullable(),
  source_host: z.string().nullable(),
  card: z.unknown(),
  extractor: z.string(),
  confirmed_at: z.string().nullable(),
});

const benchmarkRow = z.object({ id: z.string(), title: z.string(), project_id: z.string().nullable(), created_at: z.string() });

const storedCardOf = (row: z.output<typeof cardRow>): StoredCard => ({
  id: row.id,
  sourceKind: row.source_kind,
  sourceUrl: row.source_url,
  sourceHost: row.source_host,
  card: benchmarkCardSchema.parse(row.card),
  extractor: row.extractor,
  confirmedAt: row.confirmed_at,
});

const CARD_COLUMNS = "id, source_kind, source_url, source_host, card, extractor, confirmed_at";

/**
 * The database store. Reads go through the client it is given, so the database's own rules decide what a person sees;
 * every write goes through a function only the server's key may run, and the brand always comes from the session.
 */
export function createSupabaseStore(admin: Db, reader: Db = admin): BenchmarkStore {
  const failIf = (error: { code?: string; hint?: string | null; message: string } | null): void => {
    if (error) throw benchmarkFailure(error);
  };
  return {
    async create(who, input) {
      const { data, error } = await admin.rpc("benchmark_create", {
        p_brand_id: who.brandId,
        p_user_id: who.userId,
        p_project_id: input.projectId,
        p_title: input.title,
      });
      failIf(error);
      return z.string().parse(data);
    },
    async claimFetch(who, input) {
      const { data, error } = await admin.rpc("benchmark_fetch_claim", {
        p_brand_id: who.brandId,
        p_user_id: who.userId,
        p_url_sha256: input.urlKey,
        p_host: input.host,
      });
      failIf(error);
      return z.enum(["ok", "already"]).parse(data);
    },
    async settleFetch(who, input) {
      const { error } = await admin.rpc("benchmark_fetch_settle", {
        p_brand_id: who.brandId,
        p_url_sha256: input.urlKey,
        p_outcome: input.outcome,
      });
      failIf(error);
    },
    async addCard(who, card) {
      const { data, error } = await admin.rpc("benchmark_card_add", {
        p_brand_id: who.brandId,
        p_user_id: who.userId,
        p_benchmark_id: card.benchmarkId,
        p_source_kind: card.sourceKind,
        p_source_url: card.sourceUrl,
        p_source_host: card.sourceHost,
        p_source_file_id: card.sourceFileId,
        p_card: storable(card.card),
        p_extractor: card.extractor,
      });
      failIf(error);
      return z.string().parse(data);
    },
    async confirmCard(who, input) {
      const { error } = await admin.rpc("benchmark_card_confirm", {
        p_brand_id: who.brandId,
        p_user_id: who.userId,
        p_card_id: input.cardId,
        p_card: storable(input.card),
      });
      failIf(error);
    },
    async list(who) {
      const { data, error } = await reader
        .from("benchmarks")
        .select("id, title, project_id, created_at, benchmark_cards(count)")
        .eq("brand_id", who.brandId)
        .order("created_at", { ascending: false })
        .limit(100);
      failIf(error);
      return (data ?? []).map((raw) => {
        const row = benchmarkRow.parse(raw);
        const counted = z.array(z.object({ count: z.number() })).safeParse((raw as { benchmark_cards?: unknown }).benchmark_cards);
        return { id: row.id, title: row.title, projectId: row.project_id, createdAt: row.created_at, cards: counted.success ? (counted.data[0]?.count ?? 0) : 0 };
      });
    },
    async read(who, benchmarkId) {
      const { data, error } = await reader
        .from("benchmarks")
        .select(`id, title, project_id, created_at, benchmark_cards(${CARD_COLUMNS})`)
        .eq("brand_id", who.brandId)
        .eq("id", benchmarkId)
        .maybeSingle();
      failIf(error);
      if (data === null) return null;
      const row = benchmarkRow.parse(data);
      const cards = z.array(cardRow).parse((data as { benchmark_cards?: unknown }).benchmark_cards ?? []);
      return { id: row.id, title: row.title, projectId: row.project_id, createdAt: row.created_at, cards: cards.map(storedCardOf) };
    },
  };
}
