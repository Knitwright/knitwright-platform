import { Download, Plus, Trash2 } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { KwCoin } from "@/components/ui/Marks";
import { Row, Section } from "../frame";

const VARIANTS: readonly [ButtonVariant, string][] = [
  ["primary", "Order samples"],
  ["secondary", "Share"],
  ["premium", "Upgrade"],
  ["ghost", "Duplicate"],
  ["danger", "Delete"],
  ["link", "Why?"],
];

const SIZES: readonly ButtonSize[] = ["lg", "md", "sm", "xs"];

function Variants() {
  return (
    <Row label="Variants, default (hover and press them; Tab for the focus ring)">
      {VARIANTS.map(([variant, label]) => (
        <Button key={variant} variant={variant}>
          {label}
        </Button>
      ))}
    </Row>
  );
}

function Sizes() {
  return (
    <>
      {SIZES.map((size) => (
        <Row key={size} label={`Size ${size}`}>
          <Button size={size} icon={<Icon icon={Plus} size={size === "xs" ? 16 : 20} />}>
            Create
          </Button>
          <Button size={size} variant="secondary">
            Export
          </Button>
          <Button size={size} variant="premium" icon={<KwCoin />}>
            Buy credits
          </Button>
          <Button size={size} variant="ghost" iconOnly aria-label="Download" icon={<Icon icon={Download} size={size === "xs" ? 16 : 20} />} />
        </Row>
      ))}
    </>
  );
}

function States() {
  return (
    <>
      <Row label="Loading: the spinner takes the icon's place and the width stays">
        <Button loading icon={<Icon icon={Plus} />}>
          Order 25 shirts · £625
        </Button>
        <Button variant="secondary" loading>
          Saving
        </Button>
      </Row>
      <Row label="Disabled, with a tooltip saying why (hover or Tab to it)">
        <Button disabledReason="Fix the 2 failing checks first">Order samples</Button>
        <Button variant="secondary" disabledReason="Only the owner can export">
          Export
        </Button>
        <Button variant="danger" icon={<Icon icon={Trash2} />} disabledReason="An ordered design cannot be deleted">
          Delete
        </Button>
      </Row>
      <Row label="Disabled, plain">
        <Button disabled>Order samples</Button>
        <Button variant="secondary" disabled>
          Share
        </Button>
      </Row>
    </>
  );
}

export function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons">
      <Variants />
      <Sizes />
      <States />
    </Section>
  );
}
