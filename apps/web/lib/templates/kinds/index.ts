/**
 * The seven kinds of template of `docs/spec/07-template-library.md`, and their launch counts
 * (plan v5 wave 4, L8; decision 0098).
 *
 * A kind is data about a row, not a shape in code: `templates.kind` holds it, and
 * `migrations/20261201050000_template_kinds.sql` holds the same seven values. Nothing here invents a
 * count: each one is read from the "Launch count" column of `07`, and `counts.test.ts` holds this
 * file to that table.
 */

export const TEMPLATE_KINDS = ["design", "kit_bundle", "mockup_scene", "marketing", "video", "flow", "techpack"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_KIND_LABELS: Readonly<Record<TemplateKind, string>> = {
  design: "Design",
  kit_bundle: "Kit bundle",
  mockup_scene: "Mockup scene",
  marketing: "Marketing",
  video: "Video",
  flow: "Flow",
  techpack: "Tech pack",
};

/** What `07` asks the library to hold at launch, kind by kind. */
export const LAUNCH_COUNTS: Readonly<Record<TemplateKind, number>> = {
  design: 60,
  kit_bundle: 15,
  mockup_scene: 40,
  marketing: 50,
  video: 12,
  flow: 6,
  techpack: 8,
};

/** The kinds this workstream seeds. The other four belong to L2 to L6 of the same wave. */
export const KINDS_SEEDED_HERE: readonly TemplateKind[] = ["design", "kit_bundle", "techpack"];

export const isTemplateKind = (value: string): value is TemplateKind => (TEMPLATE_KINDS as readonly string[]).includes(value);
