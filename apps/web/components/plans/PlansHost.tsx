"use client";

import { useSyncExternalStore } from "react";
import { plansStore } from "@/lib/plans/modal-store";
import { PlansModal } from "./PlansModal";

/**
 * The one plans modal of the app, mounted by the shell (decision 0144). Whatever opens the store —
 * Upgrade, a ♛ gate, Settings — opens this. Each opening draws a fresh modal (`key`), so the billing
 * period and the "checkout is coming" note start over.
 */
export function PlansHost() {
  const request = useSyncExternalStore(plansStore.subscribe, plansStore.current, () => null);
  if (!request) return null;
  return <PlansModal key={request.serial} open onClose={plansStore.close} kind={request.kind} asked={request.plan} />;
}
