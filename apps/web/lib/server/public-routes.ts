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
  // The Store contract (plan v5 O2, decision 0106). The separate Store is a service, not a person: there is no
  // session, and the only door is a token signed with the deploy's own STORE_SERVICE_TOKEN over the payload kind
  // and the call's query, compared in constant time. Without the secret set every one answers 503 and reads
  // nothing; a token that does not verify answers 404. Every one is a read, rate limited per address, and the
  // reads go through the server's own key because the answer crosses brands, which no session may do.
  "app/api/store/route.ts#GET",
  "app/api/store/products/route.ts#GET",
  "app/api/store/drops/route.ts#GET",
  "app/api/store/listings/route.ts#GET",
  "app/api/store/team-stores/route.ts#GET",
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
] as const;
