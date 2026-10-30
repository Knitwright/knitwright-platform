import type { RulebookEntry } from "../types";

/** A rulebook entry for tests, with the words of R-SUB-004 version 1 unless changed. */
export const entry = (over: Partial<RulebookEntry> = {}): RulebookEntry => ({
  id: "e1",
  ruleId: "R-SUB-004",
  version: 1,
  topic: "print",
  articleCodes: [],
  methods: ["sublimation"],
  scopeNote: "scope not reviewed by a factory",
  title: "Seam crossings",
  rule: "Artwork that crosses a seam can be offset by up to 3 mm after sewing; critical elements keep 15 mm away from seams",
  body: "Each panel is printed and cut separately, then sewn; sewing shifts panels slightly",
  bestPractice: "Stripes across seams are fine if a small offset is acceptable; crests, numbers and text are not",
  source: "standard",
  sourceNote: "Sublimation practice",
  status: "draft",
  confirmedBy: null,
  confirmedName: null,
  confirmedRole: null,
  confirmedAt: null,
  createdAt: "2026-11-01T02:00:00Z",
  ...over,
});
