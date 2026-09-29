import { beforeAll, describe, expect, it } from "vitest";
import { createProject, saveAction } from "@/lib/projects/service";
import { loadTechPackSource } from "@/lib/projects/tech-pack-load";
import { AppError } from "@/lib/server/core/errors";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { adminClient, brandOf, person, type Person } from "./support";

/**
 * The one loader that the tech pack page and the export route both use, so that the screen and the
 * files are made from the same reads. It is tested against the real database.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("load-alice"), person("load-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

const make = (): Promise<string> =>
  createProject(adminClient(), { brandId: aliceBrand, userId: alice.userId, name: "Home shirt", styleNumber: "HS-01", season: "SS27", typeId: "crew-tee", wearer: "women" });

const change = async (projectId: string, expectedVersion: number, choiceId: string) => {
  const outcome = await saveAction(adminClient(), alice.client, {
    brandId: aliceBrand,
    userId: alice.userId,
    projectId,
    expectedVersion,
    action: { type: "set-option", optionId: "fit", choiceId, provenance: "user-edited" },
  });
  if (!outcome.ok) throw new Error(outcome.reason);
};

const load = (projectId: string, options: { version?: number } = {}, who = alice, brandId = aliceBrand) =>
  loadTechPackSource(who.client, brandId, projectId, { shrink: shrinkForDrawing, ...options });

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("loading the inputs of a tech pack", () => {
  it("reads the current version, its history and its pictures", async () => {
    const id = await make();
    await change(id, 1, "slim");

    const source = await load(id);

    expect(source.project).toMatchObject({ id, name: "Home shirt", styleNumber: "HS-01", currentVersion: 2 });
    expect(source.project.spec.options["fit"]?.choiceId).toBe("slim");
    expect(source.history.versions.map((entry) => entry.version)).toEqual([2, 1]);
    expect(source.pictures).toEqual({ images: new Map(), skipped: 0 });
  });

  it("reads an older version of the design as the version it was, with the history up to it", async () => {
    const id = await make();
    await change(id, 1, "slim");

    const old = await load(id, { version: 1 });

    expect(old.project.currentVersion).toBe(1);
    expect(old.project.spec.options["fit"]?.choiceId).not.toBe("slim");
    expect(old.project.name).toBe("Home shirt");
  });

  it("says a version the design does not have is not found", async () => {
    const id = await make();

    expect((await failureOf(load(id, { version: 5 }))).code).toBe("not_found");
  });

  it("says a design of another brand is not found, as the page does", async () => {
    const id = await make();

    expect((await failureOf(load(id, {}, bob, bobBrand))).code).toBe("not_found");
    expect((await failureOf(load(id, { version: 1 }, bob, bobBrand))).code).toBe("not_found");
  });

  it("says a design that does not exist is not found", async () => {
    expect((await failureOf(load("6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11"))).code).toBe("not_found");
  });
});
