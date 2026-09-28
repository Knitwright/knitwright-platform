import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefineAction } from "./create-define-action";
import { createDefineRoute } from "./create-define-route";
import { makeDeps, RULE } from "./test-deps";

/**
 * The other wrapper tests use a stand-in for the framework's rethrow. These use the
 * real one, so they fail if a wrapper ever swallows a redirect.
 */

const realDeps = () => {
  const { deps, recorded } = makeDeps();
  return { deps: { ...deps, rethrowControlFlow: unstable_rethrow }, recorded };
};

const digestOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
  } catch (error) {
    return typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : `not control flow: ${String(error)}`;
  }
  return "nothing was thrown";
};

describe("the wrappers and the framework's own control flow", () => {
  it("lets a redirect from an action reach the framework", async () => {
    const { deps, recorded } = realDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: z.object({}),
      handler: async () => {
        redirect("/studio");
      },
    });

    expect(await digestOf(action({}))).toMatch(/^NEXT_REDIRECT;.*\/studio/);
    expect(recorded.logs).toHaveLength(0);
  });

  it("lets a redirect from a route handler reach the framework", async () => {
    const { deps } = realDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        redirect("/sign-in");
      },
    });

    const thrown = digestOf(
      route(new Request("http://localhost/api/x"), { params: Promise.resolve({}) }),
    );

    expect(await thrown).toMatch(/^NEXT_REDIRECT;.*\/sign-in/);
  });

  it("lets a not-found reach the framework", async () => {
    const { deps } = realDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: z.object({}),
      handler: async () => {
        notFound();
      },
    });

    expect(await digestOf(action({}))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("still turns an ordinary error into a failure", async () => {
    const { deps, recorded } = realDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: z.object({}),
      handler: async () => {
        throw new Error("ordinary");
      },
    });

    expect(await action({})).toMatchObject({ success: false, error: { code: "internal" } });
    expect(recorded.logs).toHaveLength(1);
  });
});
