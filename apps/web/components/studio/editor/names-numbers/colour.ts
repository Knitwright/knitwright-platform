/**
 * The colour of names and numbers, and its outline (spec F-S4 "colour role and outline", plan v5
 * Y8, decision 0081).
 *
 * A design stores one colour instruction for its names and numbers: free text such as a Pantone
 * name, plus a drawn swatch (`lib/garment/names-numbers.ts`, decision 0027). The spec asks for an
 * outline colour as well, and R-PER-004's note says an outline is what makes lettering read on a
 * patterned back.
 *
 * The outline is written into that one instruction, as "Navy 19-4024 TCX · outline White", rather
 * than added as a second field on the saved design. A new field would have to be carried by the
 * tech pack's player-mark row, the Excel sheet, the PDF and the flats, which workstreams Y4 and Y5
 * own; writing it into the instruction puts it in front of the factory today, in the cell that
 * already says what colour the lettering is. The owner question in decision 0081 asks whether to
 * promote it to a field of its own.
 */

/** What separates the lettering colour from its outline inside the one stored instruction. */
export const OUTLINE_JOIN = " · outline ";

export interface ColourInstruction {
  /** The colour or colour role of the lettering itself. */
  readonly colour: string;
  /** The outline's colour, or empty for no outline. */
  readonly outline: string;
}

/** The one instruction the design stores, from the two fields the panel shows. */
export function composeColour({ colour, outline }: ColourInstruction): string {
  const main = colour.trim();
  const edge = outline.trim();
  if (edge.length === 0) return main;
  return main.length === 0 ? `outline ${edge}` : `${main}${OUTLINE_JOIN}${edge}`;
}

/** The two fields the panel shows, read back out of the stored instruction. */
export function splitColour(stored: string): ColourInstruction {
  const text = stored.trim();
  const at = text.indexOf(OUTLINE_JOIN);
  if (at >= 0) return { colour: text.slice(0, at).trim(), outline: text.slice(at + OUTLINE_JOIN.length).trim() };
  if (text.toLowerCase().startsWith("outline ")) return { colour: "", outline: text.slice("outline ".length).trim() };
  return { colour: text, outline: "" };
}

/** The colour roles already on the design, offered beside "type a colour". */
export interface ColourRoleChoice {
  readonly id: string;
  readonly label: string;
}

/**
 * The roles the design already names, with the colour each one is set to, so the lettering can be
 * said to match a colour the design is really made in rather than a colour typed twice.
 */
export function roleChoices(rows: readonly Readonly<{ label: string; colourText: string }>[]): readonly ColourRoleChoice[] {
  const seen = new Set<string>();
  const out: ColourRoleChoice[] = [];
  for (const row of rows) {
    const text = row.colourText.trim();
    if (text.length === 0 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push({ id: text, label: `${row.label}: ${text}` });
  }
  return out;
}
