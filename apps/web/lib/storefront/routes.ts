import type { Route } from "next";

/**
 * The storefront's addresses in the studio (plan v6 C3, decision 0154). C5's Store pages and P4's My products link
 * to these; nothing else needs to know how they are built.
 */

/** 09 screen 23: `/products/:id/listing`, where the id is the brand product's. */
export const listingEditorPath = (productId: string): Route => `/products/${productId}/listing` as Route;

/** The storefront's settings, drops and batches. */
export const STOREFRONT_SETTINGS_PATH = "/store/storefront" as Route;
