import { adminClient, sessionClient } from "@/lib/server/deps";
import { assertPlatformAdmin } from "../access";

/**
 * The start of every part 2 ops action: asks the database whether the signed-in person is a platform admin
 * (anyone else gets "not found"), then hands back the server's client and the person's id as the actor. The
 * database functions check the actor again.
 */
export async function opsContext(userId: string) {
  await assertPlatformAdmin(await sessionClient());
  return { admin: adminClient(), actor: userId };
}
