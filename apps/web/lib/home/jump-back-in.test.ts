import { describe, expect, it } from "vitest";
import { chipFromQuery, chipHref, emptyFor, JUMP_CHIP_VIEWS, showsDesigns } from "./jump-back-in";
import { greetingFor } from "./greeting";

/** Decision 0074: the "Jump back in" chips of spec F-S4, and the greeting above them. */

describe("the jump-back-in chips", () => {
  it("holds All and the five kinds spec F-S4 lists", () => {
    expect(JUMP_CHIP_VIEWS.map((chip) => chip.label)).toEqual(["All", "Designs", "Collections", "Moodboards", "Mockups", "Flows"]);
  });

  it("marks only All and Designs as built, because nothing else is stored yet", () => {
    expect(JUMP_CHIP_VIEWS.filter((chip) => chip.built).map((chip) => chip.id)).toEqual(["all", "designs"]);
  });

  it("says in one sentence that an unbuilt kind is coming later, and nothing for a built one", () => {
    expect(emptyFor(JUMP_CHIP_VIEWS[0]!)).toBeNull();
    expect(emptyFor(JUMP_CHIP_VIEWS[2]!)).toBe("Collections: coming in a later release.");
  });

  it("reads the chip from the address and falls back to All", () => {
    expect(chipFromQuery("designs")).toBe("designs");
    expect(chipFromQuery(["flows", "designs"])).toBe("flows");
    expect(chipFromQuery("nonsense")).toBe("all");
    expect(chipFromQuery(undefined)).toBe("all");
  });

  it("leaves All out of the address and names every other chip", () => {
    expect(chipHref("/studio", "all")).toBe("/studio");
    expect(chipHref("/studio", "moodboards")).toBe("/studio?jump=moodboards");
  });

  it("shows designs for All and Designs only", () => {
    expect(showsDesigns("all")).toBe(true);
    expect(showsDesigns("designs")).toBe(true);
    expect(showsDesigns("mockups")).toBe(false);
  });
});

describe("the greeting", () => {
  it("changes with the hour and names the workspace", () => {
    expect(greetingFor(8, "Harbour Hockey")).toBe("Good morning, Harbour Hockey");
    expect(greetingFor(12, "Harbour Hockey")).toBe("Good afternoon, Harbour Hockey");
    expect(greetingFor(17, "Harbour Hockey")).toBe("Good afternoon, Harbour Hockey");
    expect(greetingFor(18, "Harbour Hockey")).toBe("Good evening, Harbour Hockey");
    expect(greetingFor(23, "Harbour Hockey")).toBe("Good evening, Harbour Hockey");
  });
});
