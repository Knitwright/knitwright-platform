import { NextResponse } from "next/server";
import { z } from "zod";
import { noticeAfterGoogle, type NoticeKey } from "@/lib/auth/notices";
import { finishGoogleSignIn } from "@/lib/auth/service";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/server/core/errors";
import { HOME_AFTER_SIGN_IN, SIGN_IN_PATH } from "@/lib/server/core/paths";
import { defineRoute } from "@/lib/server/define-route";
import { authContext } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const text = z.string().max(2048).optional();

/**
 * Google sends the browser here after the user agrees to sign in, with a code. When
 * the sign-in service refused, it sends an error and a description instead.
 *
 * Every redirect goes to a fixed path on this site. Nothing in the request chooses it.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.oauthReturn,
  schema: { query: z.object({ code: text, error: text, error_description: text }) },
  handler: async ({ input }) => {
    const site = getEnv().NEXT_PUBLIC_SITE_URL;
    const backToSignIn = (notice: NoticeKey) =>
      NextResponse.redirect(new URL(`${SIGN_IN_PATH}?notice=${notice}`, site));

    const { code } = input.query;
    if (!code) return backToSignIn(noticeAfterGoogle(input.query));

    try {
      await finishGoogleSignIn(await authContext(), code);
    } catch (error) {
      if (!(error instanceof AppError) || error.code === "internal") throw error;
      return backToSignIn(error.code === "forbidden" ? "sign-up-closed" : "google-failed");
    }
    return NextResponse.redirect(new URL(HOME_AFTER_SIGN_IN, site));
  },
});
