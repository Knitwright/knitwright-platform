import { describe, expect, it } from "vitest";
import { GENERATED_LABEL, GENERATED_PERSON_LABEL } from "@/lib/launch/assets";
import { aiScenes, sceneBySlug } from "@/lib/mockups";
import { marksFor, panelsFor, referencePng } from "@/lib/media-check/fixtures/synthetic";
import { cropOf, readBoardSettings, settingsOfConcept } from "./board";
import { conceptOfScene } from "./concepts";
import { MODEL_PRESET_KEYS, modelPresetsFrom } from "./models";
import { promptFor, seedOf } from "./provider";
import { runShoot, type ShootRunDeps } from "./run";
import { stubShootProvider } from "./stub";
import { runVerdict, showsPerson } from "./verdict";
import { CONSENT_STATEMENT, SHOOT_GAP_RULE } from "./types";

/**
 * **THE ACCEPTANCE TEST OF THIS WORKSTREAM: all twenty of `07`'s AI scenes run.**
 *
 * L2 seeded 40 mockup scenes and marked the 20 photographic ones `owner: "L3"`; `composeMockup`
 * refuses one by name rather than half-drawing it. This test takes each of those 20 in turn, builds
 * the board settings its shoot idea gives it, builds the prompt, runs it through the whole paid path
 * -- meter, ledger, moderation, provider, picture checker -- and asks for a picture back with the
 * label the spec puts on it.
 *
 * It runs on the deterministic stub, so it calls nothing and costs nothing (plan v5 rule). What it
 * proves is that the twenty scenes have a working path end to end, and which of them need a licence
 * or a consent before a person can really use them.
 */

const SIZE = 256;
const LICENSED = modelPresetsFrom({ refs: Object.fromEntries(MODEL_PRESET_KEYS.map((key) => [key, `LIC-${key}`])), holders: {} });
const CONSENT = { ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" };
const SOURCE = { perGeneratedBoard: 1, note: "A placeholder, not a price.", ruleId: SHOOT_GAP_RULE };

const deps = (): ShootRunDeps => ({
  provider: stubShootProvider(),
  ledger: null,
  meter: {
    async reserve() {
      return { ok: true as const, eventId: "event-1" };
    },
    async release() {
      return undefined;
    },
  },
  screen: async () => ({ result: "clear", reasons: [] }),
  log: () => undefined,
});

describe("the twenty AI scenes of 07", () => {
  it("each belong to a shoot idea, so every one of them can be started from the library", () => {
    for (const scene of aiScenes()) expect(conceptOfScene(scene.slug), scene.slug).not.toBeNull();
  });

  it("each run end to end on the stub, and come back with the right label", async () => {
    const reference = await referencePng(SIZE);
    const marks = marksFor(SIZE);
    const panels = panelsFor(SIZE);
    const ran: string[] = [];
    for (const scene of aiScenes()) {
      const concept = conceptOfScene(scene.slug)!;
      const base = settingsOfConcept(concept, scene.slug);
      const settings = readBoardSettings({
        ...base,
        ...(base.modelSource === "preset" ? { modelPresetKey: MODEL_PRESET_KEYS[0] } : {}),
      });
      const verdict = runVerdict(settings, { garmentLocked: true, scene, presets: LICENSED, balance: 100, creditsEnforced: true, source: SOURCE });
      expect(verdict.canRun, scene.slug).toBe(true);
      const outcome = await runShoot(
        deps(),
        {
          request: {
            garment: reference,
            extraGarments: [],
            modelPhoto: null,
            background: null,
            prompt: promptFor(settings, scene),
            crop: cropOf(settings.aspect, scene.crops),
            sceneSlug: scene.slug,
            seed: seedOf(scene.slug, 1),
          },
          credits: verdict.canRun ? verdict.cost.credits : 0,
          idempotencyKey: `shoot:${scene.slug}`,
          jobId: `job-${scene.slug}`,
          checkInput: { reference, protectedRegions: marks, panels },
          showsPerson: showsPerson(settings, scene),
          seedFor: (attempt) => seedOf(scene.slug, attempt),
        },
        new AbortController().signal,
      );
      expect(outcome.ok, `${scene.slug}: ${outcome.ok ? "" : outcome.message}`).toBe(true);
      if (!outcome.ok) continue;
      expect(outcome.attempts, scene.slug).toBe(1);
      expect(outcome.label, scene.slug).toBe(scene.people === "none" ? GENERATED_LABEL : GENERATED_PERSON_LABEL);
      ran.push(scene.slug);
    }
    expect(ran).toHaveLength(20);
  }, 120_000);

  it("say which of them need a licensed preset or a consented upload before a person can use one", () => {
    const needModel = aiScenes().filter((scene) => scene.people !== "none");
    const needNobody = aiScenes().filter((scene) => scene.people === "none");
    expect(needModel).toHaveLength(17);
    expect(needNobody).toHaveLength(3);
    // With no licence on file anywhere, the three garment-only scenes run and the other seventeen do
    // not -- unless the brand uploads its own model and records the consent, which they then do.
    for (const scene of needNobody) {
      const settings = readBoardSettings({ sceneSlug: scene.slug, modelSource: "none" });
      expect(runVerdict(settings, { garmentLocked: true, scene, presets: modelPresetsFrom({ refs: {}, holders: {} }), balance: 1, creditsEnforced: true, source: SOURCE }).canRun, scene.slug).toBe(true);
    }
    for (const scene of needModel) {
      const unlicensed = readBoardSettings({ sceneSlug: scene.slug, modelSource: "preset", modelPresetKey: MODEL_PRESET_KEYS[0] });
      expect(runVerdict(unlicensed, { garmentLocked: true, scene, presets: modelPresetsFrom({ refs: {}, holders: {} }), balance: 1, creditsEnforced: true, source: SOURCE }).canRun, scene.slug).toBe(false);
      const consented = readBoardSettings({ sceneSlug: scene.slug, modelSource: "upload", modelFileId: "file-1", consent: CONSENT });
      expect(runVerdict(consented, { garmentLocked: true, scene, presets: modelPresetsFrom({ refs: {}, holders: {} }), balance: 1, creditsEnforced: true, source: SOURCE }).canRun, scene.slug).toBe(true);
    }
  });

  it("are the scenes L2 refuses to draw itself, so nothing is drawn twice", async () => {
    const { composeMockup, AI_SCENE_REFUSED } = await import("@/lib/mockups/compose");
    const scene = sceneBySlug("floodlit-pitch")!;
    await expect(
      composeMockup({ scene, drawings: { front: new Uint8Array(), back: new Uint8Array() } }),
    ).rejects.toThrow(AI_SCENE_REFUSED);
  });
});
