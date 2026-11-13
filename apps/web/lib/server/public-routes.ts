/**
 * The only route handlers and server actions that run without a session. Each entry is
 * "file#export". The architecture test fails when a public route or action is missing
 * from this list, and when an entry matches nothing.
 *
 * Adding a line here is a security decision. Say why in the comment beside it.
 */
export const PUBLIC_ENTRY_POINTS = [
  // Signing in, signing up and resetting a password happen before a session exists.
  "lib/auth/actions.ts#signUpAction",
  "lib/auth/actions.ts#signInAction",
  "lib/auth/actions.ts#requestPasswordResetAction",
  "lib/auth/actions.ts#confirmLinkAction",
  "lib/auth/actions.ts#startGoogleSignInAction",
  // The unsubscribe button, from a link in an email: no session, by law it must work without
  // signing in. Only a token this server signed is accepted, and all it can do is stop
  // marketing email to the person it names. Rate limited (decision 0025).
  "lib/consent/actions.ts#unsubscribeAction",
  // Google sends the browser back here with a code, before a session exists.
  "app/auth/callback/route.ts#GET",
  // A vote or comment from someone a member sent a share link to, who has no account (decision
  // 0026). The share token decides which design; the bot check and limits per address and per link
  // guard it.
  "lib/share/actions.ts#respondToShareAction",
  // Asking for access while sign-up is by invitation, by someone with no account yet. It can only
  // add one request per email address, kept by request_access; the bot check and a limit per
  // address guard it, and nothing it returns says whether the address asked before.
  "lib/leads/actions.ts#requestAccessAction",
  // A rights holder reports a mark used without permission (F-G1 notice and takedown, decision 0073). No account. It can only add
  // one notice, kept by takedown_submit; the bot check and a limit per address guard it, and the answer reveals nothing.
  "lib/moderation/actions.ts#reportMarkAction",
  // A factory's job packet (decision 0072): the factory has no account. The token in the form or address is the
  // only key; the database hashes it and answers only for a packet that is open (not expired, not revoked). Each is
  // limited per address, and the writes per packet as well. Photos are checked and rewritten before they are kept.
  "lib/job-packet/actions.ts#recordStepAction",
  "lib/job-packet/actions.ts#recordNoteAction",
  "app/api/job/[token]/photos/route.ts#POST",
  "app/api/job/[token]/sheet/route.ts#GET",
  "app/api/job/[token]/files/route.ts#GET",
  // The weekly cut, run by the scheduler (F-O1, decision 0100). There is no session: the scheduler sends the
  // deploy's own CRON_SECRET as a bearer token, compared in constant time, and that is the only door. Without
  // the secret set the route answers 503 and cuts nothing; a wrong secret answers 404. It takes no input, and
  // all it can do is put orders whose cut-off has passed into their batch, which is idempotent per cut-off.
  "app/api/cron/ops-cut-batches/route.ts#GET",
  // The roster purge, run by the scheduler once a day (spec 05 security, decision 0136). The same door as the cut:
  // the deploy's own CRON_SECRET in constant time, 503 without it, 404 for a wrong one. It takes no input, and all
  // it can do is remove rosters older than two seasons for clubs that did not opt in to keep them. Idempotent.
  "app/api/cron/roster-purge/route.ts#GET",
  // The weekly seller payout run (plan v6 C5, decision 0156). The same door as the cut: the deploy's own CRON_SECRET
  // in constant time, 503 without it, 404 for a wrong one. It takes no input, and all it can do is pay sellers what
  // delivered sales owe them; each payout is its own idempotency key at Stripe, so a second run pays nothing twice.
  "app/api/cron/seller-payouts/route.ts#GET",
  // Stripe's webhook (plan v6 C1, decision 0152). Stripe has no session. Nothing is read until the raw body's
  // Stripe-Signature checks against this deploy's webhook secret (lib/payments/signature.ts), and every event is
  // acted on once. Without a processor configured it answers 503 and reads nothing.
  "app/api/payments/webhook/route.ts#POST",
  // Shopify's webhooks and the fulfilment-service callback (plan v6 C4, decision 0155). Shopify has no session.
  // Nothing is read until the raw body's X-Shopify-Hmac-Sha256 checks against the app secret
  // (lib/channels/shopify/hmac.ts); taking an order in is idempotent per order line. Without a Shopify app
  // configured both answer 503 and read nothing.
  "app/api/channels/shopify/webhooks/route.ts#POST",
  "app/api/channels/shopify/fulfilment/fulfillment_order_notification/route.ts#POST",
  // Tracking back to Shopify, run by the scheduler (decision 0155). The same door as the weekly cut: CRON_SECRET in
  // constant time, 503 without it, 404 for a wrong one. No input; it can only send shipped parcels' tracking, once.
  "app/api/cron/channels-tracking/route.ts#GET",
  // A committee comments, votes and approves without an account (F-T3, decision 0087). The token in
  // the form is the only key; the database hashes it and answers only for a link that is open (not
  // expired, not withdrawn). Each is limited per address and per link, and guarded by the bot check.
  // None of them can read anything: a pin, a vote and an approval are writes against one link.
  "lib/share/committee/actions.ts#committeePinAction",
  "lib/share/committee/actions.ts#committeeVoteAction",
  "lib/share/committee/actions.ts#committeeApproveAction",
  // A player gives their shirt name, number and size without an account (F-T4, decision 0087). The
  // sign-up token names the season; the number is checked against the sport's range, the name
  // against the zone's length and the words against moderation (F-G1) before anything is kept. It
  // can only write that one browser's own answer, and it reads back nothing about anyone else.
  "lib/clubs/signup/actions.ts#rosterSignupAction",
  // A shopper buys from a brand's storefront without an account (spec F-L5, decision 0154). It opens one order and one
  // checkout; the database prices it from the published listing and refuses anything not on sale, the name is
  // screened (F-G1), and it is limited per address. It reads back only where to pay.
  "lib/storefront/actions.ts#startShopCheckoutAction",
  // The storefront's test checkout buttons (decision 0154): only where the test checkout is the processor (never where
  // real people sign in), and only with the order's own random token, compared by its hash. Limited per address.
  "lib/storefront/actions.ts#finishShopTestCheckoutAction",
  // The storefront batches, run by the scheduler (spec F-L5, F-O1; decision 0154). The same door as the cut: the
  // deploy's own CRON_SECRET in constant time, 503 without it, 404 for a wrong one. It takes no input, and all it can
  // do is close drops whose window has passed and send their paid orders, and the week's, to production. Idempotent.
  "app/api/cron/storefront-batches/route.ts#GET",
  // The team store run (plan v6 C2, decision 0153), every 15 minutes. The same door as the cut: the deploy's own
  // CRON_SECRET in constant time, 503 without it, 404 for a wrong one. It takes no input; all it can do is close
  // stores whose close time has come (one order, or refunds), refund payments that arrived after a close, and erase
  // buyers' details 180 days after their store closed. Every step is idempotent.
  "app/api/cron/team-stores/route.ts#GET",
  // A player or parent buys from a team store without an account (F-T6, decision 0153). The store's code is the only
  // key; the bot check runs first, then each piece is checked against the store and each shirt name screened (F-G1),
  // and the database works the amount out from the store's own row. It reads back only its own checkout's address.
  "lib/team-stores/actions.ts#buyFromStoreAction",
  // The team store's test checkout buttons (decision 0153, on C1's test checkout). Only where the test checkout is the
  // processor (never on a deploy), and only for a team store payment of the store named; it hands a signed test event
  // to C1's webhook, as C1's own member-only buttons do.
  "lib/team-stores/actions.ts#finishStoreTestCheckoutAction",
] as const;
