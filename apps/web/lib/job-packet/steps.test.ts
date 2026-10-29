import { describe, expect, it } from "vitest";
import { isForwardStep, ORDER_STATUSES, type OrderStatus } from "@/lib/ops/status";
import {
  canRecordStep,
  DEFAULT_PACKET_DAYS,
  EVENT_LABELS,
  FACTORY_EVENT_KINDS,
  FACTORY_STEPS,
  isFactoryStep,
  lastStep,
  MAX_PACKET_DAYS,
  nextStep,
  NOTE_MAX,
  ORDER_MOVE,
  type FactoryEventKind,
  type FactoryStep,
} from "./steps";

const events = (...kinds: FactoryEventKind[]) => kinds.map((kind) => ({ kind }));

describe("the steps a factory may record", () => {
  it("are the three of spec F-O2, in the order the factory presses them", () => {
    expect(FACTORY_STEPS).toEqual(["received", "in_production", "ready_for_qc"]);
    expect(FACTORY_EVENT_KINDS).toEqual(["received", "in_production", "ready_for_qc", "note", "photo"]);
  });

  it("each have a label in plain words", () => {
    for (const kind of FACTORY_EVENT_KINDS) expect(EVENT_LABELS[kind]).toMatch(/^[A-Z]/);
    expect(EVENT_LABELS.ready_for_qc).toBe("Ready for QC");
  });

  it("are told apart from a note and a photo", () => {
    expect(FACTORY_STEPS.every(isFactoryStep)).toBe(true);
    expect(isFactoryStep("note")).toBe(false);
    expect(isFactoryStep("photo")).toBe(false);
    expect(isFactoryStep("shipped")).toBe(false);
  });
});

describe("ORDER_MOVE", () => {
  it("moves an order exactly as the ops console's own steps do", () => {
    for (const step of FACTORY_STEPS) {
      const { from, to } = ORDER_MOVE[step];
      expect(ORDER_STATUSES).toContain(from);
      expect(ORDER_STATUSES).toContain(to);
      expect(isForwardStep(from, to as OrderStatus)).toBe(true);
    }
  });

  it("starts from an order that is in a batch and ends at ready", () => {
    expect(ORDER_MOVE.received).toEqual({ from: "batched", to: "received" });
    expect(ORDER_MOVE.ready_for_qc).toEqual({ from: "in_production", to: "ready" });
  });
});

describe("canRecordStep", () => {
  it("takes each step once, in order, from nothing recorded yet", () => {
    expect(canRecordStep(null, "received")).toBe(true);
    expect(canRecordStep("received", "in_production")).toBe(true);
    expect(canRecordStep("in_production", "ready_for_qc")).toBe(true);
  });

  it.each<[FactoryStep | null, FactoryStep]>([
    [null, "in_production"],
    [null, "ready_for_qc"],
    ["received", "received"],
    ["received", "ready_for_qc"],
    ["in_production", "received"],
    ["in_production", "in_production"],
    ["ready_for_qc", "received"],
    ["ready_for_qc", "in_production"],
    ["ready_for_qc", "ready_for_qc"],
  ])("refuses %s then %s: no skipping, no repeating, no going back", (last, step) => {
    expect(canRecordStep(last, step)).toBe(false);
  });
});

describe("nextStep", () => {
  it("offers one button at a time and none once the batch is ready for QC", () => {
    expect(nextStep(null)).toBe("received");
    expect(nextStep("received")).toBe("in_production");
    expect(nextStep("in_production")).toBe("ready_for_qc");
    expect(nextStep("ready_for_qc")).toBeNull();
  });
});

describe("lastStep", () => {
  it("is the last step among the events, and notes and photos do not count", () => {
    expect(lastStep([])).toBeNull();
    expect(lastStep(events("note", "photo"))).toBeNull();
    expect(lastStep(events("received", "note", "photo"))).toBe("received");
    expect(lastStep(events("received", "in_production", "note"))).toBe("in_production");
    expect(lastStep(events("received", "in_production", "ready_for_qc"))).toBe("ready_for_qc");
  });

  it("and nextStep together walk a packet from its first press to its last", () => {
    const recorded: FactoryEventKind[] = ["note"];
    const pressed: FactoryStep[] = [];
    for (let guard = 0; guard < 10; guard += 1) {
      const step = nextStep(lastStep(events(...recorded)));
      if (!step) break;
      pressed.push(step);
      recorded.push(step, "photo");
    }

    expect(pressed).toEqual([...FACTORY_STEPS]);
  });
});

describe("the limits a link carries", () => {
  it("last four weeks by default and ninety days at most, as the database allows", () => {
    expect(DEFAULT_PACKET_DAYS).toBe(28);
    expect(MAX_PACKET_DAYS).toBe(90);
    expect(DEFAULT_PACKET_DAYS).toBeLessThanOrEqual(MAX_PACKET_DAYS);
    expect(NOTE_MAX).toBe(1000);
  });
});
