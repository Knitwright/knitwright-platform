"use client";

import { useParams } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Which design the Make it panels are about. On the old `/studio/<id>` page that was the address's
 * own `projectId`; on the one canvas (decision 0145) the address names the canvas, so the editor
 * says which design it holds. A page with neither -- a fixture -- gives null.
 */
const DesignIdContext = createContext<string | null>(null);

export function DesignIdProvider({ projectId, children }: Readonly<{ projectId: string; children: ReactNode }>) {
  return <DesignIdContext.Provider value={projectId}>{children}</DesignIdContext.Provider>;
}

export function useDesignId(): string | null {
  const given = useContext(DesignIdContext);
  const params = useParams<{ projectId?: string | string[] }>();
  if (given !== null) return given;
  const value = params?.projectId;
  return typeof value === "string" ? value : null;
}
