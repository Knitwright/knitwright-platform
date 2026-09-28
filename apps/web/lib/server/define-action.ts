import "server-only";
import { createDefineAction } from "./core/create-define-action";
import { productionDeps } from "./deps";

/**
 * Every server action is made with this. It checks the session, applies the rate
 * limit, validates the input and only then runs the handler.
 *
 *   export const rename = defineAction({ auth: "user", rateLimit, schema, handler });
 */
export const defineAction = createDefineAction(productionDeps);
