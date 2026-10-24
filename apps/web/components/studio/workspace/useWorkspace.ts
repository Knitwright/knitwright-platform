"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { INITIAL_LAYOUT, fieldToFocus, hashTarget, idToScroll, layoutReducer } from "@/lib/workspace/layout";
import { parseTool, withSearchParam, type ToolId } from "@/lib/workspace/tools";
import { REVEAL_FIELD_EVENT, focusField, type RevealFieldDetail } from "../focus-field";

const inAddress = (): ToolId => parseTool(new URLSearchParams(window.location.search).get("tool"));

/**
 * The open tool, read from the address (?tool=), and the rest of the workspace's layout. Choosing
 * a tool rewrites the address in place, so a reload or a shared link opens the same panel and
 * nothing is fetched again. A field that asks for focus from a hidden panel opens that panel first,
 * and so does an older link to a part of the page by its #hash.
 *
 * The open tool is held here and the address follows it. The router reports a rewritten address
 * a render later, so reading the tool back from it would let a quick second key press act on the
 * tool before; the address is read only for a change that did not start here.
 */
export const useWorkspace = () => {
  const params = useSearchParams();
  const fromAddress = parseTool(params.get("tool"));
  const [tool, setTool] = useState<ToolId>(fromAddress);
  // The tool last chosen here that the router has not reported back yet.
  const awaiting = useRef<ToolId | null>(null);
  const [layout, dispatch] = useReducer(layoutReducer, INITIAL_LAYOUT);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chosen = awaiting.current;
    // The router passes through every address written here; while the address still says what was
    // chosen, what it reports is on its way. Any other address came from elsewhere.
    if (chosen !== null && fromAddress !== chosen && inAddress() === chosen) return;
    awaiting.current = null;
    setTool(fromAddress);
  }, [fromAddress]);

  const choose = useCallback((next: ToolId) => {
    awaiting.current = next;
    setTool(next);
    window.history.replaceState(null, "", `${withSearchParam(window.location.search, "tool", next)}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reveal = (event: Event) => {
      const panel = (event.target as HTMLElement).closest<HTMLElement>("[data-tool]");
      const owner = panel?.dataset.tool;
      if (!owner) return;
      const next = parseTool(owner);
      dispatch({ type: "reveal", field: (event as CustomEvent<RevealFieldDetail>).detail.key, tool: next });
      choose(next);
    };
    element.addEventListener(REVEAL_FIELD_EVENT, reveal);
    return () => element.removeEventListener(REVEAL_FIELD_EVENT, reveal);
  }, [choose]);

  // An old link to a part of the page, such as #share-heading: open the panel that holds it.
  useEffect(() => {
    const follow = () => {
      const id = hashTarget(window.location.hash);
      const owner = id ? document.getElementById(id)?.closest<HTMLElement>("[data-tool]")?.dataset.tool : undefined;
      if (!id || !owner) return;
      const next = parseTool(owner);
      dispatch({ type: "revealHash", id, tool: next });
      choose(next);
    };
    // After the router has written its own first entry, which would otherwise undo this one.
    const first = window.setTimeout(follow, 0);
    window.addEventListener("hashchange", follow);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("hashchange", follow);
    };
  }, [choose]);

  const scrollTo = idToScroll(layout, tool);
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ block: "start" });
    dispatch({ type: "scrolled" });
  }, [scrollTo]);

  const waiting = fieldToFocus(layout, tool);
  useEffect(() => {
    if (!waiting) return;
    focusField(waiting);
    dispatch({ type: "focused" });
  }, [waiting]);

  return { tool, choose, layout, dispatch, root };
};

export type Workspace = ReturnType<typeof useWorkspace>;
