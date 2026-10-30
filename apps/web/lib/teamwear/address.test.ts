import { describe, expect, it } from "vitest";
import { readAddress } from "@/lib/editor";
import { articleBook } from "./fixtures/kit";
import { configuratorHref, kitAddressKey, kitFromAddress, kitStateOf, parsePart, parseSaved, parseSport, readKitAddress, studioHref } from "./address";
import { chooseOption, chooseParameter, startingKit, withPart } from "./kit";
import { jersey } from "./fixtures/kit";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("the configurator's own address", () => {
  it("reads the sport and falls back to football", () => {
    expect(parseSport({ sport: "cricket" })).toBe("cricket");
    expect(parseSport({ sport: ["winter-code"] })).toBe("winter-code");
    expect(parseSport({})).toBe("football");
    expect(parseSport({ sport: "quidditch" })).toBe("football");
  });

  it("reads the part the panel shows, and falls back to the sport's first part", () => {
    expect(parsePart({ part: "socks" }, "football")).toBe("socks");
    expect(parsePart({}, "football")).toBe("shirt");
    // The winter code has a shirt only, so a request for socks cannot be honoured.
    expect(parsePart({ part: "socks" }, "winter-code")).toBe("shirt");
  });

  it("reads a saved design, and refuses anything that is not one", () => {
    expect(parseSaved({ project: PROJECT, v: "3" })).toEqual({ projectId: PROJECT, version: 3 });
    expect(parseSaved({ project: PROJECT })).toBeNull();
    expect(parseSaved({ project: PROJECT, v: "0" })).toBeNull();
    expect(parseSaved({ project: "not-a-design", v: "1" })).toBeNull();
    expect(parseSaved({})).toBeNull();
  });

  it("writes an address that opens the same sport, part and saved design again", () => {
    const href = configuratorHref({ sportId: "cricket", part: "shorts", market: "au", saved: { projectId: PROJECT, version: 2 } });
    const query = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(href.startsWith("/teamwear?")).toBe(true);
    expect(parseSport(query)).toBe("cricket");
    expect(parsePart(query, "cricket")).toBe("shorts");
    expect(parseSaved(query)).toEqual({ projectId: PROJECT, version: 2 });
  });

  it("leaves the market and the saved design out when there are none", () => {
    expect(configuratorHref({ sportId: "football", part: "shirt" })).toBe("/teamwear?sport=football&part=shirt");
  });
});

describe("the kit the address carries", () => {
  const kitOf = () => {
    let kit = startingKit("football", articleBook());
    kit = { ...kit, wearer: "youth", colours: { main: "#1b2a49", second: "#d4af37", third: "#00843d" }, socksColour: "#ffffff" };
    return withPart(kit, "shirt", (choice) =>
      chooseParameter(chooseOption(choice, jersey(), "collar", "C02", "option:collar"), jersey(), "body_length_offset", 20, "parameters"),
    );
  };

  it("takes the whole kit there and back, so a reload opens the same kit", () => {
    const kit = kitOf();
    const href = configuratorHref({ sportId: "football", part: "shirt", kit: kitStateOf(kit, "shirt") });
    const search = new URLSearchParams(href.split("?")[1]);
    const query = { ...Object.fromEntries(search), opt: search.getAll("opt"), par: search.getAll("par") };
    const again = kitFromAddress(readKitAddress(query), articleBook());
    expect(again.wearer).toBe("youth");
    expect(again.colours).toEqual(kit.colours);
    expect(again.socksColour).toBe("#ffffff");
    expect(again.parts.shirt?.form).toEqual(kit.parts.shirt?.form);
    expect(again.parts.shirt?.quantity).toBe(kit.parts.shirt?.quantity);
  });

  it("starts a kit on the sport's own defaults when the address carries none", () => {
    const plain = kitFromAddress(readKitAddress({}), articleBook());
    expect(plain).toEqual(startingKit("football", articleBook()));
  });

  it("drops a colour that is not a colour, and keeps a palette only when it has both of the first two", () => {
    expect(readKitAddress({ c1: "navy", c2: "#d4af37" }).colours).toBeNull();
    expect(readKitAddress({ c1: "#1b2a49" }).colours).toBeNull();
    expect(readKitAddress({ c1: "#1b2a49", c2: "#d4af37", c3: "nope" }).colours).toEqual({ main: "#1b2a49", second: "#d4af37", third: null });
    expect(readKitAddress({ cs: "#fff" }).socksColour).toBeNull();
  });

  it("drops a wearer the registry does not know and a quantity that is not a whole number of pieces", () => {
    expect(readKitAddress({ for: "dogs" }).wearer).toBeNull();
    expect(readKitAddress({ for: "youth" }).wearer).toBe("youth");
    expect(readKitAddress({ qty: "0" }).quantity).toBeNull();
    expect(readKitAddress({ qty: "soon" }).quantity).toBeNull();
    expect(readKitAddress({ qty: "40" }).quantity).toBe(40);
  });

  it("refuses an option code and a parameter the article does not offer, however the address is written by hand", () => {
    const kit = kitFromAddress(readKitAddress({ opt: ["collar:C99"], par: ["body_length_offset:15"] }), articleBook());
    expect(kit.parts.shirt?.form.options.collar).toBe("C01");
    expect(kit.parts.shirt?.form.parameters.body_length_offset).toBe(0);
  });

  it("leaves a part with no article on its empty form, whatever the address says", () => {
    const kit = kitFromAddress(readKitAddress({ part: "socks", opt: ["collar:C02"] }), articleBook());
    expect(kit.parts.socks?.form).toEqual({ options: {}, parameters: {} });
  });

  it("gives the same key for the same address and a different one for a different kit", () => {
    const one = readKitAddress({ c1: "#1b2a49", c2: "#d4af37", opt: ["collar:C02", "sleeve_finish:K01"] });
    const same = readKitAddress({ c2: "#d4af37", c1: "#1b2a49", opt: ["sleeve_finish:K01", "collar:C02"] });
    const other = readKitAddress({ c1: "#1b2a49", c2: "#d4af37", opt: ["collar:C01"] });
    expect(kitAddressKey(one, null)).toBe(kitAddressKey(same, null));
    expect(kitAddressKey(one, null)).not.toBe(kitAddressKey(other, null));
    expect(kitAddressKey(one, null)).not.toBe(kitAddressKey(one, { projectId: PROJECT, version: 1 }));
    expect(kitAddressKey(one, { projectId: PROJECT, version: 1 })).not.toBe(kitAddressKey(one, { projectId: PROJECT, version: 2 }));
  });

  it("has no kit state for a part the sport does not offer", () => {
    expect(kitStateOf(startingKit("winter-code", articleBook()), "socks")).toBeUndefined();
  });

  it("keeps the kit for a part the sport does not hold, rather than failing", () => {
    const kit = kitFromAddress({ ...readKitAddress({}), part: "socks", sportId: "winter-code" }, articleBook());
    expect(Object.keys(kit.parts)).toEqual(["shirt"]);
  });
});

describe("Design in Studio", () => {
  it("opens the saved design in the editor, on the 3D canvas with the Form toolbar open", () => {
    const href = studioHref(PROJECT, startingKit("football", articleBook()).parts.shirt!);
    expect(href.startsWith(`/studio/${PROJECT}?`)).toBe(true);
    const address = readAddress(Object.fromEntries(new URLSearchParams(href.split("?")[1])), "2d");
    expect(address.segment).toBe("form");
    expect(address.view).toBe("3d");
  });

  it("hands the editor the very option codes and parameters the configurator had", () => {
    let choice = startingKit("football", articleBook()).parts.shirt!;
    choice = chooseOption(choice, jersey(), "collar", "C02", "option:collar");
    choice = chooseParameter(choice, jersey(), "body_length_offset", 20, "parameters");
    const query = Object.fromEntries(new URLSearchParams(studioHref(PROJECT, choice).split("?")[1]));
    const repeated = new URLSearchParams(studioHref(PROJECT, choice).split("?")[1]);
    const address = readAddress({ ...query, opt: repeated.getAll("opt"), par: repeated.getAll("par") }, "2d");
    expect(address.options).toEqual({ collar: "C02", sleeve_finish: "K01", pattern_fill: "P00" });
    expect(address.parameters).toEqual({ body_length_offset: "20", sleeve_length_offset: "0", back_drop_tail: "0" });
  });
});
