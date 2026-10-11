import "server-only";
import { notFound, redirect } from "next/navigation";
import { amPlatformAdmin } from "@/lib/leads/service";
import type { Brand, MemberSession, Session } from "./core/guard";
import { SIGN_IN_PATH, WELCOME_PATH } from "./core/paths";
import { activeBrand, currentBrands, currentSession, sessionClient } from "./deps";

/**
 * The checks a page makes before it shows anything. Every page and layout that shows a
 * user's data calls one of these itself: the architecture test fails if one does not.
 * A layout's check alone is not enough, because the framework does not run a layout
 * again when the user moves between the pages inside it.
 */

/** The signed-in user. A visitor is sent to sign in. */
export const requireSession = async (): Promise<Session> => {
  const session = await currentSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
};

export type Member = MemberSession & Readonly<{ brands: readonly Brand[] }>;

/**
 * The signed-in user and the brand they are working in, after confirming with the
 * database that they belong to it. Someone with no brand is sent to create one.
 * This is `verifySession()` in the plan.
 */
export const requireMember = async (): Promise<Member> => {
  const session = await requireSession();
  const brand = await activeBrand();
  if (!brand) redirect(WELCOME_PATH);
  return { ...session, brand, brands: await currentBrands() };
};

/**
 * A platform admin: someone on the Knitwright team (decision 0024). Everyone else, signed in or
 * not, gets the page that does not exist, so nobody learns the page is there.
 */
export const requirePlatformAdmin = async (): Promise<Session> => {
  const session = await currentSession();
  if (!session || !(await amPlatformAdmin(await sessionClient()))) notFound();
  return session;
};
