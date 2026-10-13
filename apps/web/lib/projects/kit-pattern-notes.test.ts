import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { browserActionSchema } from "./browser-action";
import { describeAction, describeProposal } from "./notes";

describe("kit patterns in a design's history and from a browser", () => {
  it("says what changed in plain words", () => {
    const spec = start("team-jersey");
    const set = { type: "set-kit-pattern", kitPattern: { style: "chest-band", colours: [{ colour: "Gold" }], provenance: "user-edited" } } as const;
    expect(describeAction(spec, set)).toBe("Kit pattern set to Chest band.");
    expect(describeAction(spec, { type: "remove-kit-pattern" })).toBe("Kit pattern removed. The kit is plain.");
    expect(describeProposal("kit-style", ["Kit style Hoops."])).toBe("Picked from the kit styles: Kit style Hoops.");
  });

  it("stamps a pattern sent by a browser as the person's own, whatever source it claims", () => {
    const parsed = browserActionSchema.parse({
      type: "set-kit-pattern",
      kitPattern: { style: "hoops", colours: [{ colour: "Gold" }], provenance: "ai-suggested" },
    });
    expect(parsed.type === "set-kit-pattern" && parsed.kitPattern.provenance).toBe("user-edited");
  });
});
