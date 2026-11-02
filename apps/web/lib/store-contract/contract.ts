import { storeDrops, type DropRow, type StoreDrops } from "./drops";
import { storeListings, type ListingRow, type StoreListings } from "./listings";
import { envelope, manifest, type Envelope, type Manifest } from "./payload";
import { storeProduct, type ProductInput, type StoreProduct } from "./product";
import { storeTeamStore, type StoreTeamStore, type TeamStoreInput } from "./team-store";

/**
 * The five payloads, each built from rows that have already been read (plan v5 O2).
 *
 * Pure, on purpose: every endpoint is this plus a read. The reads live in `server.ts`, which is the
 * only file here that knows about the database, so every rule in this directory can be run and
 * tested without one.
 */

export type ProductsPayload = Envelope<"store-products", Readonly<{ products: readonly StoreProduct[] }>>;
export type DropsPayload = Envelope<"store-drops", StoreDrops>;
export type ListingsPayload = Envelope<"store-listings", StoreListings>;
export type TeamStoresPayload = Envelope<"store-team-stores", Readonly<{ teamStores: readonly StoreTeamStore[] }>>;
export type ManifestPayload = Envelope<"store-manifest", Manifest>;

export const productsPayload = (inputs: readonly ProductInput[], at: Date): ProductsPayload =>
  envelope("store-products", { products: inputs.map(storeProduct) }, at);

export const dropsPayload = (rows: readonly DropRow[], at: Date): DropsPayload => envelope("store-drops", storeDrops(rows), at);

export const listingsPayload = (rows: readonly ListingRow[], at: Date): ListingsPayload => envelope("store-listings", storeListings(rows), at);

export const teamStoresPayload = (inputs: readonly TeamStoreInput[], at: Date): TeamStoresPayload =>
  envelope("store-team-stores", { teamStores: inputs.map(storeTeamStore) }, at);

export const manifestPayload = (at: Date): ManifestPayload => envelope("store-manifest", manifest(), at);
