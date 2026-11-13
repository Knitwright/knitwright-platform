/**
 * The only pages and layouts shown without a session. Every other page, layout,
 * template and default under `app/` must check the session itself. The architecture
 * test fails for a page that does neither, and for an entry here that matches no page.
 *
 * Pages in the studio, under `app/(app)/`, can never be made public by listing them.
 */
export const PUBLIC_PAGES = [
  // The frame of every page. It shows no data.
  "app/layout.tsx",
  // The start page.
  "app/page.tsx",
  // Signing in, signing up and resetting a password happen before a session exists.
  "app/(auth)/sign-in/page.tsx",
  "app/(auth)/sign-up/page.tsx",
  "app/(auth)/forgot-password/page.tsx",
  // Opened from a link in an email, before a session exists.
  "app/(auth)/auth/confirm/page.tsx",
  // The terms, privacy notice and data-processing terms. Anyone must be able to read them before signing up.
  "app/legal/[document]/page.tsx",
  // Opened from the unsubscribe link in a marketing email, without signing in. The signed
  // token names the person; showing the page changes nothing (decision 0025).
  "app/unsubscribe/page.tsx",
  // A design a member shared with their committee (decision 0026). The token in the address is the
  // only key: the page reads through the share functions, which check it, and shows no other data.
  "app/s/[token]/page.tsx",
  // The rights-holder report form (decision 0073): a rights holder has no account. The page shows no data; its action is
  // guarded by the bot check and a limit per address.
  "app/report-a-mark/page.tsx",
  // A factory's job packet (decision 0072). The token in the address is the only key: the page reads through the
  // job packet functions, which check it, and shows only that batch's lists.
  "app/job/[token]/page.tsx",
  // A player's sign-up link (F-T4, decision 0087): a teenager on a phone has no account. The token in the address is
  // the only key: the page reads through the sign-up functions, which check it, and shows only the club's name, the
  // season's name, the sport's number range and the size guide. It shows no other player's answer and no roster.
  "app/join/[token]/page.tsx",
  // The component library's fixture page (decision 0137): every component in every state, with made-up
  // labels and no data. A production build answers 404 unless DEV_UI_ROUTES is "on" (app/dev/dev-routes.ts).
  "app/dev/ui/page.tsx",
  // The dashboard shell with made-up data (decision 0138), for the comparison with its reference image.
  // Same switch as /dev/ui.
  "app/dev/shell/page.tsx",
  // The Orders area with made-up data (decision 0143), for the comparison with p09, p10, p11 and p13.
  // Same switch as /dev/ui.
  "app/dev/orders/page.tsx",
  // AI Studio with made-up data (decision 0141), for the comparisons with d07–d12. Same switch as /dev/ui.
  "app/dev/ai-studio/page.tsx",
  // The Products pages with fixture data (decision 0142), for the comparison with their reference images.
  // Same switch as /dev/ui.
  "app/dev/products/page.tsx",
  // The Projects page with made-up data (decision 0139), for the comparison with d01–d06. Same switch as /dev/ui.
  "app/dev/projects/page.tsx",
  // The Templates, Mockups and Marketing pages with made-up data from the code's own library (decision 0140),
  // for the comparisons with d13-d15. Same switch as /dev/ui.
  "app/dev/pages/page.tsx",
  // Same switch: P6's Team, Brand, Settings and plans fixtures (decision 0144).
  "app/dev/p6/page.tsx",
  // The one canvas with made-up boards (decision 0145), for the comparison with e01. Same switch as /dev/ui.
  "app/dev/canvas/page.tsx",
  // The right inspector by selection with made-up data (decision 0147), for e15–e26 and e41. Same switch as /dev/ui.
  "app/dev/inspector/page.tsx",
  // E5's prompt bar, pickers and panels with made-up data (decision 0149). Same switch as /dev/ui.
  "app/dev/prompt-bar/page.tsx",
  // Garment Studio with made-up data (decision 0150), for s01–s07 and s16–s19. Same switch as /dev/ui.
  "app/dev/garment-studio/page.tsx",
  // C1's checkout return states, test checkout, credit packs and ops finance with made-up payments (decision 0152).
  "app/dev/payments/page.tsx",
  // C4's Sales channels screen with made-up channels, products and orders (decision 0155). Same switch as /dev/ui.
  "app/dev/channels/page.tsx",
  // G2's tech pack editor and sheets with made-up data (decision 0151), for s08–s15 and x01–x08. Same switch as /dev/ui.
  "app/dev/tech-pack/page.tsx",
  // A brand's storefront (spec F-L5, decision 0154): a shopper has no account. Each page reads with the server's key
  // and shows only a LIVE storefront's PUBLISHED listings, the brand's name, first colour and returns policy.
  "app/shop/[store]/page.tsx",
  "app/shop/[store]/[listingId]/page.tsx",
  "app/shop/[store]/returns/page.tsx",
  // The shopper's own order and its test checkout (decision 0154): the random token in the address is the only key,
  // compared by its hash, and each shows only that one order. The test checkout exists only where it is the processor.
  "app/shop/[store]/order/[orderId]/page.tsx",
  "app/shop/[store]/pay/[sessionId]/page.tsx",
  // C3's listing editor and storefront with fixture data (decision 0154), for the comparison with p06. Same switch as /dev/ui.
  "app/dev/storefront/page.tsx",
  // A team store (F-T6, decision 0153): players and parents buy with no account. The code in the address is the
  // only key: the pages read that store through the server's key and show its title, prices, sizes, dates and the
  // club's size guide, never another buyer. The return page shows one payment's state by its id; the test checkout
  // page exists only with PAYMENTS_TEST_CHECKOUT on. Buying is guarded by the bot check and a limit per address.
  "app/t/[code]/page.tsx",
  "app/t/[code]/done/page.tsx",
  "app/t/[code]/pay/[sessionId]/page.tsx",
  // A club's public page (F-T6, decision 0153): only a page its club published, with its name, kit colours and
  // crest, open stores, size guide and the contact line the club chose. Shown at <club>.knitwright.com by proxy.ts.
  "app/clubs/[slug]/page.tsx",
  // C2's team store screens with made-up stores (decision 0153). Same switch as /dev/ui.
  "app/dev/team-stores/page.tsx",
  // C5's Store tabs with made-up sales and payouts (decision 0156), for p14, p15, p17 and p18. Same switch as /dev/ui.
  "app/dev/store/page.tsx",
] as const;
