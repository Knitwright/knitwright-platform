import type { ShopifyAdmin } from "./admin";
import { graphqlAdmin } from "./graphql";
import { STAND_IN_API_KEY, standInAdmin, standInSecret, TEST_INSTALL_PATH } from "./stand-in";

/**
 * Which Shopify this deploy talks to (plan v6 C4, decision 0155), from the environment:
 *
 * - SHOPIFY_APP_API_KEY and SHOPIFY_APP_API_SECRET both set: the owner's Partner app, through the Admin API.
 *   Either alone is a misconfiguration (an install whose return cannot be checked), so Shopify is not set up.
 * - otherwise SHOPIFY_APP_TEST_MODE=on: the stand-in, with a secret derived from the server key.
 * - otherwise none: the Shopify card says the app is not set up on this deploy yet.
 */

export type ShopifyEnv = Readonly<{
  SHOPIFY_APP_API_KEY?: string;
  SHOPIFY_APP_API_SECRET?: string;
  SHOPIFY_APP_TEST_MODE?: "on" | "off";
  SUPABASE_SECRET_KEY: string;
}>;

export type ShopifyApp = Readonly<{
  apiKey: string;
  secret: string;
  admin: ShopifyAdmin;
  /** Where the browser goes to approve an install: Shopify's own page, or the stand-in's. */
  authorizeUrl: (shop: string, query: string) => string;
  testMode: boolean;
}>;

export function shopifyFrom(env: ShopifyEnv): ShopifyApp | null {
  if (env.SHOPIFY_APP_API_KEY && env.SHOPIFY_APP_API_SECRET) {
    return {
      apiKey: env.SHOPIFY_APP_API_KEY,
      secret: env.SHOPIFY_APP_API_SECRET,
      admin: graphqlAdmin({ apiKey: env.SHOPIFY_APP_API_KEY, apiSecret: env.SHOPIFY_APP_API_SECRET }),
      authorizeUrl: (shop, query) => `https://${shop}/admin/oauth/authorize?${query}`,
      testMode: false,
    };
  }
  if (!env.SHOPIFY_APP_API_KEY && !env.SHOPIFY_APP_API_SECRET && env.SHOPIFY_APP_TEST_MODE === "on") {
    return {
      apiKey: STAND_IN_API_KEY,
      secret: standInSecret(env.SUPABASE_SECRET_KEY),
      admin: standInAdmin(),
      authorizeUrl: (_shop, query) => `${TEST_INSTALL_PATH}?${query}`,
      testMode: true,
    };
  }
  return null;
}
