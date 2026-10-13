import { getType, type GarmentSpec, type Wearer, type Provenance } from "@/lib/garment";
import { resolveAllSizes, type ChartSet } from "@/lib/sizing";
import { TBC, choiceCell, textCell, type Cell } from "./cell";
import { REVISIONS_SHOWN, type RevisionInput, type TechPackInput } from "./input";
import { SOME_MISSING } from "./text";
import type { CoverSection, Revision } from "./types";
import { SECTION_TITLES } from "./types";

const NOT_RECORDED = "Not recorded";
const OLDER_NOT_SHOWN = "Older revisions are not shown.";

const wearerLabel = (wearer: Wearer): string => `${wearer.charAt(0).toUpperCase()}${wearer.slice(1)}`;

/** The sizes of the design, else of the chart. Their source is the design or the chart. */
function sizesCells(spec: GarmentSpec, charts?: ChartSet): { baseSize: Cell; sizeRun: Cell } {
  const all = resolveAllSizes(spec, charts);
  if (all.entries.length === 0 || all.baseSize === null) return { baseSize: TBC, sizeRun: TBC };
  const source: Provenance = all.sizesFrom === "design" ? "user-edited" : (all.chartProvenance ?? "suggested-chart");
  return {
    baseSize: textCell(all.baseSize, source),
    sizeRun: textCell(all.entries.map((entry) => entry.size).join(", "), source),
  };
}

function optionCells(spec: GarmentSpec): CoverSection["options"] {
  const type = getType(spec.typeId);
  return (type?.options ?? []).flatMap((option) => {
    const chosen = Object.hasOwn(spec.options, option.id) ? spec.options[option.id] : undefined;
    const label = chosen ? option.choices.find((choice) => choice.id === chosen.choiceId)?.label : undefined;
    return [{ id: option.id, label: option.label, choice: chosen && label ? choiceCell(label, chosen.provenance) : TBC }];
  });
}

function revisionsOf(history: readonly RevisionInput[]): { shown: readonly Revision[]; older: string | null } {
  const newestFirst = [...history].sort((a, b) => b.version - a.version);
  const shown = newestFirst.slice(0, REVISIONS_SHOWN).map((entry) => ({
    version: entry.version,
    date: entry.date,
    dateIso: entry.dateIso,
    note: entry.note,
    by: entry.by ?? NOT_RECORDED,
  }));
  return { shown, older: newestFirst.length > REVISIONS_SHOWN ? OLDER_NOT_SHOWN : null };
}

/**
 * The cover: what the style is, which version this is, the sizes and the history. Typed
 * words carry `user-edited`. The brand name comes from the brand and says so. The date is
 * the date the version was saved and is never read from a clock.
 */
export function buildCover(input: TechPackInput): CoverSection {
  const { project, spec } = input;
  const sizes = sizesCells(spec, input.charts);
  const history = revisionsOf(input.history);
  const cells = {
    styleNumber: textCell(project.styleNumber, "user-edited"),
    season: textCell(project.season, "user-edited"),
    brand: textCell(project.brandName, "brand-supplied"),
    designName: textCell(project.name, "user-edited"),
    garmentType: textCell(getType(spec.typeId)?.label ?? "", "user-edited"),
    wearer: textCell(wearerLabel(spec.wearer), "user-edited"),
    ...sizes,
  };
  const missing = Object.values(cells).some((cell) => cell.status !== "set");
  return {
    id: "cover",
    title: SECTION_TITLES.cover,
    note: missing ? SOME_MISSING : null,
    ...cells,
    version: input.version,
    date: input.versionDate,
    dateIso: input.versionDateIso,
    options: optionCells(spec),
    revisions: history.shown,
    olderRevisionsNote: history.older,
  };
}
