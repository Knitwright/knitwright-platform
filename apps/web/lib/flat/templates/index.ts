import { CREW_TEE } from "./crew-tee";
import { LONG_SLEEVE_TEE } from "./long-sleeve-tee";
import { POLO } from "./polo";
import type { TopsTemplate } from "./template";
import { TEAM_JERSEY } from "./team-jersey";
import { V_NECK_TEE } from "./v-neck-tee";

/**
 * ADDING A TOPS TYPE. Write its registry data in `lib/garment/registry/tops`, then add a
 * file here that exports a `TopsTemplate` and list it below. A test fails for any type in
 * the registry that has no template. The shared drawing code does not change.
 */
export const TOPS_TEMPLATES: readonly TopsTemplate[] = [CREW_TEE, V_NECK_TEE, LONG_SLEEVE_TEE, POLO, TEAM_JERSEY];

export const templateFor = (typeId: string): TopsTemplate | undefined =>
  TOPS_TEMPLATES.find((template) => template.typeId === typeId);
