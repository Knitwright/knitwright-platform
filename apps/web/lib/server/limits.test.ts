import { describe, expect, it } from "vitest";
import { POLL_INTERVAL_MS } from "@/lib/images/panel-state";
import { LIMITS } from "./limits";

const rules = Object.values(LIMITS);

describe("LIMITS", () => {
  it("gives every limit its own name, because limits with one name share one count", () => {
    const names = rules.map((rule) => rule.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("allows at least one request in a window of at least one second", () => {
    for (const rule of rules) {
      expect(rule.limit).toBeGreaterThanOrEqual(1);
      expect(rule.windowSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses names that cannot be confused with the rest of a key", () => {
    for (const rule of rules) expect(rule.name).toMatch(/^[a-z][a-z-]*$/);
  });

  it("keeps guessing a password slower than one try a minute", () => {
    expect(LIMITS.signIn.limit / LIMITS.signIn.windowSeconds).toBeLessThanOrEqual(1 / 60);
  });

  it("lets a person download the four files of a tech pack twice in a window, and no faster than one export every ten seconds", () => {
    expect(LIMITS.export.limit).toBeGreaterThanOrEqual(8);
    expect(LIMITS.export.limit / LIMITS.export.windowSeconds).toBeLessThanOrEqual(1 / 10);
  });

  it("lets the photoreal panel poll a job at its pace without being turned away", () => {
    const pollsInWindow = (LIMITS.pollJob.windowSeconds * 1000) / POLL_INTERVAL_MS;
    expect(LIMITS.pollJob.limit).toBeGreaterThanOrEqual(pollsInWindow * 2);
  });
});
