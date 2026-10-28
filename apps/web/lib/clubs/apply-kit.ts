import type { Artwork, Colourway, GarmentSpec, SpecAction } from "@/lib/garment";
import { panelsFor } from "@/lib/garment";
import type { Kit } from "./kit";
import { APPLY_PARTS, type ApplyPart } from "./wording";

/**
 * "Use the club's colours, crest and sponsors" on a design (plan V4, task 4). The kit is READ and
 * its values are COPIED into the design as ordinary changes (a colourway and artwork), so the design
 * keeps its own copy: changing the kit later never changes a design, and a design never reads the kit.
 *
 * Where the crest and sponsors go is not in the kit. The places and sizes below are labelled starting
 * points for a person to move in the editor; they are not a measurement and not a club rule.
 */
export { APPLY_PARTS, type ApplyPart };

export const CLUB_COLOURWAY_ID = "club-colours";
export const CREST_ID = "club-crest";
const sponsorId = (index: number): string => `club-sponsor-${index + 1}`;

/** Tenths of a millimetre. Starting sizes only: "Knitwright starting size, not from your club". */
const STARTING_SIZES = {
  crest: { width: 800, height: 800 },
  chestSponsor: { width: 2000, height: 500 },
  sleeveSponsor: { width: 800, height: 300 },
} as const;

const TRIM_PANEL = /collar|neckband|cuff|waistband|placket|binding|trim|hem/;
const SLEEVE_PANEL = /sleeve/;

type PanelPlan = Readonly<{ id: string; anchors: readonly string[] }>;

/** Which of the kit's colours a panel takes: body in primary, sleeves in secondary, trims in the accent. */
export function colourForPanel(panelId: string, kit: Kit): string | null {
  if (TRIM_PANEL.test(panelId)) return kit.accentColour ?? kit.secondaryColour ?? kit.primaryColour;
  if (SLEEVE_PANEL.test(panelId)) return kit.secondaryColour ?? kit.primaryColour;
  return kit.primaryColour;
}

type KitApplication = Readonly<{
  actions: readonly SpecAction[];
  /** What was put on the design, and what could not be, in plain words. */
  notes: readonly string[];
}>;

const hasAnchor = (panels: readonly PanelPlan[], panelId: string, anchor: string): boolean =>
  panels.some((panel) => panel.id === panelId && panel.anchors.includes(anchor));

const colourAction = (spec: GarmentSpec, kit: Kit, panels: readonly PanelPlan[]): KitApplication => {
  const colours = panels.flatMap((panel) => {
    const swatch = colourForPanel(panel.id, kit);
    return swatch ? [{ panelId: panel.id, colour: "", swatch, provenance: "brand-supplied" as const }] : [];
  });
  if (colours.length === 0) return { actions: [], notes: ["The kit has no colours yet, so no colours were put on the design."] };
  const colourway: Colourway = { id: CLUB_COLOURWAY_ID, name: "Club colours", colours };
  const exists = spec.colourways.some((entry) => entry.id === CLUB_COLOURWAY_ID);
  return {
    actions: [{ type: exists ? "update-colourway" : "add-colourway", colourway }],
    notes: [`Club colours put on ${colours.length} ${colours.length === 1 ? "part" : "parts"}. They are screen colours; add a colour reference for the factory.`],
  };
};

type Place = Readonly<{ panelId: string; anchor: string; size: { readonly width: number; readonly height: number } }>;

const artwork = (id: string, name: string, source: Artwork["source"], place: Place): Artwork => ({
  id,
  name,
  source,
  panelId: place.panelId,
  anchor: place.anchor,
  offsetX: 0,
  offsetY: 0,
  width: place.size.width,
  height: place.size.height,
  rotationDegrees: 0,
  technique: "sublimation",
  provenance: "brand-supplied",
});

const placeAction = (spec: GarmentSpec, art: Artwork): SpecAction => ({
  type: spec.artwork.some((entry) => entry.id === art.id) ? "update-artwork" : "add-artwork",
  artwork: art,
});

const crestAction = (spec: GarmentSpec, kit: Kit, panels: readonly PanelPlan[]): KitApplication => {
  if (!kit.crestFileId) return { actions: [], notes: ["The kit has no crest yet."] };
  const place: Place = { panelId: "body-front", anchor: "left-chest", size: STARTING_SIZES.crest };
  if (!hasAnchor(panels, place.panelId, place.anchor)) return { actions: [], notes: ["This garment has no place for a crest on the chest."] };
  const art = artwork(CREST_ID, "Club crest", { kind: "file", fileId: kit.crestFileId }, place);
  return { actions: [placeAction(spec, art)], notes: ["Crest placed on the left chest at a starting size. Move or resize it in the editor."] };
};

const SPONSOR_PLACES: readonly Place[] = [
  { panelId: "body-front", anchor: "centre-chest", size: STARTING_SIZES.chestSponsor },
  { panelId: "sleeve-left", anchor: "sleeve-centre", size: STARTING_SIZES.sleeveSponsor },
  { panelId: "sleeve-right", anchor: "sleeve-centre", size: STARTING_SIZES.sleeveSponsor },
];

const sponsorActions = (spec: GarmentSpec, kit: Kit, panels: readonly PanelPlan[]): KitApplication => {
  if (kit.sponsors.length === 0) return { actions: [], notes: ["The kit has no sponsors yet."] };
  const actions: SpecAction[] = [];
  const notes: string[] = [];
  kit.sponsors.forEach((sponsor, index) => {
    const place = SPONSOR_PLACES[index];
    if (!place || !hasAnchor(panels, place.panelId, place.anchor)) {
      notes.push(`This garment has no place for ${sponsor.name}.`);
      return;
    }
    const source: Artwork["source"] = sponsor.logoFileId ? { kind: "file", fileId: sponsor.logoFileId } : { kind: "text", text: sponsor.name };
    actions.push(placeAction(spec, artwork(sponsorId(index), sponsor.name, source, place)));
    notes.push(`${sponsor.name} placed at a starting size${sponsor.logoFileId ? "" : ", as its name in text because the kit has no logo for it"}.`);
  });
  return { actions, notes };
};

/**
 * The changes that put the chosen parts of the kit on a design. Pure: it reads the design and the
 * kit and returns changes; nothing is stored here. Applying twice gives the same design, because the
 * ids are fixed and a second application updates what the first added.
 */
export function applyKit(spec: GarmentSpec, kit: Kit, parts: readonly ApplyPart[]): KitApplication {
  const panels: readonly PanelPlan[] = panelsFor(spec).map((panel) => ({ id: panel.id, anchors: panel.anchors.map((anchor) => anchor.id) }));
  const wanted = APPLY_PARTS.filter((part) => parts.includes(part));
  const steps = wanted.map((part) => {
    if (part === "colours") return colourAction(spec, kit, panels);
    if (part === "crest") return crestAction(spec, kit, panels);
    return sponsorActions(spec, kit, panels);
  });
  return { actions: steps.flatMap((step) => step.actions), notes: steps.flatMap((step) => step.notes) };
}
