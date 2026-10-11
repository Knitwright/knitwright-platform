import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { noticeAfterGoogle, type NoticeKey } from "@/lib/auth/notices";
import { finishGoogleSignIn } from "@/lib/auth/service";
import { parseSignupChoice, SIGNUP_CHOICE_COOKIE } from "@/lib/consent/schemas";
import { recordConsent } from "@/lib/consent/service";
import { MARKETING_OPT_IN } from "@/lib/consent/wording";
import { getEnv } from "@/lib/config/env";
import { monitoredLog } from "@/lib/monitoring/server";
import { AppError } from "@/lib/server/core/errors";
import { HOME_AFTER_SIGN_IN, SIGN_IN_PATH } from "@/lib/server/core/paths";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, authContext } from "@/lib/server/deps";
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

    let userId: string;
    try {
      userId = await finishGoogleSignIn(await authContext(), code);
    } catch (error) {
      if (!(error instanceof AppError) || error.code === "internal") throw error;
      return backToSignIn(error.code === "forbidden" ? "sign-up-closed" : "google-failed");
    }
    await recordSignupChoice(userId);
    return NextResponse.redirect(new URL(HOME_AFTER_SIGN_IN, site));
  },
});

/**
 * The marketing box from the sign-up page, kept in a cookie while Google signed the person in.
 * Recorded only for someone never asked before (the database checks), so signing in again
 * through the sign-up page changes nothing. No cookie (the sign-in page) records nothing.
 */
const recordSignupChoice = async (userId: string): Promise<void> => {
  const jar = await cookies();
  const granted = parseSignupChoice(jar.get(SIGNUP_CHOICE_COOKIE)?.value);
  jar.delete(SIGNUP_CHOICE_COOKIE);
  if (granted === null) return;
  try {
    await recordConsent({ admin: adminClient(), userId, granted, wording: MARKETING_OPT_IN, source: "sign-up" });
  } catch (error) {
    // The person is signed in; a missing record only means no marketing email, which is safe.
    // It is logged and reported, and the person can choose again in Settings.
    monitoredLog({ level: "error", message: "The sign-up email choice could not be recorded.", where: "GET /auth/callback", error });
  }
};
