import type { FormValues } from "./slots";

/**
 * The Simulate button and its status chip (spec F-S4: "Simulated", "Not sim ready"). The 3D model
 * is built from the drafted pattern, so a change to the form leaves the model behind until it is
 * built again. The chip says which of those is true, and never says "Simulated" about a model
 * that no longer matches the design.
 */

export type SimulationState = "none" | "ready" | "stale";

export interface SimulateChip {
  readonly label: string;
  readonly state: SimulationState;
  /** Whether pressing Simulate would do anything. */
  readonly canSimulate: boolean;
}

/** Whether two forms are the same choice of options and lengths. */
export function sameForm(a: FormValues, b: FormValues): boolean {
  const same = (x: Readonly<Record<string, string | number>>, y: Readonly<Record<string, string | number>>): boolean => {
    const keys = Object.keys(x);
    return keys.length === Object.keys(y).length && keys.every((key) => x[key] === y[key]);
  };
  return same(a.options, b.options) && same(a.parameters, b.parameters);
}

/**
 * Where the 3D view stands: nothing built yet, the model matches the form, or the form has moved
 * on since it was built. `simulated` is the form the shown model was built from, or null.
 */
export function simulationState(form: FormValues, simulated: FormValues | null, hasModel: boolean): SimulationState {
  if (!hasModel) return "none";
  if (!simulated || !sameForm(form, simulated)) return "stale";
  return "ready";
}

const CHIPS: Readonly<Record<SimulationState, SimulateChip>> = {
  none: { label: "Not sim ready", state: "none", canSimulate: false },
  ready: { label: "Simulated", state: "ready", canSimulate: false },
  stale: { label: "Not sim ready", state: "stale", canSimulate: true },
};

export const simulateChip = (state: SimulationState): SimulateChip => CHIPS[state];
