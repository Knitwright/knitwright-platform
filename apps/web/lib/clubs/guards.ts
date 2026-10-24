import { AppError } from "@/lib/server/core/errors";
import type { MemberSession } from "@/lib/server/core/guard";
import { NOT_ALLOWED } from "./errors";
import { can, type Ability } from "./roles";
import type { Who } from "./service";

/** The brand and person a club write is made for. Always from the session, never from the request. */
export const whoOf = (session: MemberSession): Who => ({ brandId: session.brand.id, userId: session.userId });

/**
 * Refuses a role that may not do this, before anything else happens. The database checks the same
 * rule again inside every club function, so this is for a clear answer, not for safety.
 */
export function requireAbility(session: MemberSession, ability: Ability): void {
  if (!can(session.brand.role, ability)) throw new AppError("forbidden", NOT_ALLOWED);
}
