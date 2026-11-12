import type { PlanId } from "./catalogue";

/**
 * Whether the plans modal is open, apart from React so any button can open it: the top bar's
 * Upgrade, every ♛ PremiumGate, Settings' Plan & billing, and later Garment Studio's Export ♛
 * (decision 0144). One modal is mounted by the shell and listens here.
 *
 * `kind` picks the modal: "plans" is Choose Your Plan (e42), "techpack" is Upgrade to export tech
 * packs (s19). `plan` is the plan the gate named, which the modal marks.
 */

export type PlansKind = "plans" | "techpack";

export type PlansRequest = Readonly<{ kind: PlansKind; plan: PlanId | null }>;

/** An open modal: the request and which opening it is, so each opening starts fresh. */
export type OpenPlans = PlansRequest & Readonly<{ serial: number }>;

export type PlansStore = Readonly<{
  open: (request?: Partial<PlansRequest>) => void;
  close: () => void;
  current: () => OpenPlans | null;
  subscribe: (listener: () => void) => () => void;
}>;

export function createPlansStore(): PlansStore {
  let request: OpenPlans | null = null;
  let serial = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    open: (input = {}) => {
      serial += 1;
      request = { kind: input.kind ?? "plans", plan: input.plan ?? null, serial };
      emit();
    },
    close: () => {
      if (request === null) return;
      request = null;
      emit();
    },
    current: () => request,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The one store the app uses. */
export const plansStore = createPlansStore();

/** Opens the plans modal. Safe to call from any client component. */
export const openPlans = (request?: Partial<PlansRequest>): void => plansStore.open(request);

/** The plan a gate's label names ("Studio Pro"), or null when it names none. */
export const planIdFromName = (name: string): PlanId | null => {
  const key = name.trim().toLowerCase();
  if (key === "starter") return "starter";
  if (key === "studio pro") return "studio_pro";
  if (key === "club & scale" || key === "club and scale") return "club_scale";
  if (key === "free") return "free";
  return null;
};
