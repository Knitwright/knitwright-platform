"use server";

import { z } from "zod";
import { can } from "@/lib/clubs/roles";
import { SELL_CURRENCIES } from "@/lib/factory/schemas";
import { loadMake, loadOrderProducts } from "@/lib/make/server";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { buildAccessRows } from "@/lib/share/invite-fields";
import { listShareInvites } from "@/lib/share/invite-service";
import { buildShareLinkViews } from "@/lib/share/responses";
import { listShareLinks } from "@/lib/share/service";

/**
 * The reads the Order drawer and the Share popover make when they open (plan v6 E4, decision 0148),
 * so opening a canvas does not pay for the factory rows and the share links of a design nobody is
 * about to order or share. Both read as the member, so row level security decides what is seen; a
 * design of another brand is not found. Neither writes: the drawer's sends are the make flow's own
 * actions, which run the D1 validation gate (`lib/make/actions.ts`), and the popover's are the share
 * actions.
 */

const drawerBody = z.object({ projectId: z.uuid(), market: z.enum(SELL_CURRENCIES) });

export const loadOrderDrawerAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: drawerBody,
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const [context, products] = await Promise.all([
      loadMake(client, session.brand.id, input.projectId, input.market),
      loadOrderProducts(client, session.brand.id, input.market),
    ]);
    return {
      context,
      // The Run tab orders this design only; the Orders area's own modal still searches every product.
      products: products.filter((product) => product.projectId === input.projectId),
      canOrder: can(session.brand.role, "manageKit"),
    };
  },
});

export const loadShareAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: z.object({ projectId: z.uuid(), version: z.number().int().min(1) }),
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const now = new Date();
    const [{ links, answers }, invites] = await Promise.all([
      listShareLinks(client, session.brand.id, input.projectId),
      listShareInvites(client, session.brand.id, input.projectId),
    ]);
    return { links: buildShareLinkViews(links, answers, input.version, now), access: buildAccessRows(invites, now) };
  },
});
