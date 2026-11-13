import { numericId, orderFromGraphql } from "./order-payload";
import { SHOPIFY_WEBHOOK_TOPICS, ShopifyError, type ProductToPush, type PushedProduct, type Shop, type ShopifyAdmin, type ShopifyOrder } from "./admin";

/**
 * Shopify's Admin GraphQL API with `fetch` (plan v6 C4, decision 0155), at a pinned version, so no SDK is added.
 * Used only when SHOPIFY_APP_API_KEY and SHOPIFY_APP_API_SECRET are set; no test calls Shopify: the tests give it a
 * fake `fetch`. The access token is sent only in Shopify's own header and never appears in an error.
 *
 * Built from Shopify's documentation; its first run against a real development store is an owner step
 * (docs/runbooks/shopify-app.md).
 */

export const SHOPIFY_API_VERSION = "2025-07";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type UserError = Readonly<{ field?: readonly string[] | null; message: string }>;

const gid = (kind: string, id: string): string => (id.startsWith("gid://") ? id : `gid://shopify/${kind}/${id}`);

const firstError = (errors: readonly UserError[] | undefined): string | null => (errors && errors.length > 0 ? errors.map((one) => one.message).join("; ") : null);

const money = (minor: number): string => (minor / 100).toFixed(2);

export function graphqlAdmin(input: Readonly<{ apiKey: string; apiSecret: string; fetch?: Fetch }>): ShopifyAdmin {
  const call = input.fetch ?? ((url, init) => fetch(url, init));

  async function gql<T>(shop: Shop, query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await call(`https://${shop.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-access-token": shop.accessToken },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: unknown };
    if (!response.ok || body.errors || !body.data) throw new ShopifyError(`Shopify answered ${response.status} on ${shop.shop}.`);
    return body.data;
  }

  const mustNotFail = (what: string, errors: readonly UserError[] | undefined): void => {
    const message = firstError(errors);
    if (message) throw new ShopifyError(`${what}: ${message}`);
  };

  return {
    name: "shopify",

    async exchangeCode(shop, code) {
      const response = await call(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ client_id: input.apiKey, client_secret: input.apiSecret, code }),
      });
      const body = (await response.json().catch(() => ({}))) as { access_token?: unknown; scope?: unknown };
      if (!response.ok || typeof body.access_token !== "string") throw new ShopifyError(`Shopify refused the install code for ${shop} (${response.status}).`);
      return { accessToken: body.access_token, scope: typeof body.scope === "string" ? body.scope : "" };
    },

    async registerFulfilmentService(shop, callbackUrl) {
      type Answer = { fulfillmentServiceCreate: { fulfillmentService: { location: { id: string } | null } | null; userErrors: UserError[] } };
      const data = await gql<Answer>(
        shop,
        `mutation($name: String!, $callbackUrl: URL!) {
          fulfillmentServiceCreate(name: $name, callbackUrl: $callbackUrl, trackingSupport: true, inventoryManagement: false) {
            fulfillmentService { location { id } }
            userErrors { field message }
          }
        }`,
        { name: "Knitwright", callbackUrl },
      );
      mustNotFail("Fulfilment service", data.fulfillmentServiceCreate.userErrors);
      const location = data.fulfillmentServiceCreate.fulfillmentService?.location?.id;
      if (!location) throw new ShopifyError("Shopify made a fulfilment service with no location.");
      return { locationId: location };
    },

    async registerWebhooks(shop, address) {
      type Answer = { webhookSubscriptionCreate: { userErrors: UserError[] } };
      for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
        const data = await gql<Answer>(
          shop,
          `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { userErrors { field message } }
          }`,
          { topic, sub: { callbackUrl: address, format: "JSON" } },
        );
        const message = firstError(data.webhookSubscriptionCreate.userErrors);
        // A second install finds the subscription already there; that is not a failure.
        if (message && !/already been taken/i.test(message)) throw new ShopifyError(`Webhook ${topic}: ${message}`);
      }
    },

    async pushProduct(shop, product) {
      return pushProduct(gql, mustNotFail, shop, product);
    },

    async paidOrdersSince(shop, since) {
      type Answer = { orders: { nodes: unknown[] } };
      const data = await gql<Answer>(
        shop,
        `query($q: String!) {
          orders(first: 50, query: $q, sortKey: UPDATED_AT) {
            nodes {
              id name currencyCode
              lineItems(first: 100) { nodes { id quantity sku variant { id } } }
              shippingAddress { name address1 address2 city province zip countryCodeV2 phone }
            }
          }
        }`,
        { q: `financial_status:paid updated_at:>'${since.toISOString()}'` },
      );
      return data.orders.nodes.map(orderFromGraphql).filter((order): order is ShopifyOrder => order !== null);
    },

    async acceptFulfilmentRequests(shop) {
      type List = { shop: { assignedFulfillmentOrders: { nodes: { id: string }[] } } };
      const data = await gql<List>(shop, `{ shop { assignedFulfillmentOrders(first: 50, assignmentStatus: FULFILLMENT_REQUESTED) { nodes { id } } } }`);
      const ids = data.shop.assignedFulfillmentOrders.nodes.map((node) => node.id);
      for (const id of ids) {
        type Answer = { fulfillmentOrderAcceptFulfillmentRequest: { userErrors: UserError[] } };
        const answer = await gql<Answer>(
          shop,
          `mutation($id: ID!) { fulfillmentOrderAcceptFulfillmentRequest(id: $id, message: "Made to order by Knitwright") { userErrors { field message } } }`,
          { id },
        );
        mustNotFail("Accepting a fulfilment request", answer.fulfillmentOrderAcceptFulfillmentRequest.userErrors);
      }
      return ids.length;
    },

    async sendTracking(shop, tracking) {
      type Orders = { order: { fulfillmentOrders: { nodes: { id: string; status: string }[] } } | null };
      const data = await gql<Orders>(shop, `query($id: ID!) { order(id: $id) { fulfillmentOrders(first: 20) { nodes { id status } } } }`, { id: gid("Order", tracking.orderId) });
      const open = (data.order?.fulfillmentOrders.nodes ?? []).filter((node) => node.status === "OPEN" || node.status === "IN_PROGRESS");
      if (open.length === 0) return;
      type Answer = { fulfillmentCreate: { userErrors: UserError[] } };
      const answer = await gql<Answer>(
        shop,
        `mutation($f: FulfillmentInput!) { fulfillmentCreate(fulfillment: $f) { userErrors { field message } } }`,
        {
          f: {
            lineItemsByFulfillmentOrder: open.map((node) => ({ fulfillmentOrderId: node.id })),
            trackingInfo: { company: tracking.courier, number: tracking.trackingNumber },
            notifyCustomer: true,
          },
        },
      );
      mustNotFail("Sending tracking", answer.fulfillmentCreate.userErrors);
    },
  };
}

type Gql = <T>(shop: Shop, query: string, variables?: Record<string, unknown>) => Promise<T>;

/** One `productSet`: the product with a Size option and one variant per size, stocked at Knitwright's location. */
async function pushProduct(gql: Gql, mustNotFail: (what: string, errors: readonly UserError[] | undefined) => void, shop: Shop, product: ProductToPush): Promise<PushedProduct> {
  type Answer = {
    productSet: {
      product: { id: string; variants: { nodes: { id: string; selectedOptions: { name: string; value: string }[]; inventoryItem: { sku: string | null } | null }[] } } | null;
      userErrors: UserError[];
    };
  };
  const input = {
    ...(product.existingProductId ? { id: gid("Product", product.existingProductId) } : {}),
    title: product.title,
    descriptionHtml: product.description,
    status: "ACTIVE",
    productOptions: [{ name: "Size", values: product.variants.map((variant) => ({ name: variant.size })) }],
    variants: product.variants.map((variant) => ({
      optionValues: [{ optionName: "Size", name: variant.size }],
      price: money(variant.priceMinor),
      inventoryItem: { sku: variant.sku, tracked: false },
      ...(product.locationId ? { inventoryQuantities: [{ locationId: product.locationId, name: "available", quantity: 0 }] } : {}),
    })),
  };
  const data = await gql<Answer>(
    shop,
    `mutation($input: ProductSetInput!) {
      productSet(input: $input, synchronous: true) {
        product { id variants(first: 100) { nodes { id selectedOptions { name value } inventoryItem { sku } } } }
        userErrors { field message }
      }
    }`,
    { input },
  );
  mustNotFail("Pushing a product", data.productSet.userErrors);
  const made = data.productSet.product;
  if (!made) throw new ShopifyError("Shopify made no product.");
  return {
    productId: numericId(made.id),
    variants: made.variants.nodes.map((node) => ({
      size: node.selectedOptions.find((option) => option.name === "Size")?.value ?? "",
      variantId: numericId(node.id),
      sku: node.inventoryItem?.sku ?? "",
    })),
  };
}
