import type { ShipTo } from "./shopify/admin";
import { readSku } from "./sku";

/**
 * API OR CSV (plan v6 C4, decision 0155; screen 24 "Push orders by API or upload a spreadsheet").
 *
 * - Export: the brand's products (one row per product and size, with the SKU a shop or club system sends back)
 *   and its channel orders, as RFC 4180 CSV. A cell that a spreadsheet would run as a formula is written as text.
 * - Import: orders as rows of `order_ref, sku, quantity` and the ship-to columns, checked whole before any is
 *   taken in; a file with any bad row is refused with every row's problem, so nothing half-arrives. `fabric` is
 *   optional: without it a product is made in the fabric it was listed in, or the factory's first.
 */

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_BYTES = 256 * 1024;

export const IMPORT_COLUMNS = ["order_ref", "sku", "quantity", "fabric", "ship_name", "ship_address1", "ship_address2", "ship_city", "ship_region", "ship_postcode", "ship_country", "ship_phone"] as const;

const FORMULA = /^[=+\-@\t\r]/;

const cell = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const toCsv = (header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string =>
  [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((one) => one.some((value) => value.trim() !== ""));
}

export type ImportedLine = Readonly<{ orderRef: string; lineNo: number; productId: string; size: string; quantity: number; fabric: string | null; shipTo: ShipTo | null }>;

export type ImportResult = Readonly<{ ok: true; lines: readonly ImportedLine[] }> | Readonly<{ ok: false; problems: readonly string[] }>;

const shipToOf = (get: (name: string) => string): ShipTo | null => {
  const shipTo = {
    name: get("ship_name").slice(0, 120),
    address1: get("ship_address1").slice(0, 200),
    address2: get("ship_address2").slice(0, 200),
    city: get("ship_city").slice(0, 100),
    region: get("ship_region").slice(0, 100),
    postcode: get("ship_postcode").slice(0, 20),
    country: get("ship_country").toUpperCase().slice(0, 2),
    phone: get("ship_phone").slice(0, 40),
  };
  return Object.values(shipTo).some((value) => value !== "") ? shipTo : null;
};

/** Reads an orders file. Every row is checked; any problem refuses the whole file. */
export function readOrdersCsv(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, problems: ["The file is larger than 256 KB."] };
  const [header, ...rows] = parseCsv(text);
  if (!header) return { ok: false, problems: ["The file is empty."] };
  const names = header.map((name) => name.trim().toLowerCase());
  const missing = ["order_ref", "sku", "quantity"].filter((name) => !names.includes(name));
  if (missing.length > 0) return { ok: false, problems: [`The first row must name the columns; missing: ${missing.join(", ")}.`] };
  if (rows.length === 0) return { ok: false, problems: ["The file has no orders."] };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, problems: [`At most ${MAX_IMPORT_ROWS} rows at a time.`] };

  const problems: string[] = [];
  const lines: ImportedLine[] = [];
  const perOrder = new Map<string, number>();
  rows.forEach((row, index) => {
    const get = (name: string): string => (row[names.indexOf(name)] ?? "").trim();
    const at = `Row ${index + 2}`;
    const orderRef = get("order_ref");
    const sku = readSku(get("sku"));
    const quantity = Number(get("quantity"));
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(orderRef)) problems.push(`${at}: order_ref must be 1 to 30 letters, digits, - or _.`);
    if (sku === null) problems.push(`${at}: the SKU is not one of your Knitwright products (export the product list for the SKUs).`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) problems.push(`${at}: quantity must be a whole number from 1 to 9999.`);
    if (problems.length > 0 || sku === null) return;
    const lineNo = (perOrder.get(orderRef) ?? 0) + 1;
    perOrder.set(orderRef, lineNo);
    lines.push({ orderRef, lineNo, productId: sku.productId, size: sku.size, quantity, fabric: get("fabric").slice(0, 120) || null, shipTo: shipToOf(get) });
  });
  return problems.length > 0 ? { ok: false, problems: problems.slice(0, 20) } : { ok: true, lines };
}

/** The template a brand fills in. */
export const importTemplate = (exampleSku: string): string =>
  toCsv(IMPORT_COLUMNS, [["1001", exampleSku, 2, "", "Sam Player", "1 High Street", "", "Leeds", "", "LS1 1AA", "GB", ""]]);
