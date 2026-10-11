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
  // A design a member shared with their committee (decision 0026). The token in the address is the
  // only key: the page reads through the share functions, which check it, and shows no other data.
  "app/s/[token]/page.tsx",
] as const;
