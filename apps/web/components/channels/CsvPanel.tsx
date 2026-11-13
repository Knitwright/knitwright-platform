"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { importOrdersCsvAction } from "@/lib/channels/actions";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/lib/channels/csv";
import type { ChannelOrderView } from "@/lib/channels/view";
import { ChannelOrdersTable } from "./ChannelOrdersTable";

/**
 * API or CSV (screen 24; decision 0155). Export the products (with the SKU each size is ordered by) and the channel
 * orders; import orders from a spreadsheet. A file with any bad row is refused whole, with each row's problem.
 * There is no push API yet: the panel says so, and the API page lists what exists.
 */

const LINK = "font-semibold text-link underline-offset-2 hover:underline";

export function CsvPanel({ orders, canList }: Readonly<{ orders: readonly ChannelOrderView[]; canList: boolean }>) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [said, setSaid] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const [pending, start] = useTransition();

  const upload = () => {
    if (!file) return;
    setSaid(null);
    start(async () => {
      if (file.size > MAX_IMPORT_BYTES) return setSaid({ tone: "warn", text: "The file is larger than 256 KB." });
      const reply = await importOrdersCsvAction({ csv: await file.text() }).catch(() => null);
      if (!reply) return setSaid({ tone: "warn", text: "The file could not reach the server. Check your connection and try again." });
      if (!reply.success) return setSaid({ tone: "warn", text: reply.error.message });
      const result = reply.data;
      setSaid({ tone: result.refused > 0 ? "warn" : "ok", text: result.received === 0 ? "Those orders were already imported." : `${result.submitted} lines sent to production, ${result.refused} refused. ${result.messages.join(" ")}`.trim() });
      router.refresh();
    });
  };

  return (
    <section id="api-csv" aria-labelledby="api-csv-title" className="flex scroll-mt-24 flex-col gap-5 rounded-xl border border-border p-5">
      <header>
        <h2 id="api-csv-title" className="text-h3 text-text">API or CSV</h2>
        <p className="text-small text-muted">For custom shops and club systems. A push API comes later; today, spreadsheets in and out.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-title text-text">Export</h3>
          <ul className="flex flex-col gap-1.5 text-body">
            <li><a className={LINK} href="/api/channels/export/products" download>Products and SKUs (CSV)</a></li>
            <li><a className={LINK} href="/api/channels/export/orders" download>Channel orders (CSV)</a></li>
            <li><a className={LINK} href="/api/channels/import-template" download>Orders template (CSV)</a></li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-title text-text">Import orders</h3>
          <p className="text-small text-muted">Columns order_ref, sku and quantity; fabric where the product is not listed yet; and the ship_ address columns of the template. Up to {MAX_IMPORT_ROWS} rows; each product must be ready to sell.</p>
          <label className="text-small font-medium text-text" htmlFor="orders-csv">Orders file</label>
          <input id="orders-csv" type="file" accept=".csv,text/csv" disabled={!canList} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-small text-text-2 file:mr-3 file:h-8 file:rounded-sm file:border file:border-border file:bg-bg file:px-3 file:font-semibold" />
          <div>
            <Button size="sm" pending={pending} disabled={file === null} disabledReason={canList ? undefined : "Only owners, admins and kit managers import orders."} onClick={upload}>
              Import orders
            </Button>
          </div>
        </div>
      </div>
      {said ? <Notice tone={said.tone} role={said.tone === "warn" ? "alert" : "status"}>{said.text}</Notice> : null}
      <ChannelOrdersTable orders={orders.filter((order) => order.channel === "csv")} caption="Orders from CSV" />
    </section>
  );
}
