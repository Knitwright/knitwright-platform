import { finding } from "./finding";
import type { CheckModule } from "./registry";

/** A test double for a module V7 will register. */
export const doubleModule = (id: string, code = "double-found"): CheckModule => ({
  id,
  run: () => [finding({ code, severity: "warning", message: "Double.", action: "None.", whoActs: "owner" })],
});
