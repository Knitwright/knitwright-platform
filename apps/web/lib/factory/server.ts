import "server-only";
import { adminClient } from "@/lib/server/deps";
import { createFactoryService, type FactoryService } from "./service";
import { supabaseFactoryStore, type FactoryStore } from "./store";

/**
 * The one factory service of this server process, so its profile cache is shared by every request. It reads with
 * the server's own key: callers decide who may see what (the ops page checks for a platform admin first).
 */

let shared: FactoryService | null = null;

export const factoryStore = (): FactoryStore => supabaseFactoryStore(adminClient());

export function factoryService(): FactoryService {
  shared ??= createFactoryService(factoryStore());
  return shared;
}
