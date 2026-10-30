/**
 * The sportswear palettes of spec F-S4's Library toolbar ("Classic club colours", "Neon training",
 * "Retro 90s"), seeded as labelled Knitwright drafts (plan v5 Y3, decision 0076).
 *
 * Every swatch here is a **screen colour and nothing else**. It is not a colour reference a factory
 * can match, and the platform has always refused to store one as if it were (`lib/garment/parts.ts`:
 * "a colour picked for the screen is not a colour reference for a factory"). R-SUB-005 is the rule
 * that says why: colours are checked against a printed strike-off, and club colours are picked from
 * the printed swatch book, not from the screen. So applying one of these fills the swatch and leaves
 * the colour reference empty for the brand to give.
 */

export interface PaletteColour {
  readonly id: string;
  readonly label: string;
  /** `#rrggbb`, lower case: what a screen draws. Never written to a tech pack as a colour reference. */
  readonly swatch: string;
}

export interface Palette {
  readonly id: string;
  readonly label: string
  readonly colours: readonly PaletteColour[];
}

/** Said beside every palette, so nobody reads a screen colour as a factory's colour. */
export const PALETTE_LABEL = "Knitwright draft v0.1, not reviewed by a factory. Screen colours only.";
/** The rulebook entry that explains why a screen colour is not a colour reference. */
export const PALETTE_RULE_ID = "R-SUB-005";

const colour = (id: string, label: string, swatch: string): PaletteColour => ({ id, label, swatch });

/**
 * The three palettes the spec names. Each is a short, labelled starting point, not a colour system:
 * a brand that has its own colours uses its brand kit instead.
 */
export const SPORTSWEAR_PALETTES: readonly Palette[] = [
  {
    id: "classic-club",
    label: "Classic club colours",
    colours: [
      colour("classic-navy", "Navy", "#101c3d"),
      colour("classic-royal", "Royal blue", "#14389c"),
      colour("classic-claret", "Claret", "#6b1130"),
      colour("classic-forest", "Forest green", "#11452a"),
      colour("classic-gold", "Gold", "#c89b23"),
      colour("classic-white", "White", "#f7f7f5"),
      colour("classic-black", "Black", "#15151a"),
    ],
  },
  {
    id: "neon-training",
    label: "Neon training",
    colours: [
      colour("neon-lime", "Lime", "#c6f53d"),
      colour("neon-cyan", "Cyan", "#22d3e3"),
      colour("neon-magenta", "Magenta", "#ec2f8a"),
      colour("neon-orange", "Orange", "#ff6a1f"),
      colour("neon-violet", "Violet", "#7b45f0"),
      colour("neon-graphite", "Graphite", "#2a2d33"),
    ],
  },
  {
    id: "retro-90s",
    label: "Retro 90s",
    colours: [
      colour("retro-teal", "Teal", "#128f85"),
      colour("retro-purple", "Purple", "#4d2a73"),
      colour("retro-cream", "Cream", "#efe4c6"),
      colour("retro-brick", "Brick", "#b24227"),
      colour("retro-mustard", "Mustard", "#d6a21b"),
      colour("retro-slate", "Slate", "#49596b"),
    ],
  },
];

/** The palette of this id, or undefined. */
export const paletteOf = (id: string): Palette | undefined => SPORTSWEAR_PALETTES.find((entry) => entry.id === id);
