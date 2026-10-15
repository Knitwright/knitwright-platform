import type { Env } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { AppError } from "@/lib/server/core/errors";

export const LIBRARY_NOT_OPEN = "Print files are made from your pattern library, which is not open yet.";

/** Print files and releases read the pattern library, so they are open to whoever the library is open to. */
export function requireLibraryOpen(env: Pick<Env, "OWNER_EMAIL" | "VERCEL_ENV" | "NODE_ENV" | "NEXT_PUBLIC_SITE_URL">, email: string | null): void {
  if (!patternLibraryOpenTo(env, email)) throw new AppError("unavailable", LIBRARY_NOT_OPEN);
}
