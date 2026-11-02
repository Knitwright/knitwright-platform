import { describe, expect, it } from "vitest";
import { ALL_SHOOT_CONCEPTS, conceptBySlug } from "./concepts";
import {
  NO_FILTERS,
  anyFilterSet,
  filterConcepts,
  libraryGaps,
  matches,
  moodChoices,
  peopleChoices,
  sportChoices,
  styleChoices,
} from "./library";
import { SHOOT_GAP_RULE, SHOOT_STYLES } from "./types";

/** The library panel's own logic, with no shell and no browser. */

describe("searching the shoot ideas", () => {
  it("shows everything when nothing is searched for", () => {
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, NO_FILTERS)).toHaveLength(12);
    expect(anyFilterSet(NO_FILTERS)).toBe(false);
  });

  it("searches the words a person would type: the title, the lead, the light, the tags and the style", () => {
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, text: "floodlights" }).map((one) => one.slug)).toEqual(["floodlit-pitch"]);
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, text: "tunnel" })).toHaveLength(1);
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, text: "esports" }).length).toBeGreaterThan(0);
  });

  it("wants every word, not any of them", () => {
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, text: "gym mirror" })).toHaveLength(1);
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, text: "gym tunnel" })).toHaveLength(0);
  });

  it("filters by sport, by mood and by whether there is a person in it", () => {
    const football = filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, sport: "football" });
    expect(football.length).toBeGreaterThan(0);
    expect(football.every((one) => one.sports.includes("football"))).toBe(true);
    const bold = filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, mood: "bold" });
    expect(bold.every((one) => one.moods.includes("bold"))).toBe(true);
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, withPeople: false }).map((one) => one.slug)).toEqual(["kit-in-the-changing-room"]);
    expect(filterConcepts(ALL_SHOOT_CONCEPTS, { ...NO_FILTERS, withPeople: true })).toHaveLength(11);
  });

  it("knows when a filter is set, so the panel can tell nothing found from nothing searched for", () => {
    expect(anyFilterSet({ ...NO_FILTERS, text: " " })).toBe(false);
    expect(anyFilterSet({ ...NO_FILTERS, text: "gym" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, sport: "football" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, mood: "bold" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, withPeople: false })).toBe(true);
  });

  it("matches one concept against one set of filters", () => {
    const concept = conceptBySlug("gym-session")!;
    expect(matches(concept, { ...NO_FILTERS, sport: "training" })).toBe(true);
    expect(matches(concept, { ...NO_FILTERS, sport: "combat" })).toBe(false);
    expect(matches(concept, { ...NO_FILTERS, mood: "playful" })).toBe(false);
  });
});

describe("the choices a filter offers", () => {
  it("counts how many each one would leave, in a steady order", () => {
    const sports = sportChoices(ALL_SHOOT_CONCEPTS);
    expect(sports.length).toBeGreaterThan(0);
    expect(sports.map((choice) => choice.value)).toEqual([...sports.map((choice) => choice.value)].sort());
    for (const choice of sports) expect(choice.count).toBeGreaterThan(0);
    expect(moodChoices(ALL_SHOOT_CONCEPTS).every((choice) => choice.count > 0)).toBe(true);
  });

  it("writes a tag as words rather than as a key", () => {
    const running = sportChoices(ALL_SHOOT_CONCEPTS).find((choice) => choice.value === "running-gym");
    expect(running?.label).toBe("Running gym");
  });

  it("offers the two people choices, each with a count", () => {
    expect(peopleChoices(ALL_SHOOT_CONCEPTS).map((choice) => choice.value)).toEqual(["with", "without"]);
    expect(peopleChoices([]).length).toBe(0);
  });

  it("offers every style F-L1 names, with its own words", () => {
    expect(styleChoices().map((choice) => choice.value).sort()).toEqual([...SHOOT_STYLES].sort());
    for (const choice of styleChoices()) expect(choice.label.length).toBeGreaterThan(0);
  });
});

describe("the gaps the library shows", () => {
  it("lists the pose-count gap once, however many concepts share it", () => {
    const gaps = libraryGaps();
    expect(gaps.length).toBe(1);
    expect(gaps[0]!.ruleId).toBe(SHOOT_GAP_RULE);
  });

  it("lists nothing for concepts that have everything 07 asks for", () => {
    expect(libraryGaps([conceptBySlug("team-line-up")!])).toEqual([]);
  });
});
