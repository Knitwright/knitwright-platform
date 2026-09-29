import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { MAX_PROMPT_CHARS, buildImagePrompt, cleanText } from "./prompt";

const tee = start("crew-tee", "women");

const dressed = (patch: Partial<GarmentSpec>): GarmentSpec => ({ ...tee, ...patch }) as GarmentSpec;

describe("buildImagePrompt", () => {
  it("names the garment, the wearer and the view", () => {
    const front = buildImagePrompt(tee, "front");
    const back = buildImagePrompt(tee, "back");

    expect(front).toMatch(/crew/i);
    expect(front).toContain("women's");
    expect(front).toContain("front view");
    expect(back).toContain("back view");
    expect(back).not.toContain("front view");
  });

  it("lists the chosen option of every option, by its label", () => {
    const prompt = buildImagePrompt(tee, "front");

    expect(prompt).toContain("Neckline: Round neck");
    expect(prompt).toContain("Sleeve length:");
    expect(prompt).not.toContain("sleeve-length");
  });

  it("gives each coloured panel its colour, and the swatch when there is one", () => {
    const spec = dressed({
      colourways: [
        {
          id: "main",
          name: "Main colourway",
          colours: [
            { panelId: "body-front", colour: "Navy", swatch: "#1b2a49", provenance: "user-edited" },
            { panelId: "body-back", colour: "", swatch: "#ffffff", provenance: "user-edited" },
          ],
        },
      ],
    });

    const prompt = buildImagePrompt(spec, "front");

    expect(prompt).toContain("Navy (#1b2a49)");
    expect(prompt).toContain("#ffffff");
  });

  it("uses the colourway asked for, not the first one", () => {
    const spec = dressed({
      colourways: [
        { id: "main", name: "Main", colours: [{ panelId: "body-front", colour: "Navy", provenance: "user-edited" }] },
        { id: "alt", name: "Alt", colours: [{ panelId: "body-front", colour: "Lime", provenance: "user-edited" }] },
      ],
    });

    expect(buildImagePrompt(spec, "front", "alt")).toContain("Lime");
    expect(buildImagePrompt(spec, "front", "alt")).not.toContain("Navy");
  });

  it("describes the main fabric only with what the user filled in", () => {
    const empty = buildImagePrompt(tee, "front");
    const [first] = tee.fabrics;
    const spec = dressed({
      fabrics: [{ ...first, composition: "100% polyester", weightGsm: 140, finish: "brushed" }],
    });

    expect(empty).not.toMatch(/gsm/);
    expect(buildImagePrompt(spec, "front")).toContain("100% polyester, 140 gsm, brushed");
  });

  it("asks for artwork to be kept exactly as drawn when the design has some", () => {
    const spec = dressed({
      artwork: [
        {
          id: "logo",
          name: "Logo",
          source: { kind: "text", text: "TEAM" },
          panelId: "body-front",
          anchor: "centre-chest",
          offsetX: 0,
          offsetY: 0,
          width: 800,
          height: 300,
          rotationDegrees: 0,
          technique: "screen-print",
          provenance: "user-edited",
        },
      ],
    });

    expect(buildImagePrompt(tee, "front")).toContain("no logos, text or prints");
    expect(buildImagePrompt(spec, "front")).toContain("Keep every logo, text and print exactly");
    expect(buildImagePrompt(spec, "front")).toContain('"TEAM"');
  });

  it("always forbids details that are not in the drawing", () => {
    expect(buildImagePrompt(tee, "front")).toMatch(/do not add/i);
  });

  it("is the same for the same design, so a test can pin it", () => {
    expect(buildImagePrompt(tee, "back")).toBe(buildImagePrompt(tee, "back"));
  });

  it("never grows past the limit, however much text the user wrote", () => {
    const long = "x".repeat(10_000);
    const [first] = tee.fabrics;
    const spec = dressed({ fabrics: [{ ...first, composition: long, finish: long }] });

    expect(buildImagePrompt(spec, "front").length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
  });

  it("gives up on an unknown garment type instead of guessing", () => {
    expect(() => buildImagePrompt({ ...tee, typeId: "no-such-type" } as GarmentSpec, "front")).toThrow();
  });
});

describe("cleanText", () => {
  it("removes control characters and quotes, and folds white space", () => {
    expect(cleanText('  a\u0000b\n\n"c"  ', 50)).toBe("ab 'c'");
  });

  it("cuts long text", () => {
    expect(cleanText("abcdef", 3)).toBe("abc");
  });
});
