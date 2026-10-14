import { getEnv } from "@/lib/config/env";
import { getTeamOrder } from "@/lib/orders/service";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import type { PrintDeps, PrintQuery } from "../service";
import { requireLibraryOpen } from "./access";
import { loadPrintContext, type Clients } from "./context";
import { loadDesignPattern } from "./pattern";

/**
 * Everything the print download needs, read for one design: the design, the library's pattern for its garment (or the
 * one named), the brand's print settings and artwork reader, and the team list when one is named. The brand comes from
 * the session; a design, pattern, rule set or team list of another brand is not found.
 */
export async function loadPrintDeps(clients: Clients, who: { readonly brandId: string; readonly email: string | null }, projectId: string, query: PrintQuery): Promise<PrintDeps> {
  requireLibraryOpen(getEnv(), who.email);
  const project = await getProject(clients.client, who.brandId, projectId);
  const found = await loadDesignPattern(clients.client, who.brandId, { typeId: project.spec.typeId, ...(query.pattern === undefined ? {} : { blockId: query.pattern }) });
  if (!found.ok) throw new AppError("not_found", found.reason);
  const [context, order] = await Promise.all([
    loadPrintContext(clients, who.brandId, query.rules),
    query.order === undefined ? Promise.resolve(null) : getTeamOrder(clients.client, who.brandId, projectId, query.order),
  ]);
  return { project: { name: project.name, version: project.currentVersion, spec: project.spec }, pattern: found, context, roster: order === null ? null : { rows: order.rows } };
}
