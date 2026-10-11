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
  // Google sends the browser back here with a code, before a session exists.
  "app/auth/callback/route.ts#GET",
  // A vote or comment from someone a member sent a share link to, who has no account (decision
  // 0026). The share token decides which design; the bot check and limits per address and per link
  // guard it.
  "lib/share/actions.ts#respondToShareAction",
] as const;
