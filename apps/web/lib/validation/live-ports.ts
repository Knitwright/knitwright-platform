import type { SupabaseClient } from "@supabase/supabase-js";
import { baseArticleForType, getBaseArticle, type BaseArticle, type ParameterDef as CatalogueParameterDef } from "@/lib/catalogue";
import { createSupabaseStore, type ModerationStore, type TargetState } from "@/lib/moderation/store";
import type { ArticleCatalogue, ModerationReader, ModerationResult, ModerationStatus, ParameterDef, ValidationPorts } from "./ports";

/**
 * The real ports of `ports.ts`, wired for wave 2: the base article catalogue (X1, decision 0066) behind
 * `ArticleCatalogue`, and the kept moderation results (X8, decision 0073) behind `ModerationReader`. The
 * unwired pair in `ports.ts` stays exactly as it was — it is what the unit tests of both sides use.
 *
 * Nothing here judges a design or invents a value. Where the catalogue has no article, no parameter or no
 * screening, the port says so in the words the interface already has, and the check modules decide.
 */

/**
 * One approved parameter as validation reads it, or null for a row that cannot be expressed as a range, a
 * choice or a flag. The two shapes are not the same: the catalogue keeps one row with nullable `min`, `max`
 * and `enumValues`, while validation takes a union on `type`. `parameter_defs` itself refuses a `range` with
 * no minimum, maximum or step and an `enum` with no values (migration 20261101010000), so null means a row
 * the database could not have stored. Such a row is dropped rather than given a range nobody approved.
 */
export function toValidationParameter(def: CatalogueParameterDef): ParameterDef | null {
  if (def.type === "bool") return { key: def.key, type: "bool", ruleId: def.ruleId };
  if (def.type === "enum") {
    return def.enumValues !== null && def.enumValues.length > 0 ? { key: def.key, type: "enum", values: def.enumValues, ruleId: def.ruleId } : null;
  }
  if (def.min === null || def.max === null) return null;
  return { key: def.key, type: "range", min: def.min, max: def.max, step: def.step, ruleId: def.ruleId };
}

/**
 * The catalogue port over one client. A save asks for the article of a garment type and then for that
 * article's parameters, so the whole article is read once and kept for the life of the port.
 */
export function catalogueFrom(client: SupabaseClient): ArticleCatalogue {
  const reads = new Map<string, Promise<BaseArticle | null>>();
  const read = (code: string): Promise<BaseArticle | null> => {
    const already = reads.get(code);
    if (already !== undefined) return already;
    const reading = getBaseArticle(client, code);
    reads.set(code, reading);
    return reading;
  };
  return {
    articleForType: async (typeId) => {
      const code = baseArticleForType(typeId);
      if (code === undefined) return null;
      const article = await read(code);
      return article === null ? null : { baseArticleCode: article.code, productionClass: article.productionClass };
    },
    parameterDefs: async (code) => {
      const article = await read(code);
      return article === null ? null : article.parameters.flatMap((def) => toValidationParameter(def) ?? []);
    },
  };
}

/**
 * What validation makes of one kept screening. A person's decision wins over the automatic result, as
 * `screenBeforeOrder` reads it (decision 0073): an allowed target is clear, a blocked one is blocked.
 * `pending` is not reachable from the store, which keeps a result on every row.
 */
export const toValidationResult = (state: TargetState): ModerationResult =>
  state.decision === "allowed" ? "clear" : state.decision === "blocked" ? "blocked" : state.result;

/**
 * The moderation port over a store. The brand is not part of the lookup: `moderation_checks` is read with the
 * server's own key and `latest` is keyed by the target itself, whose id is the asset's own, so the brand would
 * narrow nothing. A target with no kept screening is left out of the answer, as the interface says.
 */
export function moderationReader(store: ModerationStore): ModerationReader {
  return {
    statusesFor: async (_brandId, targets) => {
      if (targets.length === 0) return [];
      const states = new Map<string, TargetState>();
      for (const kind of ["asset", "text"] as const) {
        const ids = targets.filter((target) => target.kind === kind).map((target) => target.id);
        if (ids.length === 0) continue;
        for (const state of await store.latest(kind, ids)) states.set(`${kind}:${state.targetId}`, state);
      }
      return targets.flatMap((target): ModerationStatus[] => {
        const state = states.get(`${target.kind}:${target.id}`);
        return state === undefined ? [] : [{ target, result: toValidationResult(state) }];
      });
    },
  };
}

/** The moderation port over the database, through the server's own key. */
export const moderationFrom = (admin: SupabaseClient): ModerationReader => moderationReader(createSupabaseStore(admin));

/** Both ports over one client: what `validateOnSave` is given from `lib/projects/service.ts`. */
export const livePorts = (admin: SupabaseClient): ValidationPorts => ({ catalogue: catalogueFrom(admin), moderation: moderationFrom(admin) });
