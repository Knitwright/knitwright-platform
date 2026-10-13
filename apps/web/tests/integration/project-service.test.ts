import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createSpec } from "@/lib/garment";
import {
  PROJECTS_LISTED,
  checkVersion,
  createProject,
  currentVersion,
  getProject,
  getProjectAt,
  getVersion,
  listProjects,
  listVersions,
  renameProject,
  restoreVersion,
  saveAction,
  saveActions,
  saveTrustedAction,
  saveTrustedActions,
  loadCurrentDesign,
  undoDesign,
  type SaveOutcome,
} from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { adminClient, brandOf, must, person, type Person } from "./support";

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

const saved = (outcome: SaveOutcome) => {
  if (!outcome.ok) throw new Error(`Refused: ${outcome.reason}`);
  return outcome;
};

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("svc-alice"), person("svc-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

const details = (overrides: Record<string, unknown> = {}) => ({
  brandId: aliceBrand,
  userId: alice.userId,
  name: "Home shirt",
  styleNumber: "HS-01",
  season: "SS27",
  typeId: "crew-tee",
  wearer: "women" as const,
  ...overrides,
});

const make = (overrides: Record<string, unknown> = {}): Promise<string> =>
  createProject(adminClient(), details(overrides));

const change = (projectId: string, expectedVersion: number, action: unknown, who = alice, brandId = aliceBrand) =>
  saveAction(adminClient(), who.client, { brandId, userId: who.userId, projectId, expectedVersion, action });

const open = (projectId: string) => getProject(alice.client, aliceBrand, projectId);

const setOption = (optionId: string, choiceId: string) => ({
  type: "set-option",
  optionId,
  choiceId,
  provenance: "user-edited",
});

describe("creating and opening a design", () => {
  it("creates a design that starts with the type's own choices and no sizes or measurements", async () => {
    const id = await make();

    const project = await open(id);

    expect(project).toMatchObject({
      id,
      name: "Home shirt",
      styleNumber: "HS-01",
      season: "SS27",
      garmentType: "crew-tee",
      garmentLabel: "Crew neck tee",
      currentVersion: 1,
      dropped: [],
    });
    expect(project.spec).toMatchObject({ typeId: "crew-tee", wearer: "women", sizing: null, measurements: [] });
  });

  it("stores the first version with its note", async () => {
    const id = await make();

    expect((await listVersions(alice.client, aliceBrand, id)).versions).toEqual([
      { version: 1, note: "Design created.", restoredFrom: null, createdAt: expect.any(String), createdBy: alice.userId },
    ]);
  });

  it("trims the name and allows an empty style number and season", async () => {
    const id = await make({ name: "  Away  ", styleNumber: "", season: "" });

    expect(await open(id)).toMatchObject({ name: "Away", styleNumber: "", season: "" });
  });

  it("refuses a garment type that does not exist, and stores nothing", async () => {
    const owner = await person("svc-no-type");
    const brand = await brandOf(owner, "Nothing FC");

    const failure = await failureOf(
      createProject(adminClient(), details({ brandId: brand, userId: owner.userId, typeId: "no-such-type" })),
    );

    expect(failure.code).toBe("invalid_input");
    expect(failure.fields).toEqual({ typeId: ["There is no garment type called no-such-type."] });
    expect((await listProjects(owner.client, brand)).projects).toEqual([]);
  });

  it("answers not found when the user does not belong to the brand", async () => {
    expect((await failureOf(make({ brandId: bobBrand }))).code).toBe("not_found");
  });

  it("lists the brand's designs, newest first, with the label of the type", async () => {
    const owner = await person("svc-list");
    const brand = await brandOf(owner, "List FC");
    const first = await createProject(adminClient(), details({ brandId: brand, userId: owner.userId, name: "First" }));
    const second = await createProject(
      adminClient(),
      details({ brandId: brand, userId: owner.userId, name: "Second", typeId: "polo" }),
    );

    const listed = (await listProjects(owner.client, brand)).projects;

    expect(listed.map((project) => project.id)).toEqual([second, first]);
    expect(listed[0]).toMatchObject({ name: "Second", garmentLabel: "Polo shirt", currentVersion: 1 });
    expect(listed[0].updatedAt).toEqual(expect.any(String));
  });

  it("lists nothing for a brand the caller does not belong to", async () => {
    await make();

    expect((await listProjects(bob.client, aliceBrand)).projects).toEqual([]);
  });

  it("gives one answer for a design that is missing, one that is another brand's, and an id that is not an id", async () => {
    const theirs = await make();

    const answers = await Promise.all([
      failureOf(getProject(bob.client, bobBrand, theirs)),
      failureOf(getProject(bob.client, aliceBrand, theirs)),
      failureOf(getProject(alice.client, aliceBrand, randomUUID())),
      failureOf(getProject(alice.client, aliceBrand, "not-an-id")),
      failureOf(getProject(alice.client, bobBrand, theirs)),
    ]);

    for (const failure of answers) {
      expect(failure.code).toBe("not_found");
      expect(failure.message).toBe("That design does not exist.");
    }
  });

  it("gives the version list and single versions only for designs the brand owns", async () => {
    const theirs = await make();

    expect((await failureOf(listVersions(bob.client, bobBrand, theirs))).code).toBe("not_found");
    expect((await failureOf(getVersion(bob.client, bobBrand, theirs, 1))).code).toBe("not_found");
    expect((await failureOf(getVersion(alice.client, aliceBrand, theirs, 99))).code).toBe("not_found");
  });
});

describe("long lists", () => {
  it("names the limit, and says when there are more designs than it lists", async () => {
    const owner = await person("svc-more");
    const brand = await brandOf(owner, "More FC");
    for (const name of ["One", "Two", "Three"]) {
      await createProject(adminClient(), details({ brandId: brand, userId: owner.userId, name }));
    }

    const all = await listProjects(owner.client, brand);
    const two = await listProjects(owner.client, brand, 2);
    const exact = await listProjects(owner.client, brand, 3);

    expect(PROJECTS_LISTED).toBe(100);
    expect(all).toMatchObject({ hasMore: false });
    expect(all.projects).toHaveLength(3);
    expect(two.projects.map((project) => project.name)).toEqual(["Three", "Two"]);
    expect(two.hasMore).toBe(true);
    expect(exact.hasMore).toBe(false);
  });

  it("says when there are older versions than the history lists", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    saved(await change(id, 2, setOption("fit", "relaxed")));

    const short = await listVersions(alice.client, aliceBrand, id, 2);

    expect(short.versions.map((entry) => entry.version)).toEqual([3, 2]);
    expect(short.hasMore).toBe(true);
    expect((await listVersions(alice.client, aliceBrand, id)).hasMore).toBe(false);
  });
});

describe("the version a design is at", () => {
  it("is read on its own, and only for the brand's own designs", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));

    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(2);
    expect((await failureOf(currentVersion(bob.client, bobBrand, id))).code).toBe("not_found");
    expect((await failureOf(currentVersion(alice.client, aliceBrand, "not-an-id"))).code).toBe("not_found");
  });

  it("is checked against a conflict: the person's own newer versions are not someone else's", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    saved(await change(id, 2, setOption("fit", "relaxed")));
    const check = (since: number) =>
      checkVersion(alice.client, { brandId: aliceBrand, projectId: id, userId: alice.userId, since });

    expect(await check(1)).toEqual({ version: 3, others: 0 });
    expect(await check(3)).toEqual({ version: 3, others: 0 });
    // Read as if by somebody else: both newer versions are by another person.
    expect(await checkVersion(alice.client, { brandId: aliceBrand, projectId: id, userId: bob.userId, since: 1 })).toEqual({
      version: 3,
      others: 2,
    });
    const bobs = checkVersion(bob.client, { brandId: bobBrand, projectId: id, userId: bob.userId, since: 1 });
    expect((await failureOf(bobs)).code).toBe("not_found");
  });
});

describe("where a value says it came from", () => {
  const CLAIMS = ["brand-supplied", "ai-suggested", "suggested-chart", "derived", "read-from-image"];

  it.each(CLAIMS)("is stored as user-edited when a browser claims %s, at the top and inside nested objects", async (claim) => {
    const id = await make();
    const fabric = { id: "mesh", name: "Mesh", composition: "", construction: "", weightGsm: null, finish: "", stretch: "not-set", provenance: claim };
    const colourway = { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "Navy", provenance: claim }] };
    const artwork = {
      id: "logo", name: "Crest", source: { kind: "text", text: "FC" }, panelId: "body-front", anchor: "centre-chest",
      offsetX: 0, offsetY: 0, width: 1000, height: 500, rotationDegrees: 0, technique: "screen-print", provenance: claim,
    };

    let version = 1;
    for (const action of [
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: claim },
      { type: "set-measurement", pointId: "chest-width", value: 5000, provenance: claim },
      { type: "add-fabric", fabric },
      { type: "add-colourway", colourway },
      { type: "add-artwork", artwork },
    ]) {
      version = saved(await change(id, version, action)).version;
    }

    const stored = (await open(id)).spec;
    expect(stored.options.fit.provenance).toBe("user-edited");
    expect(stored.measurements[0].provenance).toBe("user-edited");
    expect(stored.fabrics.find((entry) => entry.id === "mesh")?.provenance).toBe("user-edited");
    expect(stored.colourways.find((entry) => entry.id === "away")?.colours[0].provenance).toBe("user-edited");
    expect(stored.artwork[0].provenance).toBe("user-edited");
  });

  it("can be named by the server's own trusted writers, and only by them", async () => {
    const id = await make();
    const trusted = { type: "set-measurement", pointId: "chest-width", value: 5000, provenance: "suggested-chart" } as const;

    const outcome = saved(
      await saveTrustedAction(adminClient(), alice.client, {
        brandId: aliceBrand, userId: alice.userId, projectId: id, expectedVersion: 1, action: trusted,
      }),
    );

    expect(outcome.spec.measurements[0].provenance).toBe("suggested-chart");
    expect((await listVersions(alice.client, aliceBrand, id)).versions[0].note).toBe("Chest width set to 50 cm.");
  });
});

describe("saving the assistant's changes", () => {
  const batch = (id: string, expectedVersion: number, actions: unknown[]) =>
    saveTrustedActions(adminClient(), alice.client, {
      brandId: aliceBrand,
      userId: alice.userId,
      projectId: id,
      expectedVersion,
      actions: actions as never,
      source: "assistant",
      explanations: ["Fit changed from Regular to Slim.", "Sleeve length changed."],
    });

  it("stores a batch as one version, keeping each source, with one note", async () => {
    const id = await make();
    const outcome = saved(
      await batch(id, 1, [
        { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
        { type: "set-measurement", pointId: "chest-width", value: 5000, provenance: "ai-suggested" },
      ]),
    );
    expect(outcome.version).toBe(2);
    expect(outcome.spec.options.fit.provenance).toBe("ai-suggested");
    expect((await listVersions(alice.client, aliceBrand, id)).versions[0].note).toBe(
      "By the assistant: Fit changed from Regular to Slim. Sleeve length changed.",
    );
  });

  it("stores nothing when one change in the batch is refused", async () => {
    const id = await make();
    const outcome = await batch(id, 1, [
      { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
      { type: "set-option", optionId: "collar", choiceId: "no-such-collar", provenance: "ai-suggested" },
    ]);
    expect(outcome.ok).toBe(false);
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(1);
  });

  it("refuses a batch made against an older version, and another brand's design", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    expect((await failureOf(batch(id, 1, [{ type: "set-option", optionId: "fit", choiceId: "relaxed", provenance: "ai-suggested" }]))).code).toBe("conflict");
    expect((await failureOf(loadCurrentDesign(bob.client, { brandId: bobBrand, projectId: id, expectedVersion: 2 }))).code).toBe("not_found");
    expect((await loadCurrentDesign(alice.client, { brandId: aliceBrand, projectId: id, expectedVersion: 2 })).options.fit.choiceId).toBe("slim");
  });
});

describe("saving several of a person's changes together", () => {
  const together = (id: string, expectedVersion: number, actions: unknown[]) =>
    saveActions(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId, projectId: id, expectedVersion, actions });

  it("stores them as one version, each as the person's own whatever source was claimed", async () => {
    const id = await make();
    const outcome = saved(
      await together(id, 1, [
        { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" },
        { type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: "suggested-chart" } },
      ]),
    );
    expect(outcome.version).toBe(2);
    expect(outcome.spec.options.fit.provenance).toBe("user-edited");
    expect(outcome.spec.tolerances).toEqual([{ pointId: "chest-width", value: 100, provenance: "user-edited" }]);
    expect((await listVersions(alice.client, aliceBrand, id)).versions[0].note).toBe(
      "2 changes saved together. The first: Fit changed to Slim.",
    );
  });

  it("stores nothing when one change is refused or not understood", async () => {
    const id = await make();
    const refused = await together(id, 1, [setOption("fit", "slim"), setOption("collar", "no-such-collar")]);
    expect(refused.ok).toBe(false);
    expect(await together(id, 1, [setOption("fit", "slim"), { type: "no-such-change" }])).toEqual({
      ok: false,
      reason: expect.any(String),
    });
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(1);
  });

  it("stores no version when nothing changed, and refuses a batch made against an older version", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    const same = saved(await together(id, 2, [setOption("fit", "slim")]));
    expect(same.version).toBe(2);
    expect((await failureOf(together(id, 1, [setOption("fit", "relaxed")]))).code).toBe("conflict");
  });
});

describe("saving an action", () => {
  it("stores the result as a new version with a note in plain words", async () => {
    const id = await make();

    const outcome = saved(await change(id, 1, setOption("fit", "slim")));

    expect(outcome.version).toBe(2);
    expect(outcome.dropped).toEqual([]);
    expect(outcome.spec.options.fit).toEqual({ choiceId: "slim", provenance: "user-edited" });
    expect(await open(id)).toMatchObject({ currentVersion: 2 });
    expect((await open(id)).spec).toEqual(outcome.spec);
    expect(((await listVersions(alice.client, aliceBrand, id)).versions).map((v) => [v.version, v.note])).toEqual([
      [2, "Fit changed to Slim."],
      [1, "Design created."],
    ]);
  });

  it("notes a measurement in centimetres, owned by the person who typed it", async () => {
    const id = await make();

    const outcome = saved(
      await change(id, 1, { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" }),
    );

    expect(outcome.spec.measurements).toEqual([{ pointId: "chest-width", value: 5250, provenance: "user-edited" }]);
    expect(((await listVersions(alice.client, aliceBrand, id)).versions)[0].note).toBe("Chest width set to 52.5 cm.");
  });

  it("says when the version that was read was saved, for an old version as for the current one", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    const saves = new Map((await listVersions(alice.client, aliceBrand, id)).versions.map((v) => [v.version, v.createdAt]));

    expect((await getProjectAt(alice.client, aliceBrand, id, 1)).versionSavedAt).toBe(saves.get(1));
    expect((await open(id)).versionSavedAt).toBe(saves.get(2));
  });

  it("keeps the old versions exactly as they were", async () => {
    const id = await make();
    const first = await getVersion(alice.client, aliceBrand, id, 1);

    saved(await change(id, 1, setOption("fit", "slim")));

    expect((await getVersion(alice.client, aliceBrand, id, 1)).spec).toEqual(first.spec);
  });

  it("returns the reason for a refused action and stores nothing", async () => {
    const id = await make({ typeId: "team-jersey" });
    saved(await change(id, 1, setOption("collar", "band-collar")));

    const refused = await change(id, 2, setOption("neckline", "v-neck"));

    expect(refused).toEqual({ ok: false, reason: expect.stringContaining("band collar") });
    expect((await open(id)).currentVersion).toBe(2);
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(2);
  });

  it("refuses a change it does not understand, and stores nothing", async () => {
    const id = await make();

    expect(await change(id, 1, { type: "delete-everything" })).toEqual({
      ok: false,
      reason: "That change is not understood.",
    });
    expect(await change(id, 1, undefined)).toMatchObject({ ok: false });
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(1);
  });

  it("stores no new version when the change leaves the design as it was", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("hem-shape", "curved")));

    const again = saved(await change(id, 2, setOption("hem-shape", "curved")));

    expect(again.version).toBe(2);
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(2);
  });

  it("reports what a change removed", async () => {
    const id = await make({ typeId: "team-jersey" });
    saved(await change(id, 1, setOption("collar", "band-collar")));

    const outcome = saved(await change(id, 2, { type: "change-type", typeId: "crew-tee" }));

    expect(outcome.dropped.length).toBeGreaterThan(0);
    expect(outcome.dropped.every((entry) => entry.message.length > 0)).toBe(true);
  });

  it("keeps the type shown in the list in step with the design", async () => {
    const id = await make();

    saved(await change(id, 1, { type: "change-type", typeId: "v-neck-tee" }));

    const listed = ((await listProjects(alice.client, aliceBrand)).projects).find((project) => project.id === id);
    expect(listed).toMatchObject({ garmentType: "v-neck-tee", garmentLabel: "V neck tee" });
  });

  it("says the design was changed elsewhere when the version is old", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));

    const failure = await failureOf(change(id, 1, setOption("fit", "relaxed")));

    expect(failure.code).toBe("conflict");
    expect(failure.message).toBe("This design was changed somewhere else. Reload to see the latest version.");
    expect((await open(id)).spec.options.fit.choiceId).toBe("slim");
  });

  it("lets exactly one of ten saves from the same version succeed", async () => {
    const id = await make();

    const results = await Promise.allSettled(
      ["slim", "relaxed", "regular", "slim", "relaxed", "regular", "slim", "relaxed", "regular", "slim"].map(
        (choice) => change(id, 1, setOption("fit", choice)),
      ),
    );

    const wins = results.filter((result) => result.status === "fulfilled" && result.value.ok);
    const conflicts = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof AppError && result.reason.code === "conflict",
    );
    expect(wins.length).toBe(1);
    expect(conflicts.length).toBe(9);
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(2);
  });

  it("changes nothing for a member of another brand", async () => {
    const id = await make();

    const failures = await Promise.all([
      failureOf(change(id, 1, setOption("fit", "slim"), bob, bobBrand)),
      failureOf(change(id, 1, setOption("fit", "slim"), bob, aliceBrand)),
      failureOf(change(randomUUID(), 1, setOption("fit", "slim"))),
      failureOf(change("not-an-id", 1, setOption("fit", "slim"))),
    ]);

    for (const failure of failures) expect(failure.code).toBe("not_found");
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(1);
  });
});

describe("undoing", () => {
  const undo = (projectId: string, expectedVersion: number, who = alice, brandId = aliceBrand) =>
    undoDesign(adminClient(), who.client, { brandId, userId: who.userId, projectId, expectedVersion });

  it("goes back through the designs one at a time, three times in a row, and then stops", async () => {
    const id = await make();
    const first = (await open(id)).spec;
    saved(await change(id, 1, setOption("fit", "slim")));
    const second = (await open(id)).spec;
    saved(await change(id, 2, setOption("hem-shape", "curved")));

    const one = saved(await undo(id, 3));
    expect([one.version, one.spec]).toEqual([4, second]);
    const two = saved(await undo(id, 4));
    expect([two.version, two.spec]).toEqual([5, first]);

    expect(await undo(id, 5)).toEqual({ ok: false, reason: "There is nothing to undo." });
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(5);
  });

  it("answers with a conflict when the version is old, and not found for another brand", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));

    expect((await failureOf(undo(id, 1))).code).toBe("conflict");
    expect((await failureOf(undo(id, 2, bob, bobBrand))).code).toBe("not_found");
    expect((await failureOf(undo(id, 2, bob, aliceBrand))).code).toBe("not_found");
  });
});

describe("restoring a version", () => {
  const restore = (projectId: string, expectedVersion: number, version: number, who = alice, brandId = aliceBrand) =>
    restoreVersion(adminClient(), who.client, { brandId, userId: who.userId, projectId, expectedVersion, version });

  it("stores a new version that holds the old design, and overwrites nothing", async () => {
    const id = await make();
    const original = (await open(id)).spec;
    saved(await change(id, 1, setOption("fit", "slim")));
    saved(await change(id, 2, { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" }));

    const outcome = saved(await restore(id, 3, 1));

    expect(outcome.version).toBe(4);
    expect(outcome.spec).toEqual(original);
    const versions = (await listVersions(alice.client, aliceBrand, id)).versions;
    expect(versions.map((v) => v.version)).toEqual([4, 3, 2, 1]);
    expect(versions[0]).toMatchObject({ note: "Restored version 1.", restoredFrom: 1 });
    expect((await getVersion(alice.client, aliceBrand, id, 3)).spec.measurements).toHaveLength(1);
    expect((await open(id)).spec).toEqual(original);
  });

  it("says the design was changed elsewhere when the version is old", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));

    expect((await failureOf(restore(id, 1, 1))).code).toBe("conflict");
  });

  it("stores nothing when the design is the same as the current one", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));
    saved(await change(id, 2, setOption("fit", "relaxed")));
    saved(await restore(id, 3, 2));

    const again = saved(await restore(id, 4, 2));

    expect(again.version).toBe(4);
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(4);
  });

  it("refuses to restore the version that is already current", async () => {
    const id = await make();

    expect(await restore(id, 1, 1)).toEqual({ ok: false, reason: "That is already the current version." });
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(1);
  });

  it("answers not found for a version that does not exist or a design that is not the caller's", async () => {
    const id = await make();
    saved(await change(id, 1, setOption("fit", "slim")));

    expect((await failureOf(restore(id, 2, 99))).code).toBe("not_found");
    expect((await failureOf(restore(id, 2, 1, bob, bobBrand))).code).toBe("not_found");
    expect((await failureOf(restore(id, 2, 1, bob, aliceBrand))).code).toBe("not_found");
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(2);
  });
});

describe("designs saved under older rules", () => {
  // A hem shape this type does not offer. The shape is right, the registry no longer fits.
  const staleSpec = () => {
    const made = createSpec("crew-tee", "women");
    if (!made.ok) throw new Error(made.reason);
    return { ...made.spec, options: { ...made.spec.options, "hem-shape": { choiceId: "side-vent", provenance: "user-edited" } } };
  };

  const withStaleVersion = async (): Promise<string> => {
    const id = await make();
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: staleSpec(),
        p_schema_version: 3,
        p_note: "Saved under older rules.",
        p_restored_from: null,
      }),
    );
    return id;
  };

  it("repairs the design when it is opened, and says what it dropped", async () => {
    const id = await withStaleVersion();

    const project = await open(id);

    expect(project.spec.options["hem-shape"].choiceId).toBe("straight");
    expect(project.dropped.length).toBeGreaterThan(0);
  });

  it("includes what the repair dropped when the next change is saved", async () => {
    const id = await withStaleVersion();

    const outcome = saved(await change(id, 2, setOption("fit", "slim")));

    expect(outcome.spec.options["hem-shape"].choiceId).toBe("straight");
    expect(outcome.dropped.length).toBeGreaterThan(0);
  });

  it("stores the repaired design when an old version is restored", async () => {
    const id = await withStaleVersion();
    saved(await change(id, 2, setOption("fit", "slim")));

    const outcome = saved(await restoreVersion(adminClient(), alice.client, {
      brandId: aliceBrand,
      userId: alice.userId,
      projectId: id,
      expectedVersion: 3,
      version: 2,
    }));

    expect(outcome.spec.options["hem-shape"].choiceId).toBe("straight");
    expect(outcome.dropped.length).toBeGreaterThan(0);
  });

  it.each([
    ["a design saved by a newer app", { schemaVersion: 99 }],
    ["something that is not a design", { hello: "world" }],
  ])("says plainly that it cannot open %s", async (_label, spec) => {
    const id = await make();
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: spec,
        p_schema_version: 99,
        p_note: "Broken.",
        p_restored_from: null,
      }),
    );

    const failure = await failureOf(open(id));

    expect(failure.code).toBe("unavailable");
    expect(failure.message.length).toBeGreaterThan(10);
  });
});

describe("renaming", () => {
  const rename = (projectId: string, overrides: Record<string, unknown> = {}, who = alice, brandId = aliceBrand) =>
    renameProject(adminClient(), who.client, {
      brandId,
      userId: who.userId,
      projectId,
      name: "Renamed",
      styleNumber: "NEW-1",
      season: "AW27",
      ...overrides,
    });

  it("changes the details and leaves the design and its versions alone", async () => {
    const id = await make();

    await rename(id);

    expect(await open(id)).toMatchObject({ name: "Renamed", styleNumber: "NEW-1", season: "AW27", currentVersion: 1 });
    expect((await listVersions(alice.client, aliceBrand, id)).versions).toHaveLength(1);
  });

  it("refuses a name that is empty", async () => {
    const id = await make();

    expect((await failureOf(rename(id, { name: "  " }))).code).toBe("invalid_input");
    expect((await open(id)).name).toBe("Home shirt");
  });

  it("answers not found for a design that is not the caller's", async () => {
    const id = await make();

    expect((await failureOf(rename(id, {}, bob, bobBrand))).code).toBe("not_found");
    expect((await failureOf(rename(id, {}, bob, aliceBrand))).code).toBe("not_found");
    expect((await failureOf(rename("not-an-id"))).code).toBe("not_found");
    expect((await open(id)).name).toBe("Home shirt");
  });
});
