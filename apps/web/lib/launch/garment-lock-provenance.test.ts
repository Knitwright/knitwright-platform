import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { acceptOffer, assetLabel, assetOffered, type AssetOffer } from "./assets";
import { recordOutputBody } from "./schemas";
import { recordOutput } from "./service";

/**
 * H1 OF THE V5 SECURITY REVIEW, AS A TEST (decision 0116).
 *
 * The garment lock asks three questions. Two were always answered server-side and are airtight:
 * *is this board a kind a model draws?* comes from `boards.kind`, which is immutable after insert,
 * and *is there a generated board upstream?* comes from a recursive walk of `board_edges`. The
 * third -- *did this file come out of a model?* -- was `asset.provenance`, a `z.enum` in the
 * request body, and `public.files` held no column that could answer instead: a deterministic
 * mockup and an AI lifestyle image are both `kind: "render"`.
 *
 * The attack needed a member with `manageKit` on their own brand and nothing else: add a `design`
 * board and a `mockup` board, connect them, read any generated file id of the brand, and call
 * `recordBoardOutputAction` with `{ role: "print_file", provenance: "deterministic", fileId }`. All
 * six enforcement points agreed, because every one tested the board or the graph and none tested
 * the file. What it bought was not a factory print file -- the print builder reads artwork only
 * from `user_artworks` -- but the mandatory "AI-generated" label on the Store hand-off, which
 * `lib/flows/listing.ts` computes from graph topology and which came out `null`.
 *
 * This file holds the two halves of the fix: the body cannot state a provenance, and the server
 * reads it from the file's own row instead.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const BOARD = "33333333-3333-4333-8333-333333333333";
const CANVAS = "44444444-4444-4444-8444-444444444444";
/** A file a model made: `lib/images/service.ts` stores one of these for every photoreal run. */
const GENERATED_FILE = "55555555-5555-4555-8555-555555555555";

const who = { brandId: BRAND, userId: USER };

/** The body the attack sends, written out in full so it is unmistakable what is being tried. */
const THE_ATTACK = {
  launchProjectId: CANVAS,
  boardId: BOARD,
  asset: { role: "print_file", provenance: "deterministic", fileId: GENERATED_FILE, showsPerson: false },
  status: "ready",
  credits: null,
} as const;

const failing = async (work: Promise<unknown>): Promise<string> =>
  await work.then(
    () => "it was allowed",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

/** The file's own row, which is the only thing that now decides what made it. */
const withFile = (provenance: string) => fakeClient({ files: { data: { provenance } }, set_launch_board_output: { data: BOARD } });

const rpcCalls = (calls: readonly { kind: string }[]) => calls.filter((call) => call.kind === "rpc");

describe("the request body cannot state what made a file", () => {
  it("drops a provenance the attack puts in the body, so nothing downstream can read it", () => {
    const parsed = recordOutputBody.parse(THE_ATTACK);
    expect(parsed.asset).not.toBeNull();
    expect(parsed.asset).toEqual({ role: "print_file", fileId: GENERATED_FILE, showsPerson: false });
    expect(Object.keys(parsed.asset ?? {})).not.toContain("provenance");
  });

  /**
   * The guard against the fix being undone. A provenance field in one of the garment lock's own
   * request schemas is the whole of H1, so this reads the files and refuses to find one. The word
   * itself is allowed -- these files explain at length why it is not here -- and a *field* named
   * `provenance` is not.
   */
  it("has no provenance field in any of the garment lock's request schemas", () => {
    const files = ["./schemas.ts", "../flows/schemas.ts"];
    for (const name of files) {
      const source = readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
      const fields = source.split("\n").filter((line) => /^\s*provenance\s*:/.test(line));
      expect(fields, `${name} declares a provenance field; H1 says the server decides it`).toEqual([]);
    }
  });
});

describe("the server reads what made a file from the file's own row", () => {
  it("refuses the attack: a generated file offered as a print file on a mockup board", async () => {
    const { client, calls } = withFile("generated");
    const parsed = recordOutputBody.parse(THE_ATTACK);
    const offer: AssetOffer = {
      role: parsed.asset?.role ?? "scene",
      file: { fileId: parsed.asset?.fileId ?? "", contentType: "application/octet-stream" },
      showsPerson: parsed.asset?.showsPerson ?? false,
    };

    const message = await failing(recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer, status: "ready", credits: null }));

    expect(message).toMatch(/cannot hold a generated picture/);
    // Nothing was written: the refusal comes before the one write.
    expect(rpcCalls(calls)).toEqual([]);
  });

  it("refuses the same file offered as a panel layer, which is the other artwork role", async () => {
    const { client, calls } = withFile("generated");
    const offer: AssetOffer = { role: "panel_layer", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };

    expect(await failing(recordOutput(client, who, { boardId: BOARD, kind: "marketing", offer, status: "ready", credits: null }))).toMatch(
      /cannot hold a generated picture/,
    );
    expect(rpcCalls(calls)).toEqual([]);
  });

  it("still allows the honest case, so the fix is not a wall", async () => {
    const { client, calls } = withFile("deterministic");
    const offer: AssetOffer = { role: "print_file", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };

    await recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer, status: "ready", credits: null });

    expect(rpcCalls(calls)).toHaveLength(1);
  });
});

describe("the label the spec requires follows the file and not the words", () => {
  it("labels a generated file AI-generated however the offer was worded", () => {
    const offer: AssetOffer = { role: "print_file", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };
    const asset = assetOffered(offer, "generated");

    // The role is rewritten to scenery, because that is the only role a generated picture has.
    expect(asset.role).toBe("scene");
    expect(assetLabel(asset)).toBe("AI-generated");
  });

  it("labels a generated picture of a person more strictly again", () => {
    const offer: AssetOffer = { role: "scene", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: true };
    expect(assetLabel(assetOffered(offer, "generated"))).toBe("AI-generated model");
  });

  it("leaves a picture the platform drew or the brand sent unlabelled", () => {
    const offer: AssetOffer = { role: "print_file", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };
    expect(assetLabel(assetOffered(offer, "deterministic"))).toBeNull();
    expect(assetLabel(assetOffered(offer, "uploaded"))).toBeNull();
    expect(assetLabel(assetOffered(offer, "golden_sample"))).toBeNull();
  });
});

describe("acceptOffer, the judge over an offer and the file's real provenance", () => {
  const print: AssetOffer = { role: "print_file", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };
  const scene: AssetOffer = { role: "scene", file: { fileId: GENERATED_FILE, contentType: "image/png" }, showsPerson: false };

  it("refuses a generated file every artwork role on every board the platform draws", () => {
    for (const kind of ["design", "artboard", "mockup", "marketing", "info_card"] as const) {
      for (const role of ["panel_layer", "print_file"] as const) {
        const verdict = acceptOffer(kind, { ...print, role }, "generated");
        expect(verdict.accepted, `${kind} / ${role}`).toBe(false);
      }
    }
  });

  it("refuses a generated file an artwork role on an AI board as well, where the role cannot exist", () => {
    expect(acceptOffer("ai_image", print, "generated").accepted).toBe(false);
    expect(acceptOffer("ai_video", print, "generated").accepted).toBe(false);
  });

  it("keeps a generated picture as scenery on an AI board, which is what it is for", () => {
    expect(acceptOffer("ai_image", scene, "generated")).toEqual({ accepted: true, role: "asset" });
  });

  it("still refuses a drawn picture on an AI board, which was never the bug", () => {
    expect(acceptOffer("ai_image", scene, "deterministic").accepted).toBe(false);
  });

  it("lets every provenance that is not a model's take any role on a board the platform draws", () => {
    for (const provenance of ["deterministic", "uploaded", "golden_sample"] as const) {
      expect(acceptOffer("mockup", print, provenance), provenance).toEqual({ accepted: true, role: "print_file" });
    }
  });
});
