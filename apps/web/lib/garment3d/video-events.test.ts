import { describe, expect, it } from "vitest";
import { askAbilities, shotCommands, VIDEO_EVENTS, type PlanLike } from "@/components/video/record-sequence";
import { SEQUENCES, VIDEO_SEQUENCES, sequenceVerdict, type ViewCapability } from "@/lib/media/video/sequences";
import { buildRenderPlan } from "@/lib/media/video/shot-plan";
import {
  abilitiesOf,
  cameraAsk,
  colourwayAsked,
  distanceFor,
  listenForVideoEvents,
  subjectHeight,
  turnAsked,
  VIEW_ABILITIES,
  VIEW_EVENTS,
  type CameraAsk,
  type ViewHandlers,
} from "./video-events";

/**
 * THE THREE EVENTS A 3D VIEW ANSWERS (the wiring of decision 0095, item 3).
 *
 * The point of this file is the sentence L5's panel used to show: "This 3D view cannot point the
 * camera yet, so Front-to-back flip cannot be recorded from it." A view that answers the camera and
 * the colourway makes that sentence untrue, and the four free videos are all offered. So the last
 * test asks `sequenceVerdict` itself, with the abilities a listening view really reports.
 *
 * `CustomEvent` is used rather than a fake, because the listeners are DOM listeners and a fake
 * would prove nothing about them. An `EventTarget` needs no browser.
 */

const event = (name: string, detail: unknown): Event => new CustomEvent(name, { detail });

describe("the events the recorder and the views agree on", () => {
  it("names them exactly as the recorder dispatches them", () => {
    expect(VIEW_EVENTS).toEqual(VIDEO_EVENTS);
  });

  it("names the same abilities the video studio asks about", () => {
    expect([...VIEW_ABILITIES]).toEqual([...(["turn", "camera", "colourway"] as readonly ViewCapability[])]);
  });
});

describe("reading an event the recorder sent", () => {
  it("reads a camera shot as it was asked for", () => {
    expect(cameraAsk({ degrees: 180, zoom: 2.4, toZoom: 1.6, subject: "fabric", seconds: 3 })).toEqual({
      degrees: 180,
      zoom: 2.4,
      toZoom: 1.6,
      subject: "fabric",
      seconds: 3,
    });
  });

  it("still gives a straight-on shot of the whole garment for a detail that says nothing usable", () => {
    expect(cameraAsk(null)).toEqual({ degrees: 0, zoom: 1, toZoom: null, subject: "garment", seconds: 0 });
    expect(cameraAsk({ degrees: "round", zoom: Number.NaN, subject: "the crest please" })).toEqual({
      degrees: 0,
      zoom: 1,
      toZoom: null,
      subject: "garment",
      seconds: 0,
    });
  });

  it("holds a zoom inside what a camera can do", () => {
    expect(cameraAsk({ zoom: 0 }).zoom).toBe(0.1);
    expect(cameraAsk({ zoom: 500 }).zoom).toBe(8);
  });

  it("reads a colourway and a turn, and says no to a detail that names neither", () => {
    expect(colourwayAsked({ colourway: " away " })).toBe("away");
    expect(colourwayAsked({ colourway: "" })).toBeNull();
    expect(colourwayAsked(undefined)).toBeNull();
    expect(turnAsked({ revolutionSeconds: 6 })).toBe(6);
    expect(turnAsked({ revolutionSeconds: null })).toBeNull();
    expect(turnAsked({ revolutionSeconds: -2 })).toBeNull();
  });
});

describe("where a shot's camera stands", () => {
  it("frames the crest above the middle of the garment and the fabric on it", () => {
    expect(subjectHeight("garment", 0.8)).toBe(0);
    expect(subjectHeight("fabric", 0.8)).toBe(0);
    expect(subjectHeight("crest", 0.8)).toBeCloseTo(0.176, 3);
  });

  it("comes closer for a zoom above one, and never outside the view's own limits", () => {
    const limits = { min: 0.5, max: 4 };
    expect(distanceFor(2, 1, limits)).toBe(2);
    expect(distanceFor(2, 2, limits)).toBe(1);
    expect(distanceFor(2, 8, limits)).toBe(0.5);
    expect(distanceFor(2, 0.1, limits)).toBe(4);
  });
});

describe("a view that listens", () => {
  it("answers with the abilities its handlers really have, and no more", () => {
    const target = new EventTarget();
    listenForVideoEvents(target, { turn: () => undefined });

    expect(askAbilities(target, { event })).toEqual(["turn"]);
  });

  it("answers turn, camera and colourway when it can do all three", () => {
    const target = new EventTarget();
    listenForVideoEvents(target, { turn: () => undefined, camera: () => undefined, colourway: () => undefined });

    expect(askAbilities(target, { event })).toEqual(["turn", "camera", "colourway"]);
  });

  it("passes each event to its handler, and a colourway that names nothing to none", () => {
    const seen: string[] = [];
    const target = new EventTarget();
    const asks: CameraAsk[] = [];
    listenForVideoEvents(target, {
      turn: (seconds) => seen.push(`turn ${seconds}`),
      camera: (ask) => asks.push(ask),
      colourway: (one) => seen.push(`kit ${one}`),
    });

    target.dispatchEvent(event(VIEW_EVENTS.turn, { revolutionSeconds: 6 }));
    target.dispatchEvent(event(VIEW_EVENTS.camera, { degrees: 90, zoom: 1, subject: "crest", seconds: 2 }));
    target.dispatchEvent(event(VIEW_EVENTS.colourway, { colourway: "gk" }));
    target.dispatchEvent(event(VIEW_EVENTS.colourway, {}));

    expect(seen).toEqual(["turn 6", "kit gk"]);
    expect(asks).toEqual([{ degrees: 90, zoom: 1, toZoom: null, subject: "crest", seconds: 2 }]);
  });

  it("stops listening when the scene is disposed, so a second view is not driven by the first", () => {
    const seen: string[] = [];
    const target = new EventTarget();
    const stop = listenForVideoEvents(target, { turn: () => seen.push("turn"), camera: () => seen.push("camera") });

    stop();
    target.dispatchEvent(event(VIEW_EVENTS.turn, { revolutionSeconds: 6 }));
    target.dispatchEvent(event(VIEW_EVENTS.camera, {}));

    expect(seen).toEqual([]);
    expect(askAbilities(target, { event })).toEqual(["turn"]);
  });

  it("counts turn as answered even by a view that does nothing else", () => {
    expect(abilitiesOf({ turn: () => undefined })).toEqual(["turn"]);
    expect(abilitiesOf({ turn: () => undefined, camera: () => undefined })).toEqual(["turn", "camera"]);
  });
});

/**
 * The whole point of the change, asked of L5's own verdict: before a view answered anything but the
 * turn, three of the four free videos were refused.
 */
describe("what the video studio may now record", () => {
  const abilities = (handlers: ViewHandlers): readonly ViewCapability[] => {
    const target = new EventTarget();
    listenForVideoEvents(target, handlers);
    return askAbilities(target, { event }) as readonly ViewCapability[];
  };

  it("offered only the turntable from a view that could only turn", () => {
    const has = abilities({ turn: () => undefined });
    const offered = SEQUENCES.filter((sequence) => sequenceVerdict(sequence, has).offered).map((sequence) => sequence.key);

    expect(offered).toEqual(["turntable"]);
    const flip = sequenceVerdict(VIDEO_SEQUENCES.flip, has);
    expect(flip.offered).toBe(false);
    if (!flip.offered) expect(flip.reason).toMatch(/cannot point the camera yet/);
  });

  it("offers the flip and the kit reveal to a view that answers the camera", () => {
    const has = abilities({ turn: () => undefined, camera: () => undefined });
    const offered = SEQUENCES.filter((sequence) => sequenceVerdict(sequence, has).offered).map((sequence) => sequence.key);

    expect(offered).toEqual(["turntable", "flip", "kit_reveal"]);
  });

  it("offers all four, the carousel among them, to a view that answers the colourway too", () => {
    const has = abilities({ turn: () => undefined, camera: () => undefined, colourway: () => undefined });
    const offered = SEQUENCES.filter((sequence) => sequenceVerdict(sequence, has).offered).map((sequence) => sequence.key);

    expect(offered).toEqual(["turntable", "flip", "kit_reveal", "carousel"]);
  });

  it("sends the kit reveal's own shots to a listening view, and each one is read back whole", () => {
    const asks: CameraAsk[] = [];
    const kits: string[] = [];
    const target = new EventTarget();
    listenForVideoEvents(target, { turn: () => undefined, camera: (ask) => asks.push(ask), colourway: (one) => kits.push(one) });
    const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.kit_reveal, aspect: "9:16" }) as unknown as PlanLike;

    for (const command of shotCommands(plan)) target.dispatchEvent(event(command.event, command.detail));

    expect(asks.map((ask) => ask.subject)).toEqual(["fabric", "garment", "crest"]);
    expect(asks[0]?.zoom).toBeGreaterThan(asks[0]?.toZoom ?? 0);
    expect(kits).toEqual(["home"]);
  });
});
