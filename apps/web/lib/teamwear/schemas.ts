import { z } from "zod";
import { SWATCH_PATTERN, WEARERS } from "@/lib/garment";
import { KIT_PARTS, SPORTS } from "./vocabulary";

/**
 * What the browser may send when a club saves a kit. The sport and the part are names from this
 * workstream's own tables, never a garment type: the server reads the registry type from them, so a
 * form cannot ask for a garment the configurator does not offer.
 *
 * The option codes and the parameters arrive as the editor's own `group:CODE` and `key:millimetres`
 * pairs and are then checked against the base article by `defaultsOver`, which drops every code the
 * article does not offer and every value outside the range the factory approved. Nothing structural
 * is trusted from the browser.
 */

const swatch = z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.");

/** The largest the stepper goes; the same limit the control itself has. */
const QUANTITY_MAX = 10_000;

/** A repeated form field, which arrives as one string or as several. */
const repeated = z
  .union([z.string(), z.array(z.string()).max(64)])
  .optional()
  .transform((value) => (value === undefined ? [] : typeof value === "string" ? [value] : value));

/** `key:value` pairs out of a repeated field. A pair without a colon is dropped, as the editor drops it. */
const pairs = (entries: readonly string[]): Record<string, string> => {
  const found: Record<string, string> = {};
  for (const entry of entries) {
    const at = entry.indexOf(":");
    if (at <= 0 || at === entry.length - 1) continue;
    found[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return found;
};

export const saveKitSchema = z
  .object({
    sportId: z.enum(SPORTS.map((sport) => sport.id) as [string, ...string[]]),
    part: z.enum(KIT_PARTS),
    wearer: z.enum(WEARERS, "Choose who the kit is for."),
    name: z.string().trim().min(1, "Give the kit a name.").max(80),
    main: swatch,
    second: swatch,
    third: z.union([z.literal("").transform(() => null), swatch]),
    socksColour: swatch,
    opt: repeated,
    par: repeated,
    quantity: z.coerce.number().int().min(1).max(QUANTITY_MAX),
    /** Where the person goes next: back to the configurator, or on to the Studio editor. */
    then: z.enum(["stay", "studio"]),
  })
  .transform(({ opt, par, ...rest }) => {
    const parameters: Record<string, number> = {};
    for (const [key, text] of Object.entries(pairs(par))) {
      const value = Number(text);
      if (Number.isFinite(value)) parameters[key] = value;
    }
    return { ...rest, options: pairs(opt), parameters };
  });

export type SaveKitInput = z.output<typeof saveKitSchema>;
