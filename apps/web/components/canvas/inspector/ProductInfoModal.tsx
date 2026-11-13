"use client";

import { Download, Eye, FileImage, Scan, Tag, Truck, type LucideIcon } from "lucide-react";
import { Button, buttonClasses, ButtonInner } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { ProductInfo } from "@/lib/inspector/types";

/**
 * THE PRODUCT INFO MODAL (plan v6 E3, decision 0147; `08` v3.5 "Editor", e41): production cost,
 * shipping, print area and file spec as four tiles, the print guidelines, then **Download template**
 * (the design's own front drawing as SVG, free) and **Preview on mockups** (a Mockup board fed by
 * this garment, on the canvas). Every figure is worked out on the server (`lib/inspector/product-info.ts`)
 * and none is a promise the factory has not made.
 */

type Tile = Readonly<{ icon: LucideIcon; title: string; amount: string; note: string; testId: string }>;

export function ProductInfoModal({ open, info, onClose, onPreview }: Readonly<{ open: boolean; info: ProductInfo; onClose: () => void; onPreview: () => void }>) {
  const tiles: readonly Tile[] = [
    { icon: Tag, title: "Production cost", amount: info.cost.amount, note: info.cost.note, testId: "product-info-cost" },
    { icon: Truck, title: "Shipping to UK", amount: info.shipping.amount, note: info.shipping.note, testId: "product-info-shipping" },
    { icon: Scan, title: "Print area", amount: info.printArea.amount, note: info.printArea.note, testId: "product-info-area" },
    { icon: FileImage, title: "File", amount: info.file.amount, note: info.file.note, testId: "product-info-file" },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={info.name}
      size="sm"
      footer={
        <>
          <a href={info.templateHref} download className={buttonClasses("secondary", false, "no-underline")} data-testid="product-info-template">
            <ButtonInner variant="secondary" arrow={false} icon={<Icon icon={Download} size={20} />}>
              Download template
            </ButtonInner>
          </a>
          <Button variant="primary" data-primary icon={<Icon icon={Eye} size={20} />} onClick={onPreview} data-testid="product-info-preview">
            Preview on mockups
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-testid="product-info">
        <p className="text-body text-muted">{info.line}</p>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {tiles.map((tile) => (
            <div key={tile.title} className="flex flex-col gap-1" data-testid={tile.testId}>
              <dt className="flex items-center gap-2 text-micro text-text-2 uppercase">
                <Icon icon={tile.icon} size={16} />
                {tile.title}
              </dt>
              <dd className="m-0 flex flex-col gap-1">
                <span className="text-h3 text-text">{tile.amount}</span>
                <span className="text-small text-muted">{tile.note}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <h3 className="text-body-lg font-semibold text-text">Print guidelines</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-text">
            {info.guidelines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
