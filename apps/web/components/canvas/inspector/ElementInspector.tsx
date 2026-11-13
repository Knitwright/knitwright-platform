"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import type { ElementView } from "@/lib/inspector/types";
import { ColourRow, Row, Section } from "./parts";

/**
 * THE ELEMENT INSPECTORS (plan v6 E3, decision 0147; `08` §5.3 "Text", "Image / element", "Panel layer
 * on a garment"; e22 text, e23 image, e25 illustration). One layer of a garment, as the artwork stack
 * holds it: its style, colours, size, **placement in mm from the panel anchor** and **print type**
 * (sublimation unless the layer says otherwise), then its layer opacity and blend.
 *
 * The values are the stack's own and are shown, not changed, here: a layer is moved and restyled on
 * the panel, in Panel layers or the full editor, which own the rules for where artwork may go. Both
 * are one press away below.
 */

const TITLES = { text: "Text", image: "Image", illustration: "Illustration", "player-mark": "Name and number" } as const;

const mm = (value: number | null): string => (value === null ? "Not set" : `${value} mm`);

export function ElementInspector({ element, designId, editorHref, onBack }: Readonly<{ element: ElementView | null; designId: string; editorHref: string; onBack: () => void }>) {
  const back = (
    <div className="border-b border-border p-4">
      <Button variant="ghost" size="sm" icon={<Icon icon={ArrowLeft} size={16} />} onClick={onBack} data-testid="element-back">
        Back to the garment
      </Button>
    </div>
  );
  if (element === null) {
    return (
      <div className="flex flex-col">
        {back}
        <div className="p-4">
          <Notice tone="warn">This layer is no longer on the garment. It may have been removed in another tab.</Notice>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col" data-testid={`element-inspector-${element.kind}`}>
      {back}
      <Section title={TITLES[element.kind]}>
        <p className="truncate text-body-lg font-semibold text-text" title={element.name}>
          {element.name}
        </p>
        <Row label="On">{element.views}</Row>
      </Section>

      {element.kind === "text" || element.kind === "player-mark" ? (
        <Section title="Text style">
          {element.text !== null ? <Row label="Text">{element.text}</Row> : null}
          <Row label="Lettering">{element.lettering ?? "Choose later"}</Row>
          <Row label="Height">{mm(element.heightMm)}</Row>
        </Section>
      ) : null}

      {element.colours.length > 0 ? (
        <Section title={element.kind === "text" || element.kind === "player-mark" ? "Text colours" : "Selection colours"}>
          {element.colours.map((row) => (
            <ColourRow key={row.id} row={row} />
          ))}
        </Section>
      ) : null}

      {element.kind !== "player-mark" ? (
        <Section title="Transform">
          <div className="grid grid-cols-2 gap-2">
            <Row label="W">{mm(element.widthMm)}</Row>
            <Row label="H">{mm(element.heightMm)}</Row>
          </div>
          {element.rotationDeg !== null ? <Row label="Rotation">{`${element.rotationDeg}°`}</Row> : null}
        </Section>
      ) : null}

      <Section title="Placement" testId="element-placement">
        <Row label="From">{element.placement ?? "The whole panel"}</Row>
        {element.offset ? <Row label="Offset">{`${element.offset.x} mm across · ${element.offset.y} mm down`}</Row> : null}
        <Row label="Print type">{element.printType}</Row>
      </Section>

      <Section title="Layer">
        <Row label="Opacity">{`${element.opacity}%`}</Row>
        <Row label="Blending mode">{element.blend}</Row>
      </Section>

      <Section title="Edit">
        <p className="text-small text-muted">Move, resize and restyle this layer on its panel, where the print rules check where it may go.</p>
        <LinkButton variant="secondary" href={`/studio/${designId}/layers` as Route}>
          Open in Panel layers
        </LinkButton>
        <LinkButton variant="secondary" href={editorHref as Route}>
          Open full editor
        </LinkButton>
      </Section>
    </div>
  );
}
