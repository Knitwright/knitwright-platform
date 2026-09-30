import { describe, expect, it } from "vitest";
import { PLAIN_WORDS, plain, withPlain } from "./vocabulary";

describe("the plain words for technical terms", () => {
  it("gives a plain word for each term the guided flow shows", () => {
    expect(plain("tech pack")).toBe("factory file");
    expect(plain("flat")).toBe("drawing");
    expect(plain("point of measure")).toBe("measurement");
    expect(plain("tolerance")).toBe("allowed difference");
    expect(plain("colourway")).toBe("colour version");
  });

  it("finds a term whatever its case, and keeps a capital at the start", () => {
    expect(plain("Tech pack")).toBe("Factory file");
    expect(plain("TOLERANCE")).toBe("Allowed difference");
  });

  it("gives back a word it does not know unchanged", () => {
    expect(plain("chest width")).toBe("chest width");
  });

  it("names the term beside its plain word, so the person learns the word a factory uses", () => {
    expect(withPlain("tech pack")).toBe("factory file (tech pack)");
    expect(withPlain("chest width")).toBe("chest width");
  });

  it("never explains a term with another term from the list", () => {
    const terms = Object.keys(PLAIN_WORDS);
    for (const [term, words] of Object.entries(PLAIN_WORDS)) {
      expect(term, term).toBe(term.toLowerCase().trim());
      expect(words.length, term).toBeGreaterThan(0);
      for (const other of terms) {
        expect(new RegExp(`\\b${other}\\b`, "i").test(words), `${term} is explained with ${other}`).toBe(false);
      }
    }
  });
});
