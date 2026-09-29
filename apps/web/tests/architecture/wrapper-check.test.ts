import { describe, expect, it } from "vitest";
import { checkWrappers, type SourceText } from "./wrapper-check";

const route = (text: string, path = "app/api/things/route.ts"): SourceText => ({ path, text });
const actions = (text: string, path = "lib/things/actions.ts"): SourceText => ({ path, text });

const rules = (files: SourceText[], allowList: string[] = []) =>
  checkWrappers(files, allowList).map((violation) => violation.rule);

const WRAPPED_ROUTE = `
import { defineRoute } from "@/lib/server/define-route";
export const GET = defineRoute({ auth: "user", rateLimit: R, schema: {}, handler: async () => ({}) });
`;

const WRAPPED_ACTION = `
"use server";
import { defineAction } from "@/lib/server/define-action";
export const rename = defineAction({ auth: "user", rateLimit: R, schema: S, handler: async () => {} });
`;

describe("checkWrappers, route handlers", () => {
  it("accepts a handler that is the output of defineRoute", () => {
    expect(rules([route(WRAPPED_ROUTE)])).toEqual([]);
  });

  it("rejects a handler written as a plain function", () => {
    expect(rules([route(`export async function GET() { return new Response("x"); }`)])).toEqual([
      "route-not-wrapped",
    ]);
  });

  it("rejects a handler written as an arrow function", () => {
    expect(rules([route(`export const POST = async () => new Response("x");`)])).toEqual([
      "route-not-wrapped",
    ]);
  });

  it("rejects a handler exported under a method name from a list", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      const handler = async () => new Response("x");
      export { handler as DELETE };
    `;
    expect(rules([route(text)])).toEqual(["route-not-wrapped"]);
  });

  it("rejects a handler re-exported from another file", () => {
    expect(rules([route(`export { GET } from "./elsewhere";`)])).toEqual(["route-not-wrapped"]);
    expect(rules([route(`export * from "./elsewhere";`)])).toEqual(["route-not-wrapped"]);
  });

  it("rejects a function that only shares the wrapper's name", () => {
    const text = `
      import { defineRoute } from "./my-own-wrapper";
      export const GET = defineRoute({ auth: "user" });
    `;
    expect(rules([route(text)])).toEqual(["route-not-wrapped"]);
  });

  it("accepts the wrapper imported under another name", () => {
    const text = `
      import { defineRoute as make } from "@/lib/server/define-route";
      export const GET = make({ auth: "user", rateLimit: R, schema: {}, handler: async () => ({}) });
    `;
    expect(rules([route(text)])).toEqual([]);
  });

  it("checks every method in the file", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ auth: "user", rateLimit: R, schema: {}, handler: h });
      export async function PUT() {}
      export async function PATCH() {}
    `;
    expect(rules([route(text)])).toEqual(["route-not-wrapped", "route-not-wrapped"]);
  });

  it("leaves route segment settings alone", () => {
    const text = `${WRAPPED_ROUTE}\nexport const maxDuration = 60;\nexport const dynamic = "force-dynamic";`;
    expect(rules([route(text)])).toEqual([]);
  });

  it("ignores files that are not route files", () => {
    expect(rules([{ path: "lib/things/get.ts", text: `export async function GET() {}` }])).toEqual(
      [],
    );
  });

  it("rejects a handler exported by taking an object apart", () => {
    const text = `export const { GET } = { GET: async () => new Response("open") };`;
    expect(rules([route(text)])).toEqual(["route-not-wrapped"]);
  });

  it("rejects a handler exported by taking an array apart", () => {
    const text = `export const [GET] = [async () => new Response("open")];`;
    expect(rules([route(text)])).toEqual(["route-not-wrapped"]);
  });

  it("rejects a handler that can be replaced after it was made", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      export let GET = defineRoute({ auth: "user", rateLimit: R, schema: {}, handler: h });
      GET = async () => new Response("open");
    `;
    expect(rules([route(text)])).toEqual(["route-not-wrapped"]);
  });

  it("also checks route files written as JavaScript", () => {
    for (const name of ["route.js", "route.mjs", "route.cjs", "route.jsx", "route.mts"]) {
      expect(rules([route(`export async function GET() {}`, `app/api/x/${name}`)])).toEqual([
        "route-not-wrapped",
      ]);
    }
  });

  it("also checks route files written as tsx", () => {
    expect(
      rules([route(`export async function GET() {}`, "app/og/[id]/route.tsx")]),
    ).toEqual(["route-not-wrapped"]);
  });
});

describe("checkWrappers, server actions", () => {
  it("accepts an action that is the output of defineAction", () => {
    expect(rules([actions(WRAPPED_ACTION)])).toEqual([]);
  });

  it("rejects a plain async function in a server file", () => {
    const text = `"use server";\nexport async function rename() {}`;
    expect(rules([actions(text)])).toEqual(["action-not-wrapped"]);
  });

  it("rejects a default export in a server file", () => {
    const text = `"use server";\nexport default async function rename() {}`;
    expect(rules([actions(text)])).toEqual(["action-not-wrapped"]);
  });

  it("rejects a re-export in a server file", () => {
    const text = `"use server";\nexport { rename } from "./elsewhere";`;
    expect(rules([actions(text)])).toEqual(["action-not-wrapped"]);
  });

  it("rejects an action exported by taking an object apart", () => {
    const text = `"use server";
export const { rename } = { rename: async () => {} };`;
    expect(rules([actions(text)])).toEqual(["action-not-wrapped"]);
  });

  it("rejects an action that can be replaced after it was made", () => {
    const text = `"use server";
      import { defineAction } from "@/lib/server/define-action";
      export let rename = defineAction({ auth: "user", rateLimit: R, schema: S, handler: h });`;
    expect(rules([actions(text)])).toEqual(["action-not-wrapped"]);
  });

  it("allows a server file to export types", () => {
    const text = `${WRAPPED_ACTION}\nexport type RenameInput = { name: string };`;
    expect(rules([actions(text)])).toEqual([]);
  });

  it("recognises the directive in single quotes and without a semicolon", () => {
    expect(rules([actions(`'use server'\nexport async function rename() {}`)])).toEqual([
      "action-not-wrapped",
    ]);
  });

  it("bans the directive inside a function", () => {
    const text = `
      export default function Page() {
        async function save() {
          "use server";
        }
        return null;
      }
    `;
    expect(rules([{ path: "app/(auth)/sign-in/Panel.tsx", text }])).toEqual([
      "inline-use-server",
    ]);
  });

  it("bans the directive inside an arrow function", () => {
    const text = `export const save = async () => { "use server"; };`;
    expect(rules([{ path: "components/Save.tsx", text }])).toEqual(["inline-use-server"]);
  });

  it("does not mistake the words in a string or comment for the directive", () => {
    const text = `// "use server"\nexport const label = "use server";`;
    expect(rules([{ path: "lib/copy.ts", text }])).toEqual([]);
  });
});

describe("checkWrappers, public allow list", () => {
  const PUBLIC_ROUTE = `
    import { defineRoute } from "@/lib/server/define-route";
    export const GET = defineRoute({ auth: "public", rateLimit: R, schema: {}, handler: h });
  `;

  it("rejects a public route that is not on the allow list", () => {
    expect(rules([route(PUBLIC_ROUTE)])).toEqual(["public-not-listed"]);
  });

  it("accepts a public route that is on the allow list", () => {
    expect(rules([route(PUBLIC_ROUTE)], ["app/api/things/route.ts#GET"])).toEqual([]);
  });

  it("lists by method, so allowing GET does not allow POST", () => {
    const text = `${PUBLIC_ROUTE}
      export const POST = defineRoute({ auth: "public", rateLimit: R, schema: {}, handler: h });`;
    expect(rules([route(text)], ["app/api/things/route.ts#GET"])).toEqual(["public-not-listed"]);
  });

  it("rejects a public action that is not on the allow list", () => {
    const text = `"use server";
      import { defineAction } from "@/lib/server/define-action";
      export const signIn = defineAction({ auth: "public", rateLimit: R, schema: S, handler: h });`;
    expect(rules([actions(text)])).toEqual(["public-not-listed"]);
    expect(rules([actions(text)], ["lib/things/actions.ts#signIn"])).toEqual([]);
  });

  it("rejects an allow-list entry that matches nothing, so the list cannot rot", () => {
    expect(rules([route(WRAPPED_ROUTE)], ["app/api/gone/route.ts#GET"])).toEqual([
      "stale-allow-entry",
    ]);
  });

  it("rejects an allow-list entry for a route that is not public", () => {
    expect(rules([route(WRAPPED_ROUTE)], ["app/api/things/route.ts#GET"])).toEqual([
      "stale-allow-entry",
    ]);
  });

  it("accepts a route for members of a brand", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ auth: "member", rateLimit: R, schema: {}, handler: h });
    `;
    expect(rules([route(text)])).toEqual([]);
  });

  it("rejects a kind of auth that does not exist", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ auth: "anyone", rateLimit: R, schema: {}, handler: h });
    `;
    expect(rules([route(text)])).toEqual(["auth-not-literal"]);
  });

  it("requires auth to be written out, so it can be read without running the code", () => {
    const computed = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ auth: MODE, rateLimit: R, schema: {}, handler: h });
    `;
    const missing = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ rateLimit: R, schema: {}, handler: h });
    `;
    const spread = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute(config);
    `;
    expect(rules([route(computed)])).toEqual(["auth-not-literal"]);
    expect(rules([route(missing)])).toEqual(["auth-not-literal"]);
    expect(rules([route(spread)])).toEqual(["auth-not-literal"]);
  });

  it("rejects a spread that could overwrite auth after it was written", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      export const GET = defineRoute({ auth: "user", ...overrides });
    `;
    expect(rules([route(text)])).toEqual(["auth-not-literal"]);
  });
});

describe("checkWrappers, report", () => {
  it("names the file and the export in each violation", () => {
    const [violation] = checkWrappers([route(`export async function GET() {}`)], []);
    expect(violation).toMatchObject({
      file: "app/api/things/route.ts",
      rule: "route-not-wrapped",
    });
    expect(violation.detail).toContain("GET");
  });
});

describe("checkWrappers, pages that need a session", () => {
  const page = (text: string, path = "app/(app)/studio/page.tsx"): SourceText => ({ path, text });
  const pageRules = (files: SourceText[], publicPages: string[] = []) =>
    checkWrappers(files, [], publicPages).map((violation) => violation.rule);

  const guardedBy = (guard: string, body = `await ${guard}();`) => `
    import { ${guard} } from "@/lib/server/page-guards";
    export default async function Page() {
      ${body}
      return null;
    }
  `;
  const UNGUARDED = `export default function Page() { return null; }`;

  it("accepts a studio page that checks for a member itself", () => {
    expect(pageRules([page(guardedBy("requireMember"))])).toEqual([]);
    expect(
      pageRules([page(guardedBy("requireMember", "const { brand } = await requireMember();"))]),
    ).toEqual([]);
  });

  it("rejects a studio page that relies on its layout to check", () => {
    expect(pageRules([page(UNGUARDED)])).toEqual(["page-not-guarded"]);
  });

  it("rejects a studio page that imports the check but never calls it", () => {
    const text = `import { requireMember } from "@/lib/server/page-guards";
${UNGUARDED}`;
    expect(pageRules([page(text)])).toEqual(["page-not-guarded"]);
  });

  it("rejects a check that only shares the name", () => {
    const text = `
      const requireMember = async () => ({});
      export default async function Page() { await requireMember(); return null; }
    `;
    expect(pageRules([page(text)])).toEqual(["page-not-guarded"]);
  });

  it("rejects a check that is not waited for, since it would stop nothing", () => {
    expect(pageRules([page(guardedBy("requireMember", "requireMember();"))])).toEqual([
      "page-not-guarded",
    ]);
  });

  it("rejects a check that sits where it may never run", () => {
    const inCondition = guardedBy("requireMember", "if (false) { await requireMember(); }");
    const inOtherFunction = `
      import { requireMember } from "@/lib/server/page-guards";
      async function unused() { await requireMember(); }
      export default async function Page() { return null; }
    `;
    const afterReturn = `
      import { requireMember } from "@/lib/server/page-guards";
      export default async function Page() { return null; await requireMember(); }
    `;
    for (const text of [inCondition, inOtherFunction, afterReturn]) {
      expect(pageRules([page(text)])).toEqual(["page-not-guarded"]);
    }
  });

  it("rejects a studio page that checks for a session only, since it also needs a brand", () => {
    expect(pageRules([page(guardedBy("requireSession"))])).toEqual(["page-not-guarded"]);
  });

  it("checks layouts, templates and defaults as well as pages", () => {
    for (const name of ["layout.tsx", "template.tsx", "default.tsx", "page.jsx"]) {
      expect(pageRules([page(UNGUARDED, `app/(app)/${name}`)])).toEqual(["page-not-guarded"]);
    }
  });

  it("checks a page in any folder, including one added later", () => {
    expect(pageRules([page(UNGUARDED, "app/(studio)/x/page.tsx")])).toEqual(["page-not-guarded"]);
    expect(pageRules([page(UNGUARDED, "app/page.tsx")])).toEqual(["page-not-guarded"]);
  });

  it("lets a page outside the studio check for a session only", () => {
    expect(
      pageRules([page(guardedBy("requireSession"), "app/(onboarding)/welcome/page.tsx")]),
    ).toEqual([]);
  });

  it("accepts a page with no check only when it is on the list of public pages", () => {
    expect(pageRules([page(UNGUARDED, "app/page.tsx")], ["app/page.tsx"])).toEqual([]);
  });

  it("does not let the list of public pages open the studio", () => {
    expect(pageRules([page(UNGUARDED)], ["app/(app)/studio/page.tsx"])).toContain(
      "page-not-guarded",
    );
  });

  it("rejects an entry on the list of public pages that matches no page", () => {
    expect(pageRules([], ["app/gone/page.tsx"])).toEqual(["stale-allow-entry"]);
  });

  it("leaves pieces of pages alone", () => {
    expect(pageRules([page(UNGUARDED, "app/(app)/studio/DesignCard.tsx")])).toEqual([]);
    expect(pageRules([page(UNGUARDED, "components/auth/page.tsx")])).toEqual([]);
  });

  it("names the file and the check it needs", () => {
    const [violation] = checkWrappers([page(UNGUARDED)], [], []);
    expect(violation.file).toBe("app/(app)/studio/page.tsx");
    expect(violation.detail).toContain("requireMember");
  });
});
