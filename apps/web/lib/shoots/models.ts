import { CONSENT_STATEMENT, SEEDED_NOTE, SHOOT_GAP_RULE, type ModelConsent, type ModelPreset } from "./types";

/**
 * THE MODEL PRESETS, AND THE LICENCE EACH ONE NEEDS (plan v5 L3: "`model_presets` with licence
 * ref"; spec F-L1: "licensed AI presets with diverse body types, ages and skin tones; or upload a
 * model with a consent tick"; `07`: "all AI-generated and licensed; no real people").
 *
 * **A person's likeness needs consent, and consent is a record rather than an assumption.** That
 * one sentence decides the whole file:
 *
 *   * a preset's `licenceRef` is `null` until somebody puts a real reference against it, and a
 *     preset with none **cannot be run**. The panel shows it greyed with the words on its card, the
 *     same shape L5 gave a model nobody had priced (`lib/media/video/models.ts`);
 *   * the licence refs are a **platform setting** (`settings.ts` here), so the owner fills them in
 *     the admin console and no code change is needed, and nothing in this file can quietly default
 *     one;
 *   * **no row names a person and no row carries a photograph.** A preset describes the body type,
 *     age band and skin tone the spec asks the library to cover, and says plainly that nobody has
 *     licensed one yet. Committing a photograph of a person, or a third-party image, would be the
 *     worst thing this workstream could do, so there is nothing here for one to live in;
 *   * a brand's own upload carries a `ModelConsent`: a reference, the words that were ticked, and
 *     when. All three or nothing (`consentFrom`), and the database says the same.
 */

/** What the placeholder presets say about themselves, shown above the picker. */
export const PRESETS_NOTE =
  "Knitwright placeholder: these describe the range of people F-L1 asks the library to cover. No preset has a licence on file, so none can be used yet. Your own model with a recorded consent can be.";

/** The sentence on a preset with no licence ref, on its card and on the Generate button's reason. */
export const NO_LICENCE_LINE = "No licence on file for this likeness, so it cannot be generated.";

/** The words beside a preset that does have one, so a reader can go and look it up. */
export const licenceLabel = (preset: ModelPreset): string =>
  preset.licenceRef === null ? NO_LICENCE_LINE : `Licence ${preset.licenceRef}${preset.licenceHolder ? ` (${preset.licenceHolder})` : ""}`;

const placeholder = (key: string, bodyType: string, ageBand: string, skinTone: string): ModelPreset => ({
  key,
  label: `${bodyType}, ${ageBand}, ${skinTone}`,
  bodyType,
  ageBand,
  skinTone,
  licenceRef: null,
  licenceHolder: null,
  ruleId: SHOOT_GAP_RULE,
  note: `${SEEDED_NOTE} ${PRESETS_NOTE}`,
});

/**
 * The range F-L1 asks for, as six rows that between them cover four body types, four age bands and
 * three skin-tone groups. The words are descriptions of a range, not descriptions of six people
 * somebody chose: the spec asks for diversity and nobody has licensed the presets that would carry
 * it, so what is seeded is the shape of the list and not its content.
 */
export const MODEL_PRESET_CATALOGUE: readonly ModelPreset[] = [
  placeholder("slim-18-25-light", "Slim build", "18 to 25", "light skin tone"),
  placeholder("regular-26-40-mid", "Regular build", "26 to 40", "mid skin tone"),
  placeholder("athletic-26-40-deep", "Athletic build", "26 to 40", "deep skin tone"),
  placeholder("plus-26-40-mid", "Fuller build", "26 to 40", "mid skin tone"),
  placeholder("regular-41-60-light", "Regular build", "41 to 60", "light skin tone"),
  placeholder("athletic-41-60-deep", "Athletic build", "41 to 60", "deep skin tone"),
];

export const MODEL_PRESET_KEYS: readonly string[] = MODEL_PRESET_CATALOGUE.map((preset) => preset.key);

/** The licence refs an admin has set, by preset key. A key with no entry has no licence on file. */
export interface ModelLicenceConfig {
  readonly refs: Readonly<Record<string, string>>;
  readonly holders: Readonly<Record<string, string>>;
}

export const NO_LICENCES: ModelLicenceConfig = { refs: {}, holders: {} };

/** The presets with the admin's licence refs laid over them. A ref of the wrong shape is ignored. */
export function modelPresetsFrom(config: ModelLicenceConfig, catalogue: readonly ModelPreset[] = MODEL_PRESET_CATALOGUE): readonly ModelPreset[] {
  return catalogue.map((preset) => {
    const ref = config.refs[preset.key];
    const holder = config.holders[preset.key];
    if (typeof ref !== "string" || ref.trim() === "") return preset;
    return { ...preset, licenceRef: ref.trim(), licenceHolder: typeof holder === "string" && holder.trim() !== "" ? holder.trim() : null };
  });
}

export const findPreset = (presets: readonly ModelPreset[], key: unknown): ModelPreset | null =>
  (typeof key === "string" ? presets.find((preset) => preset.key === key) : undefined) ?? null;

/** True only for a preset somebody has put a licence against. Nothing else may be generated. */
export const presetUsable = (preset: ModelPreset): boolean => preset.licenceRef !== null;

/** The presets that can be run now. Empty until the owner answers, and the panel says why. */
export const usablePresets = (presets: readonly ModelPreset[]): readonly ModelPreset[] => presets.filter(presetUsable);

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 200);
};

/**
 * The consent in a stored value, or null. **Half a consent is no consent**: a reference with no
 * statement, or a statement with no date, gives null, and a run from an upload with null here is
 * refused. The date has to be a date, because "when" is part of what was recorded.
 */
export function consentFrom(value: unknown): ModelConsent | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as { ref?: unknown; statement?: unknown; givenAt?: unknown };
  const ref = text(raw.ref);
  const statement = text(raw.statement);
  const givenAt = text(raw.givenAt);
  if (ref === null || statement === null || givenAt === null) return null;
  if (Number.isNaN(Date.parse(givenAt))) return null;
  return { ref, statement, givenAt };
}

/** The consent a brand records when it ticks the box, with our own words and the moment it happened. */
export const consentOf = (ref: string, now: Date): ModelConsent | null =>
  consentFrom({ ref, statement: CONSENT_STATEMENT, givenAt: now.toISOString() });
