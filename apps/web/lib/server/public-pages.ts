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
  // The Templates, Mockups and Marketing pages with made-up data from the code's own library (decision 0140),
  // for the comparisons with d13-d15. Same switch as /dev/ui.
  "app/dev/pages/page.tsx",
  // Same switch: P6's Team, Brand, Settings and plans fixtures (decision 0144).
  "app/dev/p6/page.tsx",
] as const;
