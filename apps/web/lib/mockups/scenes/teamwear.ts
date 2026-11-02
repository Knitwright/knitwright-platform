import { at, centre, slot, type ScenePlan } from "./build";
import type { SlotFrame } from "../types";

/**
 * `07`'s Teamwear scene group:
 *
 *   Kit laid out in a changing room · kit on a bench · team line-up (5 / 11 players) ·
 *   captain holding shirt · pitch at night under floodlights · tunnel walk-out
 *
 * Every one of them is a photographic place, so every one is an **AI scene**: the model draws the
 * room, the light and the people, and the garment it is given is the one the platform drew. They are
 * carried here as rows so the library is whole, and L3 runs them. Nothing in this workstream calls a
 * model, so each of these shows a labelled placeholder until L3 lands.
 *
 * The line-up scenes are the reason `07` gives a scene up to eleven garment slots: each shirt in the
 * row is one slot, with its own place on the canvas and its own roster entry.
 */

/** `count` shirts in an even row across the canvas, each one a garment slot of its own. */
function lineUp(count: number, top: number, height: number): readonly SlotFrame[] {
  const gap = 0.012;
  const width = (1 - gap * (count + 1)) / count;
  return Array.from({ length: count }, (_, at_) => ({ x: gap + at_ * (width + gap), y: top, width, height }));
}

const FOOTBALL = ["football", "training"];

const row = (count: number, top: number, height: number) =>
  lineUp(count, top, height).map((frame, index) => slot(index % 2 === 0 ? "front" : "three-quarter", "worn", "Arms crossed", "Eye level, straight on", frame));

export const TEAMWEAR_SCENES: readonly ScenePlan[] = [
  {
    slug: "changing-room-kit-layout",
    title: "Kit laid out in a changing room",
    group: "teamwear",
    source: "ai",
    backdrop: "interior",
    lighting: "Overhead strip lights, cool",
    people: "none",
    slots: [
      slot("front", "flat", "Laid out on the bench", "Straight down from above", at(0.08, 0.2, 0.4, 0.6)),
      slot("back", "flat", "Laid out on the bench", "Straight down from above", at(0.52, 0.2, 0.4, 0.6)),
    ],
    sports: FOOTBALL,
    moods: ["bold", "sharp"],
  },
  {
    slug: "kit-on-a-bench",
    title: "Kit on a bench",
    group: "teamwear",
    source: "ai",
    backdrop: "interior",
    lighting: "Window light from one side",
    people: "none",
    slots: [slot("front", "flat", "Folded on the bench", "Slightly above, straight on", centre(0.6, 0.5))],
    sports: FOOTBALL,
    moods: ["understated"],
  },
  {
    slug: "team-line-up-five",
    title: "Team line-up, five players",
    group: "teamwear",
    source: "ai",
    backdrop: "outfield",
    lighting: "Open daylight",
    people: "team",
    slots: row(5, 0.28, 0.52),
    sports: FOOTBALL,
    moods: ["bold"],
  },
  {
    slug: "team-line-up-eleven",
    title: "Team line-up, eleven players",
    group: "teamwear",
    source: "ai",
    backdrop: "outfield",
    lighting: "Open daylight",
    people: "team",
    slots: row(11, 0.34, 0.42),
    sports: FOOTBALL,
    moods: ["bold"],
    crops: ["16:9", "1:1"],
  },
  {
    slug: "captain-holding-shirt",
    title: "Captain holding the shirt",
    group: "teamwear",
    source: "ai",
    backdrop: "outfield",
    lighting: "Late afternoon, low sun",
    people: "one",
    slots: [slot("front", "worn", "Holding the shirt up", "Eye level, straight on", centre(0.5, 0.56))],
    sports: FOOTBALL,
    moods: ["bold", "sharp"],
  },
  {
    slug: "floodlit-pitch",
    title: "Floodlit pitch at night",
    group: "teamwear",
    source: "ai",
    backdrop: "night",
    lighting: "Floodlights from four corners",
    people: "one",
    slots: [slot("front", "worn", "Ball at feet", "Low angle", centre(0.46, 0.6))],
    sports: FOOTBALL,
    moods: ["bold", "sharp"],
  },
  {
    slug: "tunnel-walk-out",
    title: "Tunnel walk-out",
    group: "teamwear",
    source: "ai",
    backdrop: "night",
    lighting: "Bright mouth of the tunnel behind",
    people: "team",
    slots: row(3, 0.3, 0.52),
    sports: FOOTBALL,
    moods: ["bold", "sharp"],
  },
];
