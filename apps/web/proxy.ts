import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/config/env";
import { rewriteForHost } from "@/lib/hosts/rules";
import { redirectFor } from "@/lib/server/core/paths";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

const NEVER_STORED = "private, no-cache, no-store, must-revalidate, max-age=0";

/**
 * Keeps the session cookies fresh and redirects early when a page plainly needs a
 * session. This is not the authorisation check: every page, route handler and server
 * action verifies the session itself.
 */
export async function proxy(request: NextRequest) {
  const env = getEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: sessionCookieOptions(env.NEXT_PUBLIC_SITE_URL),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
          // A response that sets session cookies must never be stored by a cache.
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        },
      },
    },
  );

  // Verifies the token and refreshes it when it is about to expire.
  const { data } = await supabase.auth.getClaims();
  const target = redirectFor(request.nextUrl.pathname, Boolean(data?.claims));
  if (!target) return hostRewrite(request, response, env.CLUB_PAGES_DOMAIN) ?? response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  // The redirect may carry refreshed session cookies, so it must not be stored either.
  redirect.headers.set("cache-control", NEVER_STORED);
  return redirect;
}

/**
 * A `<name>.<domain>` address shown as another page of this app (lib/hosts/rules.ts): a club's page (decision
 * 0153). The session cookies the response already carries go with the rewrite.
 */
function hostRewrite(request: NextRequest, response: NextResponse, rootDomain: string | undefined): NextResponse | null {
  const path = rewriteForHost(request.headers.get("host"), request.nextUrl.pathname, rootDomain);
  if (path === null) return null;
  const rewrite = NextResponse.rewrite(new URL(path, request.url), { request });
  for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
  return rewrite;
}

export const config = {
  matcher: [
    // Everything except static files, images and the icon.
    "/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
