import type { Route } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/ui/Chips";
import { InfoCard } from "@/components/ui/Card";
import { LockMark } from "@/components/ui/Marks";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import type { Delivery } from "@/lib/order-desk/delivery";
import { shortDate, sizesText } from "@/lib/order-desk/format";
import type { CustomerOrder, Parcel } from "@/lib/order-desk/service";
import type { OrderSummary } from "@/lib/order-desk/summary";
import { QcPhotos } from "./QcPhotos";

/** The cards of the order page (screen 33, p11). Each says what is not on file instead of inventing it. */

export function ItemsCard({ order }: Readonly<{ order: CustomerOrder }>) {
  return (
    <InfoCard title="Items" meta={`1 product · ${order.pieces} ${order.pieces === 1 ? "piece" : "pieces"}`}>
      <Table caption="The items of this order">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Sizes</Th>
            <Th numeric>Qty</Th>
          </tr>
        </thead>
        <tbody>
          <Tr>
            <Td>
              <p className="font-semibold text-text">{order.productName}</p>
              <p className="text-small text-muted">
                {order.articleId} · {order.fabricKey}
              </p>
            </Td>
            <Td>{sizesText(order.sizes)}</Td>
            <Td numeric>{order.pieces}</Td>
          </Tr>
        </tbody>
      </Table>
    </InfoCard>
  );
}

export function ShipmentCard({ parcels, delivery }: Readonly<{ parcels: readonly Parcel[]; delivery: Delivery }>) {
  return (
    <InfoCard title="Shipment" meta={parcels.length === 0 ? <StatusPill>Not shipped yet</StatusPill> : <StatusPill tone="ok">Shipped</StatusPill>}>
      {parcels.length === 0 ? (
        <p className="text-body text-text-2">Ships from the factory once QC passes. The courier and the tracking number appear here when the parcel leaves.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-body">
          {parcels.map((parcel) => (
            <li key={`${parcel.courier}-${parcel.trackingNumber}`} className="flex flex-wrap gap-x-3">
              <span className="font-semibold text-text">{parcel.courier}</span>
              {parcel.trackingUrl ? (
                <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-link">
                  {parcel.trackingNumber}
                </a>
              ) : (
                <span>{parcel.trackingNumber}</span>
              )}
              <span className="text-muted">
                {shortDate(parcel.shippedOn)} · {parcel.pieces} pieces
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-small text-muted">{delivery.status === "set" ? `Delivery by ${shortDate(delivery.on)}, from the factory data on file.` : delivery.text}</p>
    </InfoCard>
  );
}

export function PhotosCard({ fileIds }: Readonly<{ fileIds: readonly string[] }>) {
  return (
    <InfoCard title="QC photos" meta="after QC">
      {fileIds.length === 0 ? (
        <p className="text-body text-text-2">No photos yet. Knitwright QC shares photos of the finished pieces here once they pass inspection.</p>
      ) : (
        <QcPhotos fileIds={fileIds} />
      )}
    </InfoCard>
  );
}

export function SummaryCard({ summary }: Readonly<{ summary: OrderSummary }>) {
  return (
    <InfoCard title="Order summary">
      <dl className="flex flex-col gap-2.5 text-body">
        {summary.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-text">{line.label}</dt>
            <dd className={line.credit ? "text-ok" : "text-text-2"}>{line.value}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-4 text-title">
          <dt>Total</dt>
          <dd>{summary.total ?? "Not set"}</dd>
        </div>
      </dl>
      <p className="text-caption text-muted">{summary.note}</p>
    </InfoCard>
  );
}

export function CustomerCard({ customer, order }: Readonly<{ customer: string; order: CustomerOrder }>) {
  const source = { sample: "A sample from Product runs", run: "A run from Product runs", order: "An order sent to production" }[order.kind];
  return (
    <InfoCard title="Customer">
      <div className="flex flex-col gap-1 text-body text-text-2">
        <p className="font-semibold text-text">{customer}</p>
        <p>Source: {source}</p>
        <p>Placed {shortDate(order.createdAt)}</p>
        <p>{order.readyOn === null ? "No ready date yet: the factory's lead time is not set." : `Ready at the factory by ${shortDate(order.readyOn)}`}</p>
      </div>
    </InfoCard>
  );
}

export function DesignCard({ order }: Readonly<{ order: CustomerOrder }>) {
  const version = order.release.number > 0 ? `Release ${order.release.number}` : "The frozen release";
  return (
    <InfoCard title="Design">
      <div className="flex flex-col gap-1.5 text-body text-text-2">
        <p className="flex items-center gap-1.5">
          <LockMark label="Locked" />
          {version}
          {order.release.label ? ` · ${order.release.label}` : ""} (locked: it is what the factory makes)
        </p>
        <Link href={`/studio/${order.projectId}/tech-pack` as Route} className="text-link">
          Open the tech pack
        </Link>
        <Link href={`/studio/${order.projectId}` as Route} className="text-link">
          Open the design
        </Link>
      </div>
    </InfoCard>
  );
}
