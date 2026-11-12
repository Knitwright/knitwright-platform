"use client";

import { useEffect } from "react";
import { openPlans, type PlansKind } from "@/lib/plans/modal-store";

/** Opens the shell's plans modal once, for the fixture's screenshot of e42 or s19. */
export function OpenPlans({ kind }: Readonly<{ kind: PlansKind }>) {
  useEffect(() => openPlans({ kind }), [kind]);
  return null;
}
