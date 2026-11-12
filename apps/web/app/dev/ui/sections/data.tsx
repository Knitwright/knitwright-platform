"use client";

import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Chips";
import { InfoCard, PanelSection, ProductCard, ProjectCard, ThumbCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonPage, SkeletonPanel, SkeletonText } from "@/components/ui/Skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { Placeholder, Row, Section } from "../frame";

const SIZES = ["S", "M", "L", "XL"] as const;
const POINTS = [
  { point: "A", name: "Chest width", values: [500, 520, 540, 560], locked: false },
  { point: "B", name: "Body length", values: [700, 720, 740, 760], locked: true },
] as const;

function Cards() {
  return (
    <>
      <Row label="Template thumbnails (hover or Tab: Use and ♡), project and product cards">
        <ThumbCard name="Hoops jersey" thumb={<Placeholder label="116 × 136" />} />
        <ThumbCard name="Sash training top with a long name" thumb={<Placeholder label="116 × 136" />} />
        <div className="w-60">
          <ProjectCard
            title="Lahore Lions · Home kit launch"
            meta="Edited 2 h ago"
            count={8}
            thumb={<Placeholder label="4:3" />}
            menu={<Button size="sm" variant="secondary" iconOnly aria-label="Project actions" icon={<Icon icon={Ellipsis} size={16} />} />}
          />
        </div>
        <div className="w-48">
          <ProductCard name="Short-sleeve jersey" price="From £22" proPrice="£18 Studio Pro" thumb={<Placeholder label="1:1" />} chips={<Tag tone="ok">Kit-safe</Tag>} />
        </div>
      </Row>
      <Row label="Info card and panel section">
        <InfoCard title="Sample order" meta="Arrives 18 Nov" className="w-96">
          <p className="text-body text-text-2">3 pieces · £117 · Sialkot</p>
        </InfoCard>
        <PanelSection title="My products" action={<Button variant="link">Show all</Button>} className="w-80">
          <p className="text-small text-text-2">Home kit v7 · Away kit v2</p>
        </PanelSection>
      </Row>
    </>
  );
}

function MeasurementTable() {
  return (
    <Row label="Table: numbers right-aligned, the sample size highlighted, a locked row">
      <Table caption="Measurements in millimetres" className="max-w-180">
        <thead>
          <tr>
            <Th>Point</Th>
            <Th>Measurement</Th>
            {SIZES.map((size) => (
              <Th key={size} numeric highlight={size === "M"}>
                {size}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POINTS.map((row) => (
            <Tr key={row.point}>
              <Td className="font-semibold text-mark-measure">{row.point}</Td>
              <Td>{row.name}</Td>
              {row.values.map((value, index) => (
                <Td key={SIZES[index]} numeric highlight={SIZES[index] === "M"} lockedReason={row.locked ? "Set by Knitwright QC after the golden sample" : undefined}>
                  {value}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </Row>
  );
}

function Loading() {
  return (
    <Row label="Loading: skeletons shaped like the page, after 300 ms">
      <SkeletonPage label="Loading the examples" className="grid w-full gap-4 sm:grid-cols-3">
        <SkeletonPanel />
        <div className="flex flex-col gap-2">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <SkeletonText lines={4} />
      </SkeletonPage>
    </Row>
  );
}

export function DataSection() {
  return (
    <Section id="data" title="Cards, tables, loading">
      <Cards />
      <MeasurementTable />
      <Loading />
    </Section>
  );
}
