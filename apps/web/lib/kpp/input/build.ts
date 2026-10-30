import type { KppInput } from "../model";
import { colourSpec } from "./colour";
import { overviewFields } from "./fields";
import { careLabels } from "./labels";
import { billOfMaterials } from "./materials";
import { measurements } from "./measurements";
import { chosenFabric, type KppRows } from "./model";
import { printRules, qualityChecklist } from "./quality";

/**
 * The real `KppInput`, built from the rows the platform stores (plan v5 X5b item 1): X1's base article and its
 * points of measure, X4's design object and provenance, X6's factory, fabric, colour and price rows. It replaces
 * the fixture X5 had to build against (decision 0070, "What is owed": "A real `KppInput` builder").
 *
 * It is pure: no database, no environment, no clock. A value no row holds is marked `needs_input` rather than
 * guessed, and the F-G2 gate (`lib/kpp/gate.ts`) then refuses the package and names it.
 */

/** Sentences the README carries about what this package could and could not be built from. */
export function buildNotes(rows: KppRows): readonly string[] {
  const fabric = chosenFabric(rows);
  return [
    `Every value in this package comes from ${rows.article.code} ${rows.article.name}, version ${rows.article.sourceVersion ?? "unversioned"}: ${rows.article.dataLabel}.`,
    ...(rows.article.sourceNote === null ? [] : [rows.article.sourceNote]),
    ...(fabric === null ? [`No fabric row is on file for ${rows.object.article.fabric.code}, so the package states only the code.`] : [fabric.label]),
    ...(rows.capability === null ? [`${rows.factory.name} has no agreed capability on file for ${rows.article.code}.`] : [rows.capability.label]),
    // Owner decision 17: one notch style in the geometry, the style stated in words. No factory row holds a preference.
    "Notch style is not on file for this factory. The DXF marks every notch one way and the README and the 1:1 PDF state V-notch; notch style is a cutter-room setting your own CAM applies.",
    // docs/spec/04 asks for the factory's measured ICC profile at export. No profile exists for any fabric.
    "No ICC profile is on file for this fabric, so print files are left as sRGB. Match the strike-off, not the screen.",
    "Lab values are computed from the screen colour in sRGB under D65 with the two-degree observer, not measured.",
  ];
}

/** The sizes the package covers: the article's own size range, which is what its POMs and its grade are stated over. */
const sizesOf = (rows: KppRows): readonly string[] => rows.article.sizeRange;

export function buildKppInput(rows: KppRows): KppInput {
  const sizes = sizesOf(rows);
  return {
    kind: rows.kind,
    design: {
      code: rows.design.code,
      name: rows.design.name,
      articleCode: rows.article.code,
      version: rows.design.version,
      hash: rows.design.hash,
      createdAtIso: rows.design.createdAtIso,
      brand: rows.design.brand,
      season: rows.design.season,
      baseSize: rows.article.sampleSize ?? "",
      sizes,
    },
    factory: {
      code: rows.factory.slug.toUpperCase(),
      name: rows.factory.name,
      contact: rows.factory.contactWhatsapp,
      // Owner decision 17: one notch style in the DXF, and the style is stated in the README and on the 1:1 PDF.
      notch: "v-notch",
      printFileType: rows.capability?.fileFormats.includes("tif") === true ? "tif" : "pdf",
      madeByKnitwright: rows.madeByKnitwright,
    },
    dueDate: rows.dueDate,
    fields: overviewFields(rows),
    poms: measurements(rows.article.poms, sizes),
    bom: billOfMaterials(rows),
    colour: colourSpec(rows),
    labels: careLabels(rows),
    qc: qualityChecklist(rows),
    print: printRules(rows),
    moderation: rows.moderation,
    orders: rows.kind === "batch" ? rows.orders : [],
    personalisation: rows.kind === "batch" ? rows.personalisation : [],
    packing: rows.unsourced.packing,
    notes: buildNotes(rows),
  };
}
