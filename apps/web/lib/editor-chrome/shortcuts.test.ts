import { describe, expect, it } from "vitest";
import { SHORTCUT_ROWS, shortcutOf } from "./index";

describe("the editor's keyboard shortcuts (08 §5.8)", () => {
  it("picks a tool with its letter, either case", () => {
    expect(shortcutOf({ key: "v" })).toEqual({ kind: "tool", tool: "select" });
    expect(shortcutOf({ key: "F" })).toEqual({ kind: "tool", tool: "frame" });
    expect(shortcutOf({ key: "r" })).toEqual({ kind: "tool", tool: "shape" });
    expect(shortcutOf({ key: "o" })).toEqual({ kind: "tool", tool: "shape" });
    expect(shortcutOf({ key: "p" })).toEqual({ kind: "tool", tool: "pen" });
    expect(shortcutOf({ key: "t" })).toEqual({ kind: "tool", tool: "text" });
    expect(shortcutOf({ key: "c" })).toEqual({ kind: "tool", tool: "comment" });
    expect(shortcutOf({ key: "x" })).toBeNull();
    expect(shortcutOf({ key: "V", shiftKey: true })).toBeNull();
  });

  it("zooms, fits, saves, undoes and redoes with Ctrl or ⌘", () => {
    expect(shortcutOf({ key: "=", ctrlKey: true })).toEqual({ kind: "zoom-in" });
    expect(shortcutOf({ key: "+", metaKey: true })).toEqual({ kind: "zoom-in" });
    expect(shortcutOf({ key: "-", ctrlKey: true })).toEqual({ kind: "zoom-out" });
    expect(shortcutOf({ key: "0", metaKey: true })).toEqual({ kind: "fit" });
    expect(shortcutOf({ key: "s", metaKey: true })).toEqual({ kind: "save" });
    expect(shortcutOf({ key: "z", ctrlKey: true })).toEqual({ kind: "undo" });
    expect(shortcutOf({ key: "Z", ctrlKey: true, shiftKey: true })).toEqual({ kind: "redo" });
    expect(shortcutOf({ key: "y", ctrlKey: true })).toEqual({ kind: "redo" });
    expect(shortcutOf({ key: "d", ctrlKey: true })).toEqual({ kind: "duplicate" });
    expect(shortcutOf({ key: "q", ctrlKey: true })).toBeNull();
  });

  it("deletes and escapes", () => {
    expect(shortcutOf({ key: "Delete" })).toEqual({ kind: "delete" });
    expect(shortcutOf({ key: "Backspace" })).toEqual({ kind: "delete" });
    expect(shortcutOf({ key: "Escape" })).toEqual({ kind: "escape" });
  });

  it("is never a shortcut while a person types, or with Alt held", () => {
    expect(shortcutOf({ key: "v", target: { tagName: "INPUT" } })).toBeNull();
    expect(shortcutOf({ key: "Delete", target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(shortcutOf({ key: "s", ctrlKey: true, target: { isContentEditable: true } })).toBeNull();
    expect(shortcutOf({ key: "v", altKey: true })).toBeNull();
  });

  it("lists a row for each binding it answers to", () => {
    expect(SHORTCUT_ROWS.length).toBeGreaterThan(10);
    expect(SHORTCUT_ROWS.every((row) => row.keys.length > 0 && row.does.length > 0)).toBe(true);
  });
});
