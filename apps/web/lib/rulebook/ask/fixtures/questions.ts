import { SUBLIMATION } from "../../scope";
import type { AskScope } from "../types";
import { ARTICLE } from "./rules";

/**
 * The 50-question set the plan asks for (plan v5 Z2; spec F-S5 acceptance: "in a 50-question test set, 0 answers
 * state a fact not in the rulebook").
 *
 * Forty-five of them are the questions a founder would ask about the forty-five rules of the JSY-SS-01 rulebook,
 * one each, in a founder's own words rather than the rule's. Five are questions the rulebook does not answer:
 * each must come back "not covered" with a line in the gap list, never a plausible answer assembled out of a
 * rule about something else.
 *
 * Every question is asked about the same design: the JSY-SS-01 base article, made by sublimation. Both parts of
 * the scope matter, because owner decision 12 scopes the R-SUB, R-LAB, R-QC and R-COST rules to the method and
 * not to the article, so a question about labels only reaches them through `method`.
 */

export type AskQuestion = Readonly<{
  question: string;
  /** The rule a founder asking this is asking about, or null when the rulebook does not cover it. */
  expect: string | null;
}>;

export const DESIGN: AskScope = { articleCode: ARTICLE, method: SUBLIMATION };

export const QUESTIONS: readonly AskQuestion[] = [
  // Pattern (R-PAT)
  { question: "What seam allowance should I leave on the overlocked seams and on the hems?", expect: "R-PAT-001" },
  { question: "Are sublimated panels cut flat or on the fold?", expect: "R-PAT-002" },
  { question: "How much can the body length offset parameter change the body?", expect: "R-PAT-003" },
  { question: "Can I make the sleeves longer with the sleeve length offset parameter?", expect: "R-PAT-004" },
  { question: "How far down can the back hem curve at centre back?", expect: "R-PAT-005" },
  { question: "How many notches go on the front armhole and the back armhole?", expect: "R-PAT-006" },
  { question: "How much ease is allowed in the sleeve cap?", expect: "R-PAT-007" },
  { question: "How long should the neck rib be against the neckline seam?", expect: "R-PAT-008" },

  // Fit and grading (R-FIT)
  { question: "What is the finished chest at size M, and how does the chest grade?", expect: "R-FIT-001" },
  { question: "How long is the body at size M, and how does body length grade?", expect: "R-FIT-002" },
  { question: "Why does the shoulder grade less than the chest?", expect: "R-FIT-003" },
  { question: "What is the sleeve length at size M?", expect: "R-FIT-004" },
  { question: "How wide are the bicep and the sleeve opening?", expect: "R-FIT-005" },
  { question: "How deep is the armhole on this block?", expect: "R-FIT-006" },
  { question: "What are the neck width and the front neck drop?", expect: "R-FIT-007" },
  { question: "What happens when a piece is outside tolerance on a QC sample?", expect: "R-FIT-008" },

  // Construction (R-CON)
  { question: "Which stitch is used on the shoulder seams, and at what stitch density?", expect: "R-CON-001" },
  { question: "How is the back neck seam covered?", expect: "R-CON-002" },
  { question: "Are the side seams and the underarm seams one continuous seam?", expect: "R-CON-003" },
  { question: "How is the C01 collar rib joined and attached?", expect: "R-CON-004" },
  { question: "How is the C02 V-neck binding mitred?", expect: "R-CON-005" },
  { question: "What binding does the C03 crew neck use?", expect: "R-CON-006" },
  { question: "What hem operation is used on the body hem and the sleeve hem?", expect: "R-CON-007" },
  { question: "How deep is the K02 rib cuff?", expect: "R-CON-008" },
  { question: "Which thread goes in the needle and which in the looper?", expect: "R-CON-009" },

  // Sublimation and print (R-SUB)
  { question: "Which fabrics can be sublimated?", expect: "R-SUB-001" },
  { question: "How much bleed do the print files need beyond the cut line?", expect: "R-SUB-002" },
  { question: "What DPI should the print files be at 1:1, and should they be mirrored?", expect: "R-SUB-003" },
  { question: "How far from a seam should a crest sit?", expect: "R-SUB-004" },
  { question: "How are colours checked against a strike-off?", expect: "R-SUB-005" },
  { question: "How much do panels shrink in the heat press?", expect: "R-SUB-006" },
  { question: "What is the thinnest line and the smallest text that will print?", expect: "R-SUB-007" },
  { question: "Why does my black print look brown?", expect: "R-SUB-008" },

  // Personalisation (R-PER)
  { question: "How big is the name on the back, and where does it sit below the neck?", expect: "R-PER-001" },
  { question: "How tall is the back number?", expect: "R-PER-002" },
  { question: "Where does the front number go on the chest?", expect: "R-PER-003" },
  { question: "Are names and numbers printed in the same sublimation pass?", expect: "R-PER-004" },

  // Labels and compliance (R-LAB)
  { question: "Can I have a sewn neck label?", expect: "R-LAB-001" },
  { question: "What has to be on the care label, and where does it sit?", expect: "R-LAB-002" },
  { question: "Which finishes are allowed, and what about PFAS?", expect: "R-LAB-003" },

  // Quality control (R-QC)
  { question: "What AQL plan applies to a production run, and which POMs are measured?", expect: "R-QC-001" },
  { question: "How closely must the print line up across the side seams?", expect: "R-QC-002" },

  // Cost drivers (R-COST)
  { question: "Does a busy design cost more to sublimate than a plain one?", expect: "R-COST-001" },
  { question: "Do rib cuffs and a V-neck add cost?", expect: "R-COST-002" },
  { question: "What do names and numbers cost per piece?", expect: "R-COST-003" },

  // Five questions the rulebook does not answer. Each must come back "not covered".
  { question: "Do you ship to Canada?", expect: null },
  { question: "What is your minimum order quantity?", expect: null },
  { question: "Can the shirt be made from merino wool?", expect: null },
  { question: "How do I register a trademark for my brand?", expect: null },
  { question: "What is the carbon footprint of one garment?", expect: null },
];

export const COVERED = QUESTIONS.filter((item) => item.expect !== null);
export const UNCOVERED = QUESTIONS.filter((item) => item.expect === null);
