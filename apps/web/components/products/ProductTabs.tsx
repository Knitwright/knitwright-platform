"use client";

import { useState } from "react";
import { WhyLink } from "@/components/rulebook/WhyLink";
import { Segmented, Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import type { Decoration } from "@/lib/products/detail";
import { UNITS, type GuideUnit, type SizeGuide } from "@/lib/products/size-guide";

/** The two interactive parts of the product page that need no server: the decoration tabs and the size guide. */

/** Sublimation · Embroidery · Screen print · Heat transfer; each one changes the line under it (08 v3.5). */
export function DecorationTabs({ methods }: Readonly<{ methods: readonly Decoration[] }>) {
  const [value, setValue] = useState(methods[0]?.method ?? "");
  const chosen = methods.find((method) => method.method === value) ?? methods[0];
  if (!chosen) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-small font-semibold text-text">Decoration method</h2>
      <Tabs
        variant="pill"
        label="Decoration method"
        idBase="decoration"
        value={chosen.method}
        onChange={setValue}
        items={methods.map((method) => ({ id: method.method, label: method.method }))}
        className="flex-wrap rounded-md border border-border p-1"
      />
      <p {...tabPanelProps("decoration", chosen.method)} className={chosen.offered ? "text-small text-muted" : "text-small text-warn"}>
        {chosen.line}
      </p>
    </div>
  );
}

/** The size guide with its cm / in switch. Both units are worked out on the server; the switch only picks one. */
export function SizeGuideTable({ guides, sampleSize }: Readonly<{ guides: Readonly<Record<GuideUnit, SizeGuide>>; sampleSize: string | null }>) {
  const [unit, setUnit] = useState<GuideUnit>("cm");
  const guide = guides[unit];
  if (guide.empty) return <p className="text-body text-muted">{guide.empty}</p>;
  return (
    <div className="flex flex-col gap-4">
      <Segmented label="Units" value={unit} onChange={(id) => setUnit(id as GuideUnit)} options={UNITS.map((id) => ({ id, label: id }))} className="w-fit" />
      {sampleSize ? <p className="text-small text-muted">{`The sample size is ${sampleSize}. Finished garment measurements, in ${unit}.`}</p> : null}
      <Table caption={`Size guide in ${unit}`}>
        <thead>
          <tr>
            <Th>Measurement</Th>
            {guide.sizes.map((size) => (
              <Th key={size} numeric highlight={size === sampleSize}>
                {size}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guide.rows.map((row) => (
            <Tr key={row.label}>
              <Td>
                <span className="flex items-center gap-2">
                  {row.label} <WhyLink ruleId={row.ruleId} context="size guide" />
                </span>
              </Td>
              {row.cells.map((cell, index) => (
                <Td key={guide.sizes[index]} numeric highlight={guide.sizes[index] === sampleSize}>
                  {cell ?? "—"}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
