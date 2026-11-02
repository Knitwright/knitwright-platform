import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { listExportTargets, listMarketingTemplates, listWatermarkRules } from "./service";
import { buildMarketingTemplates, marketingRowOf } from "./templates/build";

/** A read that answers with the rows given, and keeps what it was filtered on. */
function readClient(rows: unknown[], error: { message: string } | null = null) {
  const filters: { column: string; value: unknown }[] = [];
  const query = {
    select: () => query,
    order: () => query,
    eq: (column: string, value: unknown) => (filters.push({ column, value }), query),
    limit: async () => ({ data: rows, error }),
  };
  return { client: { from: () => query } as unknown as SupabaseClient, filters };
}

const targetRow = {
  key: "png-1x",
  label: "PNG 1x",
  lead: "The artboard at its own size, for a screen.",
  file_format: "png",
  colour_space: "rgb",
  dpi: 72,
  scale: "1.0",
  quick: true,
  sort: 10,
  rule_id: "R-GAP-000",
  note: "not reviewed by anyone",
};

const ruleRow = { plan: "free", label: "Free plan", watermarked: true, max_dpi: 72, rule_id: "R-GAP-000", note: "the spec's sentence" };

const template = buildMarketingTemplates()[0]!;
const templateRow = { id: "11111111-1111-4111-8111-111111111111", ...marketingRowOf(template) };

describe("reading the export targets", () => {
  it("turns a row into what the panel offers, with the numeric scale read as a number", async () => {
    const [target] = await listExportTargets(readClient([targetRow]).client);
    expect(target).toEqual({
      key: "png-1x",
      label: "PNG 1x",
      lead: "The artboard at its own size, for a screen.",
      format: "png",
      colourSpace: "rgb",
      dpi: 72,
      scale: 1,
      quick: true,
      sort: 10,
      ruleId: "R-GAP-000",
      note: "not reviewed by anyone",
    });
  });

  it("reports a failed read and a row it cannot read, rather than showing half a panel", async () => {
    await expect(listExportTargets(readClient([], { message: "boom" }).client)).rejects.toBeInstanceOf(AppError);
    await expect(listExportTargets(readClient([{ ...targetRow, dpi: 0 }]).client)).rejects.toBeInstanceOf(AppError);
    await expect(listExportTargets(readClient([{ ...targetRow, file_format: "tiff" }]).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("reading the watermark rules", () => {
  it("turns a row into the rule the panel shows", async () => {
    const [rule] = await listWatermarkRules(readClient([ruleRow]).client);
    expect(rule).toEqual({ plan: "free", label: "Free plan", watermarked: true, maxDpi: 72, ruleId: "R-GAP-000", note: "the spec's sentence" });
  });

  it("reports a failed read and a rule it cannot read", async () => {
    await expect(listWatermarkRules(readClient([], { message: "boom" }).client)).rejects.toBeInstanceOf(AppError);
    await expect(listWatermarkRules(readClient([{ ...ruleRow, plan: "enterprise" }]).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("reading the marketing templates", () => {
  it("asks for the marketing rows only", async () => {
    const { client, filters } = readClient([templateRow]);
    await listMarketingTemplates(client);
    expect(filters).toEqual([{ column: "kind", value: "marketing" }]);
  });

  it("turns a row into the layout the panel draws", async () => {
    const [view] = await listMarketingTemplates(readClient([templateRow]).client);
    expect(view).toMatchObject({ slug: template.slug, title: template.title, group: template.group, format: template.format, layoutKey: template.layoutKey });
    expect(view!.slots).toHaveLength(template.slots.length);
    expect(view!.label).toContain("not reviewed by anyone");
  });

  it("reads every one of the 50 rows the seed writes", async () => {
    const rows = buildMarketingTemplates().map((one, n) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, ...marketingRowOf(one) }));
    expect(await listMarketingTemplates(readClient(rows).client)).toHaveLength(50);
  });

  it("leaves out one row it cannot read and shows the rest, so one bad row does not empty the panel", async () => {
    const broken = { ...templateRow, snapshot: { ...templateRow.snapshot, slots: [] } };
    const views = await listMarketingTemplates(readClient([broken, { ...templateRow, slug: "other" }]).client);
    expect(views.map((one) => one.slug)).toEqual(["other"]);
  });

  it("reports a failed read", async () => {
    await expect(listMarketingTemplates(readClient([], { message: "boom" }).client)).rejects.toBeInstanceOf(AppError);
  });
});
