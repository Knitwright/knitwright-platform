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
] as const;
