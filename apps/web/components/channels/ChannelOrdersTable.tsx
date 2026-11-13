import { StatusPill } from "@/components/ui/Chips";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { ORDER_STATE_LABEL, type ChannelOrderView } from "@/lib/channels/view";

/** The order lines a channel sent (decision 0155): what each became, and why when it was refused. */

const TONE = { received: "info", submitted: "ok", refused: "bad" } as const;

const when = (iso: string): string => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function ChannelOrdersTable({ orders, caption }: Readonly<{ orders: readonly ChannelOrderView[]; caption: string }>) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-title text-text">{caption}</h3>
      {orders.length === 0 ? (
        <p className="text-body text-muted">No orders yet. They appear here, and in Orders, as soon as they arrive.</p>
      ) : (
        <Table caption={caption}>
          <thead>
            <tr>
              <Th>Received (UTC)</Th>
              <Th>Order</Th>
              <Th>Product</Th>
              <Th>Size</Th>
              <Th numeric>Pieces</Th>
              <Th>State</Th>
              <Th>Tracking</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>{when(order.receivedAt)}</Td>
                <Td>{order.orderName}</Td>
                <Td>{order.productName}</Td>
                <Td>{order.sizeLabel}</Td>
                <Td numeric>{order.pieces}</Td>
                <Td>
                  <StatusPill tone={TONE[order.state]}>{ORDER_STATE_LABEL[order.state]}</StatusPill>
                  {order.message ? <span className="block text-small text-muted">{order.message}</span> : null}
                </Td>
                <Td>{order.trackingSyncedAt ? "Sent to the shop" : order.channel === "shopify" && order.state === "submitted" ? "Not shipped yet" : "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
