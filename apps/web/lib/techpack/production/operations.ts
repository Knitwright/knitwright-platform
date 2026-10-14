import { PROPOSAL_WORDS } from "../text";
import { TBC, textCell } from "../cell";
import { SECTION_TITLES, type ConstructionSection } from "../types";
import type { OperationStage, OperationStep, OperationsSection } from "./types";

const STAGE_LABELS: Readonly<Record<OperationStage, string>> = {
  print: "Print",
  press: "Press",
  cut: "Cut",
  sew: "Sew",
  decorate: "Decorate",
  inspect: "Inspect",
};

type Draft = Pick<OperationStep, "stage" | "label">;

const step = (stage: OperationStage, label: string): Draft => ({ stage, label });

const NO_TECHNIQUE = "The decoration method is not set, so the print and press steps are left out.";

const TECHNIQUE_WORDS: Readonly<Record<string, string>> = {
  sublimation: "sublimation",
  transfer: "transfer",
  "screen-print": "screen print",
  embroidery: "embroidery",
};

const CUT = step("cut", "Cut the pieces on the cut list, with the grain lines straight and the notches marked.");
const INSPECT = step("inspect", "Measure sample garments against the measurement table and the pattern.");

function sewSteps(construction: ConstructionSection): Draft[] {
  return construction.seams.map((seam) => ({ stage: "sew" as const, label: `Sew the ${seam.label.toLowerCase()}. The stitch is in Construction.` }));
}

/** Print and press come before cutting for sublimation. Other methods are applied to cut pieces. */
function sequence(technique: string | null, construction: ConstructionSection, hasPlayerMarks: boolean): Draft[] {
  const sew = sewSteps(construction);
  const marks = hasPlayerMarks ? [step("decorate", "Add each player's name and number from the team order.")] : [];
  if (technique === "sublimation") {
    return [
      step("print", "Print the artwork on transfer paper, one file for each piece and size, at full size."),
      step("press", "Press the print onto the fabric in a calender at the settings the print house gives."),
      CUT,
      ...sew,
      ...marks,
      INSPECT,
    ];
  }
  const applied = technique === null ? [] : [step("decorate", `Apply the ${TECHNIQUE_WORDS[technique] ?? technique} to the cut pieces.`)];
  return [CUT, ...applied, ...sew, ...marks, INSPECT];
}

/**
 * The order of work from the decoration method and the seams: print, press, cut, sew, decorate,
 * inspect. It is general knitwear practice, so every step says it is only proposed by Knitwright.
 */
export function buildOperations(technique: string | null, construction: ConstructionSection, hasPlayerMarks: boolean): OperationsSection {
  const steps: readonly OperationStep[] = sequence(technique, construction, hasPlayerMarks).map((draft, index) => ({
    order: index + 1,
    stage: draft.stage,
    stageLabel: STAGE_LABELS[draft.stage],
    label: draft.label,
    detail: { status: "set", value: PROPOSAL_WORDS, provenance: "derived" },
  }));
  return {
    id: "operations",
    title: SECTION_TITLES.operations,
    note: technique === null ? NO_TECHNIQUE : null,
    technique: technique === null ? TBC : textCell(TECHNIQUE_WORDS[technique] ?? technique, "derived"),
    steps,
  };
}
