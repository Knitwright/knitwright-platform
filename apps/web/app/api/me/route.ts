import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** Who is signed in. The browser uses this to show the account menu. */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ userId: session.userId, email: session.email }),
});
