import type { Finding } from "@/lib/production/contract";
import type { ArticleRef } from "@/lib/garment/spec-schema";
import type { GuardrailInput } from "@/lib/guardrails";
import type { FactoryProfile } from "./profile";
import type { ModerationStatus, ParameterDef } from "./ports";
import type { ReadinessSection } from "@/lib/techpack/production/types";

/**
 * What a check reads. `readiness` is the "Ready for the factory" section of the tech pack, or null when it was not built.
 * The other fields were added for plan v5 X4; each is optional, and a module whose input is absent raises nothing.
 */
export interface DesignInput {
  readonly typeId: string;
  readonly readiness: Pick<ReadinessSection, "groups"> | null;
  /** The base article the design sits on, or null when it sits on none yet. Absent: not looked up. */
  readonly article?: ArticleRef | null;
  /** The article's approved parameters; null when the catalogue does not offer the article. */
  readonly parameterDefs?: readonly ParameterDef[] | null;
  /** The latest moderation result for each asset and text the design uses. */
  readonly moderation?: readonly ModerationStatus[];
  /** What the editor guardrails read (decision 0045). */
  readonly guardrails?: GuardrailInput;
}

/** A finding that names its own rule, such as a parameter answering to its range's rule. */
export type RuledFinding = Finding & { readonly ruleId?: string };

/** A pluggable check. */
export interface CheckModule {
  /** A stable kebab-case id, unique in a registry. */
  readonly id: string;
  /** The rule a clean run of this module answers to. Defaults to the rule of the id. */
  readonly ruleId?: string;
  readonly run: (design: DesignInput, profile: FactoryProfile) => readonly RuledFinding[];
}

export interface CheckRegistry {
  readonly modules: readonly CheckModule[];
  /** A new registry with the module added. Throws when the id is taken. */
  readonly register: (module: CheckModule) => CheckRegistry;
}

export function createCheckRegistry(modules: readonly CheckModule[] = []): CheckRegistry {
  return {
    modules,
    register: (module) => {
      if (modules.some((m) => m.id === module.id)) throw new Error(`A check module named "${module.id}" is already registered.`);
      return createCheckRegistry([...modules, module]);
    },
  };
}
