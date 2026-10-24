import type { Finding } from "@/lib/production/contract";
import type { FactoryProfile } from "./profile";
import type { ReadinessSection } from "@/lib/techpack/production/types";

/** What a check reads. `readiness` is the "Ready for the factory" section of the tech pack, or null when it was not built. */
export interface DesignInput {
  readonly typeId: string;
  readonly readiness: Pick<ReadinessSection, "groups"> | null;
}

/** A pluggable check. V7 registers dpi, seam, gamut and safe-zone modules here. */
export interface CheckModule {
  /** A stable kebab-case id, unique in a registry. */
  readonly id: string;
  readonly run: (design: DesignInput, profile: FactoryProfile) => readonly Finding[];
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
