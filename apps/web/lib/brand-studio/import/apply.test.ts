import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE } from "../types";
import { assetsSchema, fontsSchema, hexSchema, profileSchema } from "../schemas";
import { LIMITS } from "../words";
import { acceptedStyle, changesNothing, planOf, profileFor } from "./apply";
import { decide, decideKind, tickRights } from "./decisions";
import { itemId } from "./items";
import { IMPORTED_PALETTE_NAME } from "./palette";
import { proposal } from "./fixtures/proposal";

/**
 * An accepted import writes through Brand Studio's own functions, into Brand Studio's own tables,
 * so every body this builds must be one `lib/brand-studio/schemas.ts` already accepts. The tests
 * parse each one with that schema rather than trusting the shape.
 */

const now = new Date("2026-11-02T10:00:00.000Z");
const logoId = itemId("logo", "https://ravensmoor.test/media/logo.png");
const styleId = itemId("style", "all");

describe("profileFor", () => {
  it("lays the three texts over the brand's own details and carries everything else untouched", () => {
    const current = { ...EMPTY_PROFILE, category: "club" as const, about: "A club in the north.", voiceTags: ["community" as const], defaultSizeRange: ["S", "M"] };
    const body = profileFor(current, decide(proposal(), styleId, "accepted"));
    expect(body).not.toBeNull();
    expect(profileSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ category: "club", about: "A club in the north.", voiceTags: ["community"], defaultSizeRange: ["S", "M"] });
    expect(body?.setting).toContain("A wet pitch at dusk");
  });

  it("takes the imported site as the website when the brand had none", () => {
    expect(profileFor(EMPTY_PROFILE, proposal())?.website).toBe("https://ravensmoor.test/");
  });

  it("never overwrites a website the brand already gave", () => {
    const current = { ...EMPTY_PROFILE, website: "https://ravensmoor.test/about" };
    expect(profileFor(current, decide(proposal(), styleId, "accepted"))?.website).toBe("https://ravensmoor.test/about");
  });

  it("keeps the brand's own texts when the style was not kept", () => {
    const current = { ...EMPTY_PROFILE, website: "https://ravensmoor.test/", style: { setting: "Mine.", artDirection: "", rulesBoundaries: "" } };
    expect(profileFor(current, proposal())).toBeNull();
  });
});

describe("acceptedStyle", () => {
  it("gives the three texts only when the person kept them", () => {
    expect(acceptedStyle(proposal())).toBeNull();
    expect(acceptedStyle(decide(proposal(), styleId, "accepted"))?.setting).toContain("A wet pitch");
  });

  it("gives nothing when nothing was written", () => {
    expect(acceptedStyle(proposal({ style: null }))).toBeNull();
  });
});

describe("planOf", () => {
  it("makes a palette of the colours the person kept, in the body savePalette takes", () => {
    const kept = decideKind(proposal(), "colour", "accepted");
    const plan = planOf(kept, EMPTY_PROFILE, "u1", now);
    expect(plan.palette).toMatchObject({ paletteId: null, name: IMPORTED_PALETTE_NAME });
    expect(plan.palette?.colours.map((colour) => colour.hex)).toEqual(["#0b1f4b", "#ffd100"]);
    // Every colour is one the colour schema itself accepts, and the palette is inside the limits
    // the database holds, so nothing here can be refused for its shape.
    expect(plan.palette?.colours.every((colour) => hexSchema.safeParse(colour.hex).success)).toBe(true);
    expect((plan.palette?.colours ?? []).length).toBeLessThanOrEqual(LIMITS.coloursPerPalette);
    expect(IMPORTED_PALETTE_NAME.length).toBeLessThanOrEqual(LIMITS.paletteName);
  });

  it("names no colour and works out no Pantone code: a person does both", () => {
    const plan = planOf(decideKind(proposal(), "colour", "accepted"), EMPTY_PROFILE, "u1", now);
    expect(plan.palette?.colours.every((colour) => colour.name === "" && colour.pantoneTcx === null)).toBe(true);
  });

  it("makes no palette when no colour was kept", () => {
    expect(planOf(proposal(), EMPTY_PROFILE, "u1", now).palette).toBeNull();
  });

  it("saves only the roles that were kept and that have a font Knitwright may use", () => {
    const kept = decideKind(proposal(), "font", "accepted");
    const plan = planOf(kept, EMPTY_PROFILE, "u1", now);
    expect(fontsSchema.safeParse(plan.fonts).success).toBe(true);
    expect(plan.fonts?.fonts.map((font) => font.role)).toEqual(["headline", "subheadline", "body", "accent"]);
    expect(plan.fonts?.fonts.every((font) => font.fontKey === "geist")).toBe(true);
  });

  it("asks for no upload while the rights box is unticked", () => {
    expect(planOf(decide(proposal(), logoId, "accepted"), EMPTY_PROFILE, "u1", now).uploads).toEqual([]);
  });

  it("asks for the kept pictures once the box is ticked, as the brand's own uploads", () => {
    const kept = tickRights(decide(proposal(), logoId, "accepted"), true);
    const plan = planOf(kept, EMPTY_PROFILE, "u1", now);
    expect(plan.uploads).toHaveLength(1);
    expect(plan.uploads[0]?.assetKind).toBe("logo");
  });

  it("offers a label the assets schema accepts for every upload", () => {
    const kept = tickRights(decideKind(decideKind(proposal(), "logo", "accepted"), "graphic", "accepted"), true);
    const plan = planOf(kept, EMPTY_PROFILE, "u1", now);
    for (const upload of plan.uploads) {
      const body = { kind: upload.assetKind, assets: [{ artworkId: "11111111-1111-4111-8111-111111111111", label: upload.label, sponsorName: "", printWidthMm: null }] };
      expect(assetsSchema.safeParse(body).success, upload.label).toBe(true);
    }
  });

  it("writes nothing at all for an import nobody looked at, except the website the brand lacked", () => {
    const plan = planOf(proposal(), EMPTY_PROFILE, "u1", now);
    expect(plan.palette).toBeNull();
    expect(plan.fonts).toBeNull();
    expect(plan.uploads).toEqual([]);
    expect(plan.profile?.setting).toBe("");
  });
});

describe("changesNothing", () => {
  it("is true when an accepted import would write nothing", () => {
    const current = { ...EMPTY_PROFILE, website: "https://ravensmoor.test/" };
    expect(changesNothing(planOf(proposal(), current, "u1", now))).toBe(true);
  });

  it("is false as soon as one row was kept", () => {
    const current = { ...EMPTY_PROFILE, website: "https://ravensmoor.test/" };
    expect(changesNothing(planOf(decideKind(proposal(), "colour", "accepted"), current, "u1", now))).toBe(false);
  });
});
