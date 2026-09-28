import { NextResponse } from "next/server";
import { z } from "zod";
import { finishGoogleSignIn } from "@/lib/auth/service";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/server/core/errors";
import { HOME_AFTER_SIGN_IN, SIGN_IN_PATH } from "@/lib/server/core/paths";
import { defineRoute } from "@/lib/server/define-route";
import { authContext } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Google sends the browser here with a code after the user agrees to sign in. */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.oauth,
  schema: { query: z.object({ code: z.string().min(1).max(2048).optional() }) },
  handler: async ({ input }) => {
    // Redirects go to fixed paths on this site. Nothing in the request chooses them.
    const site = getEnv().NEXT_PUBLIC_SITE_URL;
    const failed = new URL(`${SIGN_IN_PATH}?notice=google-failed`, site);
    if (!input.query.code) return NextResponse.redirect(failed);

    try {
      await finishGoogleSignIn(await authContext(), input.query.code);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      const notice = error.code === "forbidden" ? "sign-up-closed" : "google-failed";
      return NextResponse.redirect(new URL(`${SIGN_IN_PATH}?notice=${notice}`, site));
    }
    return NextResponse.redirect(new URL(HOME_AFTER_SIGN_IN, site));
  },
});
