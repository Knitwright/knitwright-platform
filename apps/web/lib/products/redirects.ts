/**
 * The pages the Products area replaced (plan v6 P4, decision 0142), each answering 308 to its new address so a
 * saved link, a bookmark or an old e-mail still lands. Query strings pass through unchanged, so `?market=au` and the
 * catalogue's filters keep working.
 *
 * The old catalogue had a Templates tab (`/catalogue?tab=templates`); templates have their own page now, so that
 * address goes there, and it is listed first because the first matching rule wins.
 */
export interface Moved {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
  readonly has?: readonly Readonly<{ type: "query"; key: string; value: string }>[];
}

export const PRODUCTS_MOVED: readonly Moved[] = [
  { source: "/catalogue", has: [{ type: "query", key: "tab", value: "templates" }], destination: "/templates", permanent: true },
  { source: "/catalogue", destination: "/products", permanent: true },
  { source: "/catalogue/:code", destination: "/products/:code", permanent: true },
  { source: "/brands/fabrics", destination: "/products/fabrics", permanent: true },
];
