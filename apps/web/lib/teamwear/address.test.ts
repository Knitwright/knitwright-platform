import { describe, expect, it } from "vitest";
import { readAddress } from "@/lib/editor";
import { articleBook } from "./fixtures/kit";
import { configuratorHref, parsePart, parseSaved, parseSport, studioHref } from "./address";
import { chooseOption, chooseParameter, startingKit } from "./kit";
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
