import { describe, expect, it } from "vitest";
import type { ProjectSummary } from "@/lib/projects/service";
import { designsToRead, homeDetails, namesToRead, type DetailsInput } from "./details";

const NOW = new Date("2026-10-14T12:00:00.000Z");

const design = (id: string, name: string, updatedAt = "2026-10-13T10:00:00Z"): ProjectSummary => ({
  id,
  name,
  styleNumber: "",
  season: "",
  garmentType: "crew-tee",
  garmentLabel: "Crew neck tee",
  currentVersion: 1,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt,
});

const A = design("a", "Home shirt");
const B = design("b", "Away shirt");
const C = design("c", "Training top");

const input = (overrides: Partial<DetailsInput> = {}): DetailsInput => ({
  shown: [A, B],
  recent: [B, C],
  facts: new Map([
    ["a", { toConfirm: 4, thumbnail: { src: "data:image/svg+xml;charset=utf-8,a" } }],
    ["b", { toConfirm: 0, thumbnail: null }],
    ["c", { toConfirm: 2, thumbnail: null }],
  ]),
  marks: new Map([["b", { shared: true, quoted: false, downloaded: false }]]),
  links: [],
  answers: [],
  quotes: [],
  names: new Map([
    ["a", "Home shirt"],
    ["b", "Away shirt"],
    ["c", "Training top"],
  ]),
  now: NOW,
  ...overrides,
});

describe("designsToRead", () => {
  it("reads each design once, the page's first and then the recent ones not on it", () => {
    expect(designsToRead([A, B], [B, C]).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("namesToRead", () => {
  it("lists the designs named by links and quotes whose names were not read, once each", () => {
    const known = new Map([["a", "Home shirt"]]);
    const links = [
      { id: "l1", projectId: "a", createdAt: "", expiresAt: "", revokedAt: null },
      { id: "l2", projectId: "x", createdAt: "", expiresAt: "", revokedAt: null },
    ];
    expect(namesToRead(known, links, [{ projectId: "x" }, { projectId: "y" }])).toEqual(["x", "y"]);
  });
});

describe("homeDetails", () => {
  it("gives each design on the page its step and its drawing", () => {
    const details = homeDetails(input());

    expect(details.cards.get("a")).toEqual({ step: "design", thumbnail: { src: "data:image/svg+xml;charset=utf-8,a" } });
    expect(details.cards.get("b")).toEqual({ step: "committee", thumbnail: null });
    expect(details.cards.has("c")).toBe(false);
  });

  it("gives a design that could not be read the first step and no drawing", () => {
    const details = homeDetails(input({ facts: new Map() }));

    expect(details.cards.get("a")).toEqual({ step: "design", thumbnail: null });
  });

  it("lists what the recent designs need, with the votes and quotes of the brand", () => {
    const details = homeDetails(
      input({
        links: [{ id: "l1", projectId: "b", createdAt: "2026-10-12T10:00:00Z", expiresAt: "2026-10-20T10:00:00Z", revokedAt: null }],
        answers: [{ linkId: "l1", vote: "yes", updatedAt: "2026-10-13T11:00:00Z" }],
        quotes: [{ id: "q1", projectId: "c", quantity: 40, status: "quoted", updatedAt: "2026-10-13T09:00:00Z" }],
      }),
    );

    const kinds = details.needsYou.items.map((item) => item.kind);
    expect(kinds).toContain("vote");
    expect(kinds).toContain("quote-sent");
    expect(kinds).toContain("confirm");
  });

  it("leaves out a quote whose design has no name to show", () => {
    const details = homeDetails(
      input({ quotes: [{ id: "q1", projectId: "gone", quantity: 40, status: "quoted", updatedAt: "2026-10-13T09:00:00Z" }] }),
    );

    expect(details.needsYou.items.some((item) => item.kind === "quote-sent")).toBe(false);
  });
});
