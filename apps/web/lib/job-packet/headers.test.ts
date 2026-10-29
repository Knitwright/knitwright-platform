import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { PUBLIC_PAGES } from "@/lib/server/public-pages";
import { PUBLIC_ENTRY_POINTS } from "@/lib/server/public-routes";
import { scrub } from "@/lib/server/log";
import { newPacketToken, packetAddress } from "./token";

/**
 * Decision 0072: a factory's job packet is open to anyone holding its link, so the address must never be sent
 * on to another site, never be indexed, never be kept by a cache, and never be written to a log. The page and
 * its routes have no session, so each must be written down as public.
 */

const rules = async () => (await nextConfig.headers?.()) ?? [];
const valueOf = (headers: readonly { key: string; value: string }[], key: string) =>
  headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;

describe("the job packet's headers", () => {
  it.each(["/job/:token", "/api/job/:token/:path*"])("send no referrer and ask not to be indexed or stored, for %s", async (source) => {
    const rule = (await rules()).find((candidate) => candidate.source === source);

    expect(rule).toBeDefined();
    expect(valueOf(rule?.headers ?? [], "Referrer-Policy")).toBe("no-referrer");
    expect(valueOf(rule?.headers ?? [], "X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(valueOf(rule?.headers ?? [], "Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("are the same as a share page's, which the same rule decides", async () => {
    const all = await rules();
    const share = all.find((rule) => rule.source === "/s/:token");
    const job = all.find((rule) => rule.source === "/job/:token");

    expect(job?.headers).toEqual(share?.headers);
  });

  it("come after the rule for every path, so their referrer rule wins", async () => {
    const all = await rules();
    const everything = all.findIndex((rule) => rule.source === "/:path*");

    for (const source of ["/job/:token", "/api/job/:token/:path*"]) {
      expect(all.findIndex((rule) => rule.source === source), source).toBeGreaterThan(everything);
    }
  });
});

describe("the log", () => {
  it("removes a job packet token from any address it is given, keeping the path", () => {
    const token = newPacketToken();

    for (const address of [
      packetAddress("https://app.knitwright.com", token),
      `GET /api/job/${token}/files`,
      `POST /api/job/${token}/photos?x=1`,
    ]) {
      const cleaned = scrub(address);
      expect(cleaned).not.toContain(token);
      expect(cleaned).toContain("/job/[removed]");
    }
  });

  it("leaves an address with no token in it alone", () => {
    expect(scrub("GET /job")).toBe("GET /job");
    expect(scrub("GET /api/job/events/abc/photo")).toBe("GET /api/job/events/abc/photo");
  });
});

describe("what has no session", () => {
  it("is written down as public: the page, the factory's two actions and its three routes", () => {
    expect(PUBLIC_PAGES).toContain("app/job/[token]/page.tsx");
    expect(PUBLIC_ENTRY_POINTS).toEqual(
      expect.arrayContaining([
        "lib/job-packet/actions.ts#recordStepAction",
        "lib/job-packet/actions.ts#recordNoteAction",
        "app/api/job/[token]/photos/route.ts#POST",
        "app/api/job/[token]/sheet/route.ts#GET",
        "app/api/job/[token]/files/route.ts#GET",
      ]),
    );
  });

  it("does not include the ops photo route, which needs a platform admin", () => {
    expect(PUBLIC_ENTRY_POINTS).not.toContain("app/api/job/events/[eventId]/photo/route.ts#GET");
  });
});
