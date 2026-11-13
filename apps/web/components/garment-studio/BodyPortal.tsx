"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noSubscription = () => () => undefined;

/**
 * Draws a modal into the body (decision 0150). The page's entry animation leaves a transform on the
 * content, which would otherwise make a modal's fixed frame the content's box rather than the window
 * (the product configurator found it first). Nothing is drawn on the server.
 */
export function BodyPortal({ children }: Readonly<{ children: ReactNode }>) {
  const body = useSyncExternalStore(
    noSubscription,
    () => document.body,
    () => null,
  );
  return body ? createPortal(children, body) : null;
}
