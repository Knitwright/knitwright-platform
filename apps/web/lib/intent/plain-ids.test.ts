import { describe, expect, it } from "vitest";
import { plainIds } from "./plain-ids";

describe("words a model wrote, with ids turned back into labels", () => {
  it("names the choices of an option written with its id", () => {
    expect(plainIds("V-neck needs collar none/band-collar first.")).toBe("V neck needs No collar or Band collar first.");
    expect(plainIds("Set collar=none and placket=zip.")).toBe("Set No collar and Zip.");
    expect(plainIds('Choose collar "none" or "band-collar".')).toBe("Choose No collar or Band collar.");
  });

  it("names an id with a hyphen on its own", () => {
    expect(plainIds("A team-jersey can have a band-collar.")).toBe("A Team jersey can have a Band collar.");
    expect(plainIds("The chest-width of the body-front.")).toBe("The Chest width of the Body front.");
  });

  it("leaves plain words alone, including ones that are also ids", () => {
    const words = "There is none left, so make it slim with long sleeves. A T-shirt is fine.";
    expect(plainIds(words)).toBe(words);
  });

  it("leaves an option name alone when what follows is not one of its choices", () => {
    expect(plainIds("The collar is lovely.")).toBe("The collar is lovely.");
  });
});
