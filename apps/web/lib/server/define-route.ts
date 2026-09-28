import "server-only";
import { createDefineRoute } from "./core/create-define-route";
import { productionDeps } from "./deps";

/**
 * Every route handler is made with this. It checks the session, applies the rate
 * limit, validates the input and only then runs the handler.
 *
 *   export const GET = defineRoute({ auth: "user", rateLimit, schema: {}, handler });
 */
export const defineRoute = createDefineRoute(productionDeps);
