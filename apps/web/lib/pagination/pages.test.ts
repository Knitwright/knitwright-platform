import { describe, expect, it } from "vitest";
import { MAX_PAGE, pageCount, pageHref, pageMarks, pageOf, pageRequest, readPage } from "./pages";

describe("readPage", () => {
  it("reads a whole number from 1 up", () => {
    expect(readPage("3")).toBe(3);
    expect(readPage(["2", "9"])).toBe(2);
  });

  it("reads anything else as the first page", () => {
    for (const value of [undefined, "", "0", "-2", "1.5", "two", "1e3", " 2", "99999999"]) {
      expect(readPage(value)).toBe(1);
    }
    expect(readPage([])).toBe(1);
  });

  it("stops at the highest page", () => {
    expect(readPage("999999")).toBe(MAX_PAGE);
  });
});

describe("pageRequest", () => {
  it("works out the rows before the page", () => {
    expect(pageRequest({ page: "3" }, 12)).toEqual({ page: 3, perPage: 12, offset: 24 });
    expect(pageRequest({}, 12)).toEqual({ page: 1, perPage: 12, offset: 0 });
  });
});

describe("pageCount", () => {
  it("rounds up, and an empty list has one page", () => {
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(-4, 12)).toBe(1);
    expect(pageCount(12, 12)).toBe(1);
    expect(pageCount(13, 12)).toBe(2);
  });
});

describe("pageOf", () => {
  it("takes one page of rows", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(pageOf(rows, { page: 2, perPage: 2, offset: 2 })).toEqual([3, 4]);
    expect(pageOf(rows, { page: 4, perPage: 2, offset: 6 })).toEqual([]);
  });
});

describe("pageMarks", () => {
  it("shows every page of a short list", () => {
    expect(pageMarks(1, 1)).toEqual([1]);
    expect(pageMarks(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("leaves gaps in a long list, around the current page", () => {
    expect(pageMarks(1, 20)).toEqual([1, 2, "gap", 20]);
    expect(pageMarks(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageMarks(20, 20)).toEqual([1, "gap", 19, 20]);
  });

  it("shows a single left-out page instead of a gap", () => {
    expect(pageMarks(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
  });
});

describe("pageHref", () => {
  it("gives page 1 the list's own address", () => {
    expect(pageHref("/studio", 1)).toBe("/studio");
    expect(pageHref("/studio", 3)).toBe("/studio?page=3");
  });
});
