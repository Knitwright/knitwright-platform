import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canvasOfTemplate, PRESETS, withBoard } from "@/lib/flows/fixtures/canvas";
import { STUB_COSTS } from "@/lib/flows/stub";
import type { BoardView, Graph } from "@/lib/launch";
import { BoardActions } from "./BoardActions";

/**
 * What a board's own Flatten, Upscale and Reframe put on the screen (spec F-L4).
 *
 * `lib/flows/operations.test.ts` covers what each operation decides. This covers the panel that
 * says it, because until decision 0127 nothing drew this component at all: the contextual task bar
 * offered the three and handed them to "the board's own panel", and that panel was never mounted.
 */

const render = (graph: Graph, id: string) =>
  renderToStaticMarkup(
    createElement(BoardActions, {
      graph,
      board: graph.boards.find((one) => one.id === id) as BoardView,
      source: STUB_COSTS,
      presets: PRESETS,
      busy: false,
      onOperation: () => undefined,
    }),
  );

describe("a board's own actions", () => {
  it("offer all three, named, whether or not they can be used", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const markup = render(graph, "render-front");

    expect(markup).toContain('aria-label="This board"');
    for (const word of ["Flatten", "Upscale", "Reframe"]) expect(markup, word).toContain(word);
  });

  it("keeps an operation that cannot be used on the screen, with the reason beside it", () => {
    // A board nobody has run yet: all three are refused, and the reason is the one thing to do.
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    expect(render(graph, "render-front")).toContain("Run this board first");
  });

  it("says what each one costs once the board has been run, so nothing is pressed blind", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const ready = withBoard(graph, "render-front", { status: "ready", outputFileId: "33333333-0000-4000-8000-333333333333" });
    const markup = render(ready, "render-front");

    expect(markup).not.toContain("Run this board first");
    // What it costs, in the component's own words: a credit figure, or "free" where the operation
    // costs nothing. Either way it is on the screen before the button is pressed, which is the
    // point -- `STUB_COSTS` decides which, not this file.
    expect(markup).toMatch(/free|credits?/i);
    // And the button is live now, so the panel follows the verdict rather than drawing it greyed out.
    expect(markup).toMatch(/data-testid="flow-op-flatten"/);
    expect(markup).not.toMatch(/disabled=""[^>]*data-testid="flow-op-flatten"/);
  });
});
