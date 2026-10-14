/**
 * Times the studio against a production build: the server's answer for each main page, a client
 * navigation between them, and the JavaScript each page ships.
 *
 *   pnpm build && pnpm start -p 3205
 *   pnpm exec tsx scripts/measure-navigation.mts http://localhost:3205 [email] [password] [runs]
 *
 * It signs in through the sign-in page (the bot check is stood in for, as in the browser tests),
 * so the account must exist locally. Results are printed as JSON and as a table.
 */
import { gzipSync } from "node:zlib";
import { chromium, type BrowserContext, type Page } from "@playwright/test";

const [base = "http://localhost:3205", email = "audit+1@example.com", password = "Orange Kettle Rugby 42", runsArg = "5"] =
  process.argv.slice(2);
const RUNS = Number(runsArg);

const STAND_IN = `window.turnstile = { render(c, o) { const f = document.createElement("input"); f.type = "hidden";
  f.name = o["response-field-name"] || "cf-turnstile-response"; f.value = "XXXX.DUMMY.TOKEN.XXXX"; c.appendChild(f);
  setTimeout(() => o.callback && o.callback(f.value), 0); return "s"; }, remove() {} };`;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
};

const signIn = async (page: Page): Promise<void> => {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('[data-bot-check="ready"]').waitFor();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/studio/);
};

const firstDesign = async (page: Page): Promise<string> => {
  await page.goto(`${base}/studio`);
  const hrefs = await page.locator("a[href^='/studio/']").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const id = hrefs.map((href) => /^\/studio\/([0-9a-f-]{36})/.exec(href)?.[1]).find(Boolean);
  if (!id) throw new Error("The account has no design. Make one first.");
  return id;
};

const cookieHeader = async (context: BrowserContext): Promise<string> =>
  (await context.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

type ServerTiming = Readonly<{ ttfb: number; total: number }>;

/** The server's answer to a full page load: time to the first byte and to the last. */
const timeServer = async (path: string, cookie: string): Promise<ServerTiming> => {
  const ttfbs: number[] = [];
  const totals: number[] = [];
  for (let run = 0; run <= RUNS; run += 1) {
    const start = performance.now();
    const response = await fetch(`${base}${path}`, { headers: { cookie }, redirect: "manual" });
    const reader = response.body?.getReader();
    const first = reader ? await reader.read() : undefined;
    const ttfb = performance.now() - start;
    while (reader && first && !first.done && !(await reader.read()).done);
    if (response.status !== 200) throw new Error(`${path} answered ${response.status}`);
    // The first run warms the route and is not counted.
    if (run > 0) {
      ttfbs.push(ttfb);
      totals.push(performance.now() - start);
    }
  }
  return { ttfb: median(ttfbs), total: median(totals) };
};

/** Script bytes a cold load of the page downloads, before and after gzip. */
const scriptBytes = async (context: BrowserContext, path: string): Promise<Readonly<{ raw: number; gzip: number }>> => {
  const page = await context.newPage();
  const bodies: Promise<Buffer>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") bodies.push(response.body().catch(() => Buffer.alloc(0)));
  });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const all = await Promise.all(bodies);
  await page.close();
  return {
    raw: Math.round(all.reduce((sum, body) => sum + body.length, 0) / 1024),
    gzip: Math.round(all.reduce((sum, body) => sum + gzipSync(body).length, 0) / 1024),
  };
};

type NavTiming = Readonly<{ feedback: number; done: number }>;

/** Runs in the page: clicks the link to `target` (or asks the router), then watches. */
const NAVIGATE = `function (target) {
  const before = document.querySelector("#main")?.textContent ?? "";
  const start = performance.now();
  let shown = 0;
  const link = Array.from(document.querySelectorAll("a[href]")).find((a) => a.getAttribute("href") === target && a.offsetParent !== null);
  if (link) link.click(); else window.next.router.push(target);
  const path = target.split("?")[0];
  return new Promise((resolve) => {
    const check = () => {
      const now = performance.now() - start;
      if (!shown && location.pathname === path) shown = now;
      const main = document.querySelector("#main");
      const fresh = main !== null && main.textContent !== before;
      const skeleton = document.querySelector("#main [data-skeleton]");
      if (shown && fresh && !skeleton) resolve({ feedback: shown, done: now });
      else if (now > 20000) resolve({ feedback: shown || now, done: -1 });
      else requestAnimationFrame(check);
    };
    check();
  });
}`;

/**
 * One client navigation, from a settled page: `feedback` is when the address changes (the
 * skeleton or the page shows), `done` when the new page's content has replaced the skeleton
 * (-1 when it had not after 20 seconds).
 */
const timeNavigation = async (page: Page, from: string, to: string): Promise<NavTiming> => {
  const feedback: number[] = [];
  const done: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    await page.goto(`${base}${from}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // A string, so the bundler of this script adds no helpers the page does not have.
    const result = (await page.evaluate(`(${NAVIGATE})(${JSON.stringify(to)})`)) as NavTiming;
    console.error(`${from} -> ${to}: ${Math.round(result.feedback)} / ${Math.round(result.done)} ms`);
    feedback.push(result.feedback);
    done.push(result.done);
  }
  return { feedback: median(feedback), done: median(done) };
};

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(STAND_IN);
  await context.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: STAND_IN }));
  const page = await context.newPage();
  await signIn(page);
  const id = await firstDesign(page);
  const cookie = await cookieHeader(context);

  const routes: Record<string, string> = {
    "studio home": "/studio",
    design: `/studio/${id}`,
    "tech pack": `/studio/${id}/tech-pack`,
    settings: "/settings",
    "brand settings": "/brands",
    "kit styles": `/studio/${id}/kit-styles`,
  };

  const server: Record<string, ServerTiming & { jsRaw: number; jsGzip: number }> = {};
  for (const [name, path] of Object.entries(routes)) {
    const timing = await timeServer(path, cookie);
    const js = await scriptBytes(context, path);
    server[name] = { ...timing, jsRaw: js.raw, jsGzip: js.gzip };
  }

  const hops: [string, string, string][] = [
    ["home → design", routes["studio home"]!, routes.design!],
    ["design → tech pack", routes.design!, routes["tech pack"]!],
    ["design → settings", routes.design!, routes.settings!],
    ["settings → brands", routes.settings!, routes["brand settings"]!],
    ["brands → home", routes["brand settings"]!, routes["studio home"]!],
    ["design → kit styles", routes.design!, routes["kit styles"]!],
  ];
  const navigation: Record<string, NavTiming> = {};
  for (const [name, from, to] of hops) navigation[name] = await timeNavigation(page, from, to);

  await browser.close();
  console.log(JSON.stringify({ base, runs: RUNS, server, navigation }, null, 2));
  console.table(server);
  console.table(navigation);
};

await main();
