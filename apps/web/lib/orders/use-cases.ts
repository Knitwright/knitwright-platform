import type { SupabaseClient } from "@supabase/supabase-js";
import { getProject } from "@/lib/projects/service";
import { checkRoster, type RosterIssue } from "./checks";
import { rosterContextOf } from "./context";
import { manifestFileName } from "./file-name";
import { parseRosterCsv, type ImportResult } from "./import-csv";
import { buildManifest, manifestCsv, rosterCsv } from "./manifest";
import { manifestPdf } from "./manifest-pdf";
import type { ImportBody, OrderBody } from "./schemas";
import { getTeamOrder, saveTeamOrder, type StoredOrder } from "./service";

type Who = Readonly<{ brandId: string; userId: string }>;
type Clients = Readonly<{ client: SupabaseClient; admin: SupabaseClient }>;

interface SavedOrder {
  readonly id: string;
  readonly issues: readonly RosterIssue[];
}

/**
 * Saves a team list as typed. A list with problems is still saved, so people can work on it, and
 * the problems come back with it. Whether a list is good enough to use is decided later, when a
 * release is made from it.
 */
export async function saveOrder(clients: Clients, who: Who, projectId: string, orderId: string | null, body: OrderBody): Promise<SavedOrder> {
  const project = await getProject(clients.client, who.brandId, projectId);
  const id = await saveTeamOrder(clients.admin, { ...who, projectId, name: body.name, rows: body.rows, ...(orderId ? { orderId } : {}) });
  return { id, issues: checkRoster(body.rows, rosterContextOf(project.spec)) };
}

interface OrderView extends StoredOrder {
  readonly issues: readonly RosterIssue[];
}

export async function openOrder(client: SupabaseClient, brandId: string, projectId: string, orderId: string): Promise<OrderView> {
  const [project, order] = await Promise.all([getProject(client, brandId, projectId), getTeamOrder(client, brandId, projectId, orderId)]);
  return { ...order, issues: checkRoster(order.rows, rosterContextOf(project.spec)) };
}

type ImportPreview =
  | (Extract<ImportResult, { ok: true }> & { readonly issues: readonly RosterIssue[] })
  | Extract<ImportResult, { ok: false }>;

/** Reads a CSV and checks it against the design, saving nothing. The person looks before it is kept. */
export async function previewImport(client: SupabaseClient, brandId: string, projectId: string, body: ImportBody): Promise<ImportPreview> {
  const context = rosterContextOf((await getProject(client, brandId, projectId)).spec);
  const result = parseRosterCsv(body.csv, {
    run: context.run,
    ...(body.header === undefined ? {} : { header: body.header }),
    ...(body.defaultCut === undefined ? {} : { defaultCut: body.defaultCut }),
    ...(body.mapping === undefined ? {} : { mapping: body.mapping }),
  });
  return result.ok ? { ...result, issues: checkRoster(result.rows, context) } : result;
}

interface ManifestFile {
  readonly body: Uint8Array<ArrayBuffer> | string;
  readonly contentType: string;
  readonly fileName: string;
}

type ManifestFormat = "csv" | "pdf" | "roster";

/** The manifest of a team order as a file. `roster` is the plain list that an import reads back. */
export async function manifestFile(client: SupabaseClient, brandId: string, projectId: string, orderId: string, format: ManifestFormat): Promise<ManifestFile> {
  const [project, order] = await Promise.all([getProject(client, brandId, projectId), getTeamOrder(client, brandId, projectId, orderId)]);
  const manifest = buildManifest(order.name, order.rows, rosterContextOf(project.spec).run);
  if (format === "pdf") return { body: await manifestPdf(manifest, project.name), contentType: "application/pdf", fileName: manifestFileName(order.name, "pdf") };
  const text: string = format === "csv" ? manifestCsv(manifest) : rosterCsv(order.rows);
  return { body: text, contentType: "text/csv; charset=utf-8", fileName: manifestFileName(order.name, "csv") };
}
