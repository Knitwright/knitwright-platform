/**
 * The parts of the Library toolbar whose data is not on the slot contract (plan v5 Y3, decision
 * 0076, Lesson 9). A slot panel is given `EditorSlotProps` and nothing else, and it never fetches,
 * so the Pantone search, the graphics library and everything under "Your library" arrive through
 * these interfaces. Each has a deterministic stub that says plainly that it is not available; no
 * stub ever makes a paid call, and none of them is wired in this workstream.
 *
 * A port that cannot answer returns `{ available: false, reason }`. The toolbar shows the reason
 * where the items would be, so the section is labelled rather than empty and silent.
 */

export interface PortReply<T> {
  readonly available: boolean;
  /** Empty when the port is not available. */
  readonly items: readonly T[];
  /** Why there is nothing, in words a person reads. Null when the port answered. */
  readonly reason: string | null;
}

export interface ColourHit {
  readonly code: string;
  readonly label: string;
  /** The screen colour the library publishes for the code, when it publishes one. */
  readonly swatch: string | null;
}

/**
 * Pantone's TCX library is licensed, and the platform has never looked a code up
 * (`lib/garment/parts.ts`). A real adapter needs a licence and an env key, and would still never be
 * called from a test or from CI.
 */
export interface ColourSearchPort {
  search(term: string): Promise<PortReply<ColourHit>>;
}

export interface GraphicRef {
  readonly id: string;
  readonly label: string;
  readonly kind: "icon" | "number" | "texture";
}

/** Sport icons, numbers and textures. Knitwright has none on file yet. */
export interface GraphicsPort {
  list(): Promise<PortReply<GraphicRef>>;
}

export interface OwnedItem {
  readonly id: string;
  readonly label: string;
  readonly kind: "brand-colour" | "brand-mark" | "palette" | "pattern-fill" | "upload";
}

/** Brand kit, palettes, pattern fills and uploads: the brand's own things, which need a session. */
export interface YourLibraryPort {
  list(): Promise<PortReply<OwnedItem>>;
}

export const NO_TCX_LICENCE =
  "Pantone's TCX library is licensed and Knitwright has no licence on file, so codes are not searched here. Type the colour reference your brand uses, or pick a screen colour from a palette.";
export const NO_GRAPHICS =
  "Knitwright has no graphics library on file yet, so there is nothing to show. Upload your own artwork instead.";
export const NO_OWN_LIBRARY =
  "Your brand kit, palettes, pattern fills and uploads are not on the editor's slot contract yet, so this panel cannot read them. Open Brand kit from the sidebar meanwhile.";

const refused = <T,>(reason: string): PortReply<T> => ({ available: false, items: [], reason });

/** The stub every test and every run uses: it answers at once, costs nothing and promises nothing. */
export const standInColourSearch: ColourSearchPort = { search: async () => refused(NO_TCX_LICENCE) };
export const standInGraphics: GraphicsPort = { list: async () => refused(NO_GRAPHICS) };
export const standInYourLibrary: YourLibraryPort = { list: async () => refused(NO_OWN_LIBRARY) };
