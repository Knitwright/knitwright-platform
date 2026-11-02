import { describe, expect, it } from "vitest";
import { SEQUENCE_KEYS, type ViewCapability } from "@/lib/media/video/sequences";
import { VIDEO_TEMPLATES } from "@/lib/media/video/social-frames";
import * as copy from "./copy";
import { studioPlan, studioView, type StudioInput } from "./studio-model";

const input = (over: Partial<StudioInput> = {}): StudioInput => ({
  abilities: ["turn", "camera", "colourway"] satisfies ViewCapability[],
  hasView: true,
  aspect: "9:16",
  sequenceKey: "turntable",
  templateKey: null,
  phase: "idle",
  message: null,
  ...over,
});

describe("the deterministic studio", () => {
  it("offers the four free videos and the three aspects", () => {
    const view = studioView(input());
    expect(view.sequences.map((card) => card.key)).toEqual([...SEQUENCE_KEYS]);
    expect(view.sequences.every((card) => card.offered)).toBe(true);
    expect(view.aspects).toHaveLength(3);
  });

  it("asks for a 3D view before it offers anything, and names the one action", () => {
    const view = studioView(input({ hasView: false }));
    expect(view.empty).toBe(copy.STUDIO_EMPTY);
    expect(view.empty?.action).toBe("Open the 3D view");
  });

  it("shows a sequence this view cannot record, disabled, with the reason", () => {
    const view = studioView(input({ abilities: ["turn"] }));
    expect(view.sequences.filter((card) => card.offered).map((card) => card.key)).toEqual(["turntable"]);
    const flip = view.sequences.find((card) => card.key === "flip");
    expect(flip?.blocked).toContain("point the camera");
    expect(view.sequences).toHaveLength(4);
  });

  it("says which sequence the Record button would record, and nothing when it cannot", () => {
    expect(studioView(input({ sequenceKey: "carousel" })).recordable).toBe("carousel");
    expect(studioView(input({ abilities: ["turn"], sequenceKey: "carousel" })).recordable).toBeNull();
  });

  it("says where the video is made, from the encoder decision", () => {
    expect(studioView(input()).encoder.id).toBe("browser");
    expect(studioView(input()).encoder.reason).toMatch(/in your browser/);
    expect(studioView(input({ env: { MEDIA_VIDEO_FFMPEG: "/usr/bin/ffmpeg" } })).encoder.id).toBe("ffmpeg");
  });

  it("says what is happening, in words, at every stage", () => {
    expect(studioView(input({ phase: "idle" })).statusLine).toBeNull();
    expect(studioView(input({ phase: "recording" })).statusLine).toBe(copy.RECORDING_PREFIX);
    expect(studioView(input({ phase: "saved" })).statusLine).toBe(copy.SAVED_LINE);
    expect(studioView(input({ phase: "failed", message: copy.TOO_BIG_LINE })).statusLine).toBe(copy.TOO_BIG_LINE);
  });

  it("shows the twelve social frames, with what each one that is not ready is waiting for", () => {
    const view = studioView(input());
    expect(view.templates).toHaveLength(12);
    expect(view.templates.filter((card) => card.ready)).toHaveLength(4);
    for (const card of view.templates.filter((one) => !one.ready)) expect(card.waiting, card.key).toMatch(/cannot be made here yet/);
    expect(view.templates[0]?.slots.length).toBeGreaterThan(0);
  });

  it("has the four ready templates on the same keys as the four sequences, so one can record the other", () => {
    expect(VIDEO_TEMPLATES.slice(0, 4).map((template) => template.key)).toEqual([...SEQUENCE_KEYS]);
  });
});

describe("the plan the Record button plays", () => {
  it("is the chosen sequence when no social frame is picked", () => {
    const plan = studioPlan(input({ sequenceKey: "kit_reveal" }));
    expect(plan?.sequenceKey).toBe("kit_reveal");
    expect(plan?.overlays).toEqual([]);
  });

  it("is the chosen social frame, with the typed text burned in", () => {
    const plan = studioPlan(input({ templateKey: "carousel" }), { headline: "New kits", home: "Home" });
    expect(plan?.sequenceKey).toBe("carousel");
    expect(plan?.overlays.map((one) => one.id)).toEqual(["headline", "home"]);
  });

  it("is nothing at all when this view cannot record what is chosen", () => {
    expect(studioPlan(input({ abilities: ["turn"], sequenceKey: "flip" }))).toBeNull();
  });

  it("is nothing for a social frame whose source does not exist yet", () => {
    expect(studioPlan(input({ templateKey: "countdown" }))).toBeNull();
  });

  it("takes the aspect that is chosen", () => {
    expect(studioPlan(input({ aspect: "16:9" }))?.format).toMatchObject({ width: 1920, height: 1080 });
    expect(studioPlan(input({ aspect: "1:1" }))?.format).toMatchObject({ width: 1080, height: 1080 });
  });

  it("asks the checker for frames across the whole video when it is told to", () => {
    expect(studioPlan(input(), {}, 4)?.sampleMs).toHaveLength(4);
  });
});
