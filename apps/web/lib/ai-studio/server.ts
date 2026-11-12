import "server-only";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { liveKinds } from "@/lib/flows/real/server";
import { PLACEHOLDER_CREDITS_PER_SECOND } from "@/lib/media/video/models";
import { listProjects } from "@/lib/projects/project-reads";
import { sessionClient } from "@/lib/server/deps";
import { historyOf, type HistoryEntry } from "./agent";
import type { LiveSwitches } from "./availability";
import type { Workflow } from "./catalogue";

/**
 * What an AI Studio page reads on the server (decision 0141): the brand's designs for the product
 * step, the paid switches as the run engine reads them, and the credit figures from `lib/credits`
 * settings, so a page never shows a price of its own.
 */

export type ProductChoice = Readonly<{ id: string; name: string; garment: string; typeId: string }>;

/** How many designs the product step lists: the newest, which is what a person launches. */
const PRODUCTS_LISTED = 60;

export async function loadProducts(brandId: string): Promise<readonly ProductChoice[]> {
  const page = await listProjects(await sessionClient(), brandId, PRODUCTS_LISTED);
  return page.projects.map((one) => ({ id: one.id, name: one.name, garment: one.garmentLabel, typeId: one.garmentType }));
}

/** The paid switches, read once per page. Removing a background has no provider at all yet. */
export const liveSwitches = (): LiveSwitches => ({ ...liveKinds(), removeBackground: false });

/** The default clip length the try-on video asks for, inside `09`'s 5–8 s. */
export const TRY_ON_SECONDS = 6;

/** Credits one output of a workflow costs when it runs: the platform's own placeholder prices. */
export function creditsPerOutput(workflow: Pick<Workflow, "cost" | "gate">): number {
  if (workflow.cost === "free") return 0;
  if (workflow.gate === "aiVideo") return PLACEHOLDER_CREDITS_PER_SECOND * TRY_ON_SECONDS;
  return CREDIT_SETTINGS.prices.marketing_media;
}

const HISTORY_ROWS = 100;

/** The person's own words to the design chat, newest first, as History lists them. Empty when unreadable. */
export async function loadAgentHistory(brandId: string): Promise<readonly HistoryEntry[]> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("assistant_messages")
    .select("project_id, body, created_at")
    .eq("brand_id", brandId)
    .eq("role", "person")
    .order("id", { ascending: false })
    .limit(HISTORY_ROWS);
  if (error || !data) return [];
  const rows = data.map((row) => ({ projectId: String(row.project_id), body: String(row.body), createdAt: String(row.created_at) }));
  const ids = [...new Set(rows.map((row) => row.projectId))];
  if (ids.length === 0) return [];
  const names = await client.from("projects").select("id, name").eq("brand_id", brandId).in("id", ids);
  const map = new Map((names.data ?? []).map((row) => [String(row.id), String(row.name)]));
  return historyOf(rows, map);
}
