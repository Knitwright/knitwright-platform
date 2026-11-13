import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/LinkButton";
import { CALLBACK_PATH } from "@/lib/channels/shopify/oauth";
import { shopDomain } from "@/lib/channels/shopify/hmac";
import { standInReturnQuery } from "@/lib/channels/shopify/stand-in";
import { shopifyApp } from "@/lib/channels/server";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Install Knitwright (Shopify stand-in)", robots: { index: false, follow: false } };

/**
 * The Shopify stand-in's install page (decision 0155): only with SHOPIFY_APP_TEST_MODE on, which a deploy refuses.
 * "Install app" goes back to the real OAuth return with a query signed as Shopify signs one, so the browser tests
 * walk the real install: HMAC, state cookie, token sealing.
 */
/** The query Shopify would send back, signed now. */
function signedReturn(secret: string, shop: string, state: string): URLSearchParams {
  return new URLSearchParams(standInReturnQuery(secret, shop, state, Math.floor(Date.now() / 1000)));
}

export default async function TestInstallPage({ searchParams }: PageProps<"/store/channels/test-install">) {
  await requireMember();
  const app = shopifyApp();
  if (app === null || !app.testMode) notFound();
  const query = await searchParams;
  const state = typeof query.state === "string" ? query.state : "";
  const shop = shopDomain(typeof query.shop === "string" ? query.shop : "") ?? "";
  const back = signedReturn(app.secret, shop, state);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 pt-12">
      <p className="text-small font-semibold text-muted">Shopify stand-in · tests only</p>
      <h1 className="text-h1 text-text">Install Knitwright on {shop || "your shop"}?</h1>
      <p className="text-body text-text-2">Knitwright will list products, read paid orders, fulfil the lines assigned to it and send tracking.</p>
      <div className="flex gap-3">
        <LinkButton href={`/store/channels?shopify=failed` as const}>Cancel</LinkButton>
        <a href={`${CALLBACK_PATH}?${back.toString()}`} className="inline-flex h-10 items-center rounded-md bg-navy px-4 text-body font-semibold text-on-dark no-underline">
          Install app
        </a>
      </div>
    </div>
  );
}
