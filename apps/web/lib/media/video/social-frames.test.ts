import { describe, expect, it } from "vitest";
import { LAUNCH_COUNTS } from "@/lib/templates/kinds";
import { VIDEO_GAP_RULE } from "./formats";
import { videoSequence } from "./sequences";
import { overlaysAt } from "./shot-plan";
import { buildableNow, findTemplate, slotVerdict, templatePlan, VIDEO_TEMPLATES, waitingLine } from "./social-frames";

describe("the video templates", () => {
  it("are the twelve the template library asks for at launch", () => {
    expect(VIDEO_TEMPLATES).toHaveLength(12);
    expect(VIDEO_TEMPLATES).toHaveLength(LAUNCH_COUNTS.video);
    expect(new Set(VIDEO_TEMPLATES.map((template) => template.key)).size).toBe(12);
  });

  it("carry the lengths the spec's own table gives", () => {
    const seconds = Object.fromEntries(VIDEO_TEMPLATES.map((template) => [template.key, template.seconds]));
    expect(seconds).toEqual({
      turntable: 6,
      flip: 4,
      kit_reveal: 8,
      carousel: 9,
      countdown: 10,
      walk_out: 5,
      training: 5,
      drop_teaser: 6,
      size_guide: 10,
      feature_callouts: 8,
      order_now: 6,
      product_carousel: 12,
    });
  });

  it("give every template a rule id, a note naming the spec, and at least one text slot", () => {
    for (const template of VIDEO_TEMPLATES) {
      expect(template.ruleId).toBe(VIDEO_GAP_RULE);
      expect(template.note).toMatch(/07-template-library/);
      expect(template.slots.length).toBeGreaterThan(0);
      for (const slot of template.slots) {
        expect(slot.limit, `${template.key}/${slot.id}`).toBeGreaterThan(0);
        expect(slot.label).toMatch(/\w/);
        expect(slot.fromPart).toBeGreaterThanOrEqual(0);
        expect(slot.toPart).toBeLessThanOrEqual(1);
        expect(slot.toPart).toBeGreaterThan(slot.fromPart);
      }
    }
  });

  it("match their own sequence's length where they are built from one", () => {
    for (const template of VIDEO_TEMPLATES) {
      const sequence = videoSequence(template.sequenceKey);
      if (sequence) expect(sequence.seconds, template.key).toBe(template.seconds);
    }
  });

  it("say plainly which of them cannot be made here yet, and what each is waiting for", () => {
    expect(VIDEO_TEMPLATES.filter(buildableNow).map((template) => template.key)).toEqual(["turntable", "flip", "kit_reveal", "carousel"]);
    for (const template of VIDEO_TEMPLATES.filter((one) => !buildableNow(one))) {
      expect(waitingLine(template), template.key).toMatch(/cannot be made here yet/);
      expect(template.waitingOn, template.key).toMatch(/\w/);
    }
    expect(waitingLine(VIDEO_TEMPLATES[0] as never)).toBeNull();
  });

  it("finds a template by key, and nothing for anything else", () => {
    expect(findTemplate("kit_reveal")?.seconds).toBe(8);
    expect(findTemplate("nope")).toBeNull();
    expect(findTemplate(4)).toBeNull();
  });
});

describe("the text burned into a frame", () => {
  it("refuses text past the slot's limit, naming the limit and the length", () => {
    const slot = (findTemplate("turntable")?.slots ?? [])[0]!;
    expect(slotVerdict(slot, "New kit")).toEqual({ ok: true, text: "New kit" });
    const refusal = slotVerdict(slot, "x".repeat(slot.limit + 1));
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toContain(String(slot.limit));
    expect(refusal.reason).toContain(String(slot.limit + 1));
  });

  it("burns the text in at the moments the slot asks for", () => {
    const plan = templatePlan({ template: findTemplate("carousel")!, aspect: "9:16", text: { headline: "New kits", home: "Home", away: "Away", gk: "Keeper" } });
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(overlaysAt(plan, 0).map((one) => one.id)).toEqual(["headline", "home"]);
    expect(overlaysAt(plan, 4000).map((one) => one.id)).toEqual(["headline", "away"]);
    expect(overlaysAt(plan, 7000).map((one) => one.id)).toEqual(["headline", "gk"]);
  });

  it("draws nothing for a slot left empty, and nothing for text that does not fit", () => {
    const template = findTemplate("kit_reveal")!;
    const plan = templatePlan({ template, aspect: "1:1", text: { headline: "", subhead: "x".repeat(500), chip: "clubshop.test" } });
    expect(plan?.overlays.map((one) => one.id)).toEqual(["chip"]);
  });

  it("is the same plan every time for the same template, aspect and words", () => {
    const input = { template: findTemplate("turntable")!, aspect: "16:9" as const, text: { headline: "New kit" } };
    expect(templatePlan(input)).toEqual(templatePlan(input));
  });

  it("gives no plan at all for a template whose source does not exist yet", () => {
    for (const key of ["countdown", "walk_out", "size_guide", "order_now"]) {
      expect(templatePlan({ template: findTemplate(key)!, aspect: "1:1", text: {} }), key).toBeNull();
    }
  });

  it("keeps the sequence's own shots, so the garment is still the picture the platform drew", () => {
    const plan = templatePlan({ template: findTemplate("kit_reveal")!, aspect: "9:16", text: { headline: "New kit" } });
    expect(plan?.shots.map((shot) => shot.shotId)).toEqual(["fabric", "shirt", "crest"]);
    expect(plan?.durationMs).toBe(8000);
  });

  it("samples frames across the whole length when it is asked to", () => {
    const plan = templatePlan({ template: findTemplate("turntable")!, aspect: "1:1", text: {}, sampleFrames: 3 });
    expect(plan?.sampleMs).toHaveLength(3);
    expect(plan?.sampleMs[0]).toBe(0);
  });
});
