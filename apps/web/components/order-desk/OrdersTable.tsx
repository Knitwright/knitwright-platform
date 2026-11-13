import { PackageOpen } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { money, shortDate } from "@/lib/order-desk/format";
import type { CustomerOrder } from "@/lib/order-desk/service";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/order-desk/status";

const KIND_LABELS = { sample: "Sample", run: "Run", order: "Order" } as const;

/** The order's total: the price it came with, or a dash until checkout gives one (C1). */
const totalOf = (order: CustomerOrder): string => (order.value === null ? "—" : money(order.value.minor, order.value.currency));

/**
 * The orders table (09 screen 15, p09): number, date, customer, product, pieces, total, status and the
 * factory's ready date. A row opens the order. Prototype's checkbox column is left out: there is no
 * bulk action for it to drive yet.
 */
export function OrdersTable({ orders, customer }: Readonly<{ orders: readonly CustomerOrder[]; customer: string }>) {
  return (
    <Table caption="Your orders, newest first">
      <thead>
        <tr>
          <Th>Order</Th>
          <Th>Date</Th>
          <Th>Customer</Th>
          <Th>Product</Th>
          <Th numeric>Pieces</Th>
          <Th numeric>Total</Th>
          <Th>Status</Th>
          <Th>Ready by</Th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <Tr key={order.id}>
            <Td className="font-semibold">
              <Link href={`/orders/${order.id}` as Route} className="text-text no-underline live:hover:underline">
                {order.number}
              </Link>
            </Td>
            <Td>{shortDate(order.createdAt)}</Td>
            <Td>{customer}</Td>
            <Td className="max-w-80 truncate" title={order.productName}>
              {KIND_LABELS[order.kind]} · {order.productName}
            </Td>
            <Td numeric>{order.pieces}</Td>
            <Td numeric>{totalOf(order)}</Td>
            <Td>
              <StatusPill tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</StatusPill>
            </Td>
            <Td>{order.readyOn === null ? "—" : shortDate(order.readyOn)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** p10: no order matches, or there is none yet. */
export function NoOrders({ filtered }: Readonly<{ filtered: boolean }>) {
  return (
    <EmptyState
      icon={<Icon icon={PackageOpen} size={22} />}
      title={filtered ? "No orders here yet" : "No orders yet"}
      action={
        <>
          {filtered ? <LinkButton href="/orders" variant="secondary">Show all orders</LinkButton> : null}
          <LinkButton href={"/orders/runs#builder" as Route}>Create order</LinkButton>
        </>
      }
    >
      Samples and runs you place from Product runs or a design&apos;s Make page show up here, with where each one is.
    </EmptyState>
  );
}
