import { describe, expect, it } from "vitest";
import { articleBook } from "./fixtures/kit";
import { partOf, startingKit } from "./kit";
import { partPreview, partSpec } from "./preview";
import { sportById } from "./vocabulary";

const football = sportById("football");
const kit = () => ({ ...startingKit("football", articleBook()), colours: { main: "#1b2a49", second: "#d4af37", third: null }, socksColour: "#ffffff" });

describe("one part of a kit as a design", () => {
  it("is the registry type's own starting design, in the club's colours", () => {
    const made = partSpec(kit(), partOf(football, "shirt")!, kit().parts.shirt!, "men");
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.spec.typeId).toBe("football-shirt");
    expect(made.spec.wearer).toBe("men");
    const colours = new Map(made.spec.colourways[0].colours.map((entry) => [entry.panelId, entry.swatch] as const));
    expect(colours.get("body-front")).toBe("#1b2a49");
    expect(colours.get("neckband")).toBe("#d4af37");
  });

  it("colours the socks in the socks colour, trimmed in the club's main", () => {
    const made = partSpec(kit(), partOf(football, "socks")!, kit().parts.socks!, "men");
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.spec.typeId).toBe("football-socks");
    expect(made.spec.colourways[0].colours.every((entry) => entry.swatch === "#ffffff")).toBe(true);
  });

  it("marks every colour as the person's own choice, never as something the app worked out", () => {
    const made = partSpec(kit(), partOf(football, "shirt")!, kit().parts.shirt!, "women");
    expect(made.ok && made.spec.colourways[0].colours.every((entry) => entry.provenance === "user-edited")).toBe(true);
  });

  it("refuses a part whose registry type does not exist, rather than drawing something else", () => {
    const made = partSpec(kit(), { id: "shirt", label: "Shirt", typeId: "quaffle-vest", articleCode: null }, kit().parts.shirt!, "men");
    expect(made).toEqual({ ok: false, reason: "There is no garment type called quaffle-vest." });
  });

  it("writes no base article into the design, because no change in the contract writes one", () => {
    const made = partSpec(kit(), partOf(football, "shirt")!, kit().parts.shirt!, "men");
    expect(made.ok && made.spec.article).toBeUndefined();
  });
});

describe("what the stage draws", () => {
  it("draws the shirt front and back, with the outlines the 3D form is built from", () => {
    const preview = partPreview(kit(), partOf(football, "shirt")!, kit().parts.shirt!, "men");
    expect(preview.status).toBe("drawn");
    if (preview.status !== "drawn") return;
    expect(preview.flat.views.map((view) => view.view)).toEqual(["front", "back"]);
    expect(preview.flat.views[0]!.src.startsWith("data:image/svg+xml;")).toBe(true);
    expect(preview.flat.shape.front.outline.silhouette.length).toBeGreaterThan(0);
    expect(preview.flat.shape.back.outline.silhouette.length).toBeGreaterThan(0);
  });

  it("says a drawing is not to scale while the design has no measurements, rather than implying one", () => {
    const preview = partPreview(kit(), partOf(football, "shirt")!, kit().parts.shirt!, "men");
    expect(preview.status === "drawn" && preview.flat.toScale).toBe(false);
    expect(preview.status === "drawn" && preview.flat.notice).not.toBeNull();
  });

  it("draws the socks too, in the socks colour, so the whole kit is on the stage", () => {
    const preview = partPreview(kit(), partOf(football, "socks")!, kit().parts.socks!, "men");
    expect(preview.status).toBe("drawn");
    expect(preview.status === "drawn" && preview.spec.typeId).toBe("football-socks");
  });

  it("passes the reason on where the design itself could not be made", () => {
    const preview = partPreview(kit(), { id: "shirt", label: "Shirt", typeId: "quaffle-vest", articleCode: null }, kit().parts.shirt!, "men");
    expect(preview.status === "not-drawn" && preview.reason).toMatch(/no garment type called/);
  });

  it("draws the shorts too, so a whole kit can be seen", () => {
    const preview = partPreview(kit(), partOf(football, "shorts")!, kit().parts.shorts!, "men");
    expect(preview.status).toBe("drawn");
  });
});
