import { describe, expect, it } from "vitest";
import {
  connectBoardsBody,
  createLaunchProjectBody,
  disconnectBoardsBody,
  removeBoardBody,
  removeLaunchProjectBody,
  saveBoardBody,
  saveLaunchProjectBody,
  saveVersionBody,
  snapshotSchema,
} from "./schemas";

/** What the launch screens may send. The brand and the person are never in a body. */

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("starting and changing a canvas", () => {
  it("takes a name and falls back to pixels", () => {
    expect(createLaunchProjectBody.parse({ name: "  Home kit  " })).toEqual({ name: "Home kit", units: "px", designProjectId: null });
  });

  it("refuses an empty name, a unit it does not know and a design that is not an id", () => {
    expect(createLaunchProjectBody.safeParse({ name: "  " }).success).toBe(false);
    expect(createLaunchProjectBody.safeParse({ name: "Kit", units: "cm" }).success).toBe(false);
    expect(createLaunchProjectBody.safeParse({ name: "Kit", designProjectId: "nope" }).success).toBe(false);
  });

  it("lets a change leave the name, the unit and the palette alone", () => {
    expect(saveLaunchProjectBody.parse({ launchProjectId: ID })).toEqual({ launchProjectId: ID, name: null, units: null, colours: null });
  });

  it("takes a palette of named colours and refuses a colour that is not a hex triple", () => {
    expect(saveLaunchProjectBody.parse({ launchProjectId: ID, colours: [{ hex: "#0B1F4B", name: "Navy" }] }).colours).toEqual([{ hex: "#0B1F4B", name: "Navy" }]);
    expect(saveLaunchProjectBody.safeParse({ launchProjectId: ID, colours: [{ hex: "navy", name: "Navy" }] }).success).toBe(false);
    expect(saveLaunchProjectBody.safeParse({ launchProjectId: ID, colours: Array.from({ length: 49 }, () => ({ hex: "#000000", name: "Ink" })) }).success).toBe(false);
  });

  it("takes an id to remove a canvas, a board, a connector or to save a version", () => {
    // Removing the whole canvas also asks for the typed word, as deleting a design does.
    expect(removeLaunchProjectBody.parse({ launchProjectId: ID, confirm: "delete" })).toEqual({ launchProjectId: ID, confirm: "delete" });
    expect(removeLaunchProjectBody.safeParse({ launchProjectId: ID }).success).toBe(false);
    expect(removeLaunchProjectBody.safeParse({ launchProjectId: ID, confirm: "yes" }).success).toBe(false);
    expect(removeBoardBody.parse({ launchProjectId: ID, boardId: OTHER })).toEqual({ launchProjectId: ID, boardId: OTHER });
    expect(disconnectBoardsBody.parse({ launchProjectId: ID, edgeId: OTHER })).toEqual({ launchProjectId: ID, edgeId: OTHER });
    expect(saveVersionBody.parse({ launchProjectId: ID })).toEqual({ launchProjectId: ID });
  });
});

describe("saving a board", () => {
  it("fills in a place, a size and empty settings", () => {
    expect(saveBoardBody.parse({ launchProjectId: ID, kind: "design" })).toEqual({
      launchProjectId: ID,
      boardId: null,
      kind: "design",
      name: "",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      settings: {},
      inputVersion: null,
    });
  });

  it("refuses a kind it does not know and a size outside the bounds the canvas can draw", () => {
    expect(saveBoardBody.safeParse({ launchProjectId: ID, kind: "banner" }).success).toBe(false);
    expect(saveBoardBody.safeParse({ launchProjectId: ID, kind: "design", width: 4 }).success).toBe(false);
    expect(saveBoardBody.safeParse({ launchProjectId: ID, kind: "design", height: 99_999 }).success).toBe(false);
    expect(saveBoardBody.safeParse({ launchProjectId: ID, kind: "design", x: 2_000_000 }).success).toBe(false);
  });
});

describe("connecting two boards", () => {
  it("takes the pair and the input number, and starts at the first input", () => {
    expect(connectBoardsBody.parse({ launchProjectId: ID, fromBoardId: ID, toBoardId: OTHER })).toMatchObject({ inputIndex: 1 });
  });

  it("refuses an input number no board kind has", () => {
    expect(connectBoardsBody.safeParse({ launchProjectId: ID, fromBoardId: ID, toBoardId: OTHER, inputIndex: 0 }).success).toBe(false);
    expect(connectBoardsBody.safeParse({ launchProjectId: ID, fromBoardId: ID, toBoardId: OTHER, inputIndex: 99 }).success).toBe(false);
  });
});

describe("the shape of a saved version", () => {
  const snapshot = {
    kind: "launch-canvas",
    snapshotVersion: 1,
    savedAt: "2026-12-01T10:00:00.000Z",
    units: "px",
    colours: [],
    boards: [{ id: ID, kind: "design", name: "Home v7", x: 0, y: 0, width: 1080, height: 1080, settings: {}, inputVersion: 7, status: "empty" }],
    edges: [{ fromBoardId: ID, toBoardId: OTHER, inputIndex: 1 }],
  };

  it("is read back as a canvas, and as nothing else", () => {
    expect(snapshotSchema.parse(snapshot).boards).toHaveLength(1);
    expect(snapshotSchema.safeParse({ ...snapshot, kind: "collection-drop" }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, snapshotVersion: 2 }).success).toBe(false);
  });
});
