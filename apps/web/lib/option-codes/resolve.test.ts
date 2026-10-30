import { describe, expect, it } from "vitest";
import { OPTION_CODE_MAP_SEED } from "./seed/rows";
import { boundRegistryKeys, codeForGroup, noCodeSentence, uncodedChoices } from "./resolve";
import type { OptionCodeMapping } from "./types";

/**
 * Reading the map. The design object of a design made before the catalogue existed holds the registry's own words,
 * so these are the real records: `collar: "none"` is the answer to the registry's stand-collar question, and
 * `neckline: "crew"` is what the catalogue's `collar` group is about.
 */

const MAP = OPTION_CODE_MAP_SEED;

/** A design made on the registry, as `toDesignObjectV2` writes it. */
const registryDesign = (patch: Record<string, string> = {}) => ({
  fit: "regular",
  neckline: "crew",
  collar: "none",
  placket: "none",
  "sleeve-type": "set-in",
  "sleeve-length": "short",
  "hem-shape": "straight",
  "side-panels": "none",
  cuffs: "none",
  ...patch,
});

describe("the code for a catalogue option group", () => {
  it("reads the group from the registry key the map binds to it, not the key of the same name", () => {
    expect(boundRegistryKeys(MAP, "collar")).toEqual(["neckline"]);
    expect(codeForGroup(MAP, "collar", registryDesign())).toMatchObject({ outcome: "code", code: "C01", registryKey: "neckline" });
    expect(codeForGroup(MAP, "collar", registryDesign({ neckline: "v-neck" }))).toMatchObject({ outcome: "code", code: "C02" });
  });

  it("is not changed by the registry's own collar question, which asks about something else", () => {
    const banded = registryDesign({ collar: "band-collar" });
    expect(codeForGroup(MAP, "collar", banded)).toMatchObject({ outcome: "code", code: "C01" });
  });

  it("reads the sleeve finish from the cuffs question", () => {
    expect(codeForGroup(MAP, "sleeve_finish", registryDesign())).toMatchObject({ outcome: "code", code: "K01" });
    expect(codeForGroup(MAP, "sleeve_finish", registryDesign({ cuffs: "rib-cuff" }))).toMatchObject({ outcome: "code", code: "K02" });
  });

  it("says nothing was chosen for a group no registry key feeds, and gives the reason", () => {
    const outcome = codeForGroup(MAP, "pattern_fill", registryDesign());
    expect(outcome.outcome).toBe("not_chosen");
    expect(outcome.outcome === "not_chosen" && outcome.note).toContain("drawn as artwork layers");
  });

  it("says nothing was chosen when the design is silent about the group's own key", () => {
    const { neckline: _neckline, ...rest } = registryDesign();
    expect(codeForGroup(MAP, "collar", rest)).toEqual({ outcome: "not_chosen", note: null });
  });

  it("gives no code for a group whose own key holds a choice nothing published joins to one", () => {
    const map: readonly OptionCodeMapping[] = [
      ...MAP,
      {
        articleCode: "JSY-SS-01",
        registryKey: "neckline",
        registryChoice: "henley",
        optionGroup: "collar",
        optionCode: null,
        kind: "no_code_yet",
        sources: [],
        note: "No published source names a code for a henley neck on this article.",
        ruleId: "R-GAP-000",
      },
    ];
    const outcome = codeForGroup(map, "collar", registryDesign({ neckline: "henley" }));
    expect(outcome).toMatchObject({ outcome: "no_code_yet", registryKey: "neckline", registryChoice: "henley" });
    expect(outcome.outcome === "no_code_yet" && outcome.sentence).toBe(noCodeSentence("neckline", "henley"));
  });

  it("gives no code for a group the map does not cover at all", () => {
    expect(codeForGroup(MAP, "pocket", registryDesign())).toEqual({ outcome: "not_chosen", note: null });
  });
});

describe("the sentence a tech pack field shows where no code exists", () => {
  it("names the design's own word and says plainly that it is not a code", () => {
    const sentence = noCodeSentence("collar", "band-collar");
    expect(sentence).toBe(
      'No catalogue code yet: the design asked for "band-collar" under the design option "collar", and nothing published joins it to a code.',
    );
    expect(sentence).not.toMatch(/\b[A-Z][0-9]{2}\b/);
  });
});

describe("the design's own choices the catalogue has no code for", () => {
  it("is empty for a design that asks for nothing the article does not have", () => {
    expect(uncodedChoices(MAP, registryDesign())).toEqual([]);
  });

  it("names each one with the sentence the field shows", () => {
    const asked = registryDesign({ collar: "band-collar", placket: "zip", "hem-shape": "side-vent" });
    const found = uncodedChoices(MAP, asked);
    expect(found.map((choice) => choice.registryKey)).toEqual(["collar", "placket", "hem-shape"]);
    expect(found[0]?.sentence).toBe(noCodeSentence("collar", "band-collar"));
    expect(found[0]?.note).toContain("band collar");
  });

  it("leaves out a choice that is already a group's own answer, so it is reported once", () => {
    const map: readonly OptionCodeMapping[] = [
      {
        articleCode: "JSY-SS-01",
        registryKey: "neckline",
        registryChoice: "henley",
        optionGroup: "collar",
        optionCode: null,
        kind: "no_code_yet",
        sources: [],
        note: "none yet",
        ruleId: "R-GAP-000",
      },
    ];
    expect(uncodedChoices(map, registryDesign({ neckline: "henley" }))).toEqual([]);
  });

  it("ignores a key the design says nothing about", () => {
    expect(uncodedChoices(MAP, {})).toEqual([]);
  });
});
