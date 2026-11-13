/**
 * The collection plans moved from the studio to Orders (plan v6 P5, decision 0143). Unlike the shell's
 * temporary aliases (decision 0138), these addresses are not coming back, so the redirects are
 * permanent (308) and keep the rest of the address, `?view=` included.
 */
export interface MovedRoute {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
}

export const MOVED_TO_ORDERS: readonly MovedRoute[] = [
  { source: "/studio/collections", destination: "/orders/plans", permanent: true },
  { source: "/studio/collections/:collectionId", destination: "/orders/plan/:collectionId", permanent: true },
  { source: "/studio/collections/:collectionId/delete", destination: "/orders/plan/:collectionId/delete", permanent: true },
];
