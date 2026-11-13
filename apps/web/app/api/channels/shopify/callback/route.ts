import { cookies } from "next/headers";
import { can } from "@/lib/clubs/roles";
import { getEnv } from "@/lib/config/env";
import { installDeps, shopifyApp } from "@/lib/channels/server";
import { finishInstall } from "@/lib/channels/shopify/install";
import { checkReturn, STATE_COOKIE } from "@/lib/channels/shopify/oauth";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";

/**
 * Shopify's OAuth return (plan v6 C4, decision 0155). The member who pressed Connect comes back here with Shopify's
 * signed query. It is accepted only when the hmac is Shopify's, the state is the one in our signed cookie and the
 * cookie names this person and brand (`lib/channels/shopify/oauth.ts`); then the code becomes a sealed token. The
 * browser is sent back to the Channels screen with the outcome in the address.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.channelWrite,
  schema: {},
  handler: async ({ request, session }) => {
    const back = (outcome: string) => Response.redirect(new URL(`/store/channels?shopify=${outcome}`, getEnv().NEXT_PUBLIC_SITE_URL), 303);
    const app = shopifyApp();
    if (app === null) return back("not-set-up");
    if (!can(session.brand.role, "manageMembers")) return back("not-allowed");
    const jar = await cookies();
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const check = checkReturn(app.secret, query, jar.get(STATE_COOKIE)?.value, { userId: session.userId, brandId: session.brand.id }, Math.floor(Date.now() / 1000));
    jar.delete(STATE_COOKIE);
    if (!check.ok) return back(`refused-${check.reason}`);
    try {
      await finishInstall(installDeps(app), { brandId: session.brand.id, userId: session.userId, shop: check.shop, code: check.code });
    } catch (error) {
      if (error instanceof AppError && error.code === "conflict") return back(error.message.includes("another") ? "taken" : "already");
      log({ level: "error", message: "A Shopify install could not finish", where: `shopify ${check.shop}`, error });
      return back("failed");
    }
    return back("connected");
  },
});
