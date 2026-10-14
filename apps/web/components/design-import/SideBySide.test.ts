import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { createBudget } from "@/lib/design-import/budget";
import { SYNTHETIC_TEMPLATE } from "@/lib/design-import/fixtures/template";
import { MARKS_REPLY, asText } from "@/lib/design-import/fixtures/replies";
import { renderTee } from "@/lib/design-import/fixtures/synthetic";
import { fakeDb } from "@/lib/design-import/fixtures/fake-db";
import { pendingPatternStage } from "@/lib/design-import/pattern";
import { runImport } from "@/lib/design-import/pipeline";
import { FORBIDDEN_WORDS } from "@/lib/design-import/report";
import { createImport, getImport } from "@/lib/design-import/service";
import { analysisView } from "@/lib/design-import/view-model";
import { createStubProvider } from "@/lib/providers/stub";
import { LayerList } from "./LayerList";
import { Limits } from "./Limits";
import { SideBySide } from "./SideBySide";

async function viewOf() {
  const out = await runImport(
    { bytes: (await renderTee({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' })).png, mediaType: "image/png" },
    { provider: createStubProvider([asText(MARKS_REPLY)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: true },
  );
  if (!out.ok) throw new Error(out.reason);
  const db = fakeDb();
  const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
  const id = await createImport(db.client, who, { sourceFileId: "55555555-5555-4555-8555-555555555555", rightsAcceptedAt: new Date(), outcome: out, costMicrodollars: 0 });
  return analysisView(await getImport(db.client, who.brandId, id));
}

const noop = () => undefined;

describe("the side-by-side screen", () => {
  it("shows the picture, our drawing, the confidence of every layer and the limits (f)", async () => {
    const view = await viewOf();
    const html = renderToStaticMarkup(createElement(SideBySide, { view, ticked: new Set(view.rows.map((r) => r.id)), moved: {}, busy: false, onTick: noop, onMove: noop }));
    expect(html).toContain("A close reading of your picture");
    expect(html).toContain('data-testid="design-import-picture"');
    expect(html).toContain('data-testid="design-import-drawing"');
    for (const row of view.rows) expect(html).toContain(`data-testid="confidence-${row.id}"`);
    expect(html).toMatch(/How sure we are: (high|medium|low) \(\d+%\)/);
    expect(html).toContain("Logos are redrawn, not extracted");
    expect(html).toContain("is not in your picture");
    expect(html).toContain("Replace with your own file");
    expect(html).toContain("/api/files/55555555-5555-4555-8555-555555555555");
    expect(html).toContain("benchmark tee pattern");
  });

  it("never says exact, identical or matches your picture", async () => {
    const view = await viewOf();
    const html = renderToStaticMarkup(createElement(SideBySide, { view, ticked: new Set<string>(), moved: { front: { hps: { x: 0.5, y: 0.5 } } }, busy: true, onTick: noop, onMove: noop }));
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(FORBIDDEN_WORDS);
    expect(html).toContain('disabled=""');
  });

  it("lists the layers with their boxes ticked as given, and the limits on their own", async () => {
    const view = await viewOf();
    const list = renderToStaticMarkup(createElement(LayerList, { rows: view.rows, ticked: new Set([view.rows[0].id]), disabled: false, onTick: noop }));
    expect(list.match(/checked=""/g)).toHaveLength(1);
    const limits = renderToStaticMarkup(createElement(Limits, { limits: ["One.", "Two."] }));
    expect(limits).toContain("<li>One.</li>");
  });
});
