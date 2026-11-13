import { describe, expect, it } from "vitest";
import { HOST_RULES, rewriteForHost } from "@/lib/hosts/rules";
import { clubHost, clubPageAddress, isClubSlug, suggestSlug } from "./host";
import { QUIET_ZONE, qrPath } from "./qr";

describe("a club's subdomain", () => {
  it("shows the club page at its root and nothing else", () => {
    expect(clubHost("lahore-lions.knitwright.com", "/", "knitwright.com")).toBe("/clubs/lahore-lions");
    expect(clubHost("Lahore-Lions.Knitwright.com:443", "/", "knitwright.com")).toBe("/clubs/lahore-lions");
    expect(clubHost("lahore-lions.knitwright.com", "/t/Ab3dEf7hJk", "knitwright.com")).toBeNull();
    expect(clubHost("knitwright.com", "/", "knitwright.com")).toBeNull();
    expect(clubHost("www.knitwright.com", "/", "knitwright.com")).toBeNull();
    expect(clubHost("a.b.knitwright.com", "/", "knitwright.com")).toBeNull();
    expect(clubHost("lions.localhost:3000", "/", "localhost")).toBe("/clubs/lions");
  });

  it("goes through the shared matcher, which does nothing without a domain or host", () => {
    expect(HOST_RULES.length).toBeGreaterThan(0);
    // Decision 0154: brands and clubs share one namespace, so the brand rule answers first; `/shop/<name>` shows the
    // club's page when the name is a club's. A club's own paths on its host are left as they are.
    expect(rewriteForHost("lions.knitwright.com", "/", "knitwright.com")).toBe("/shop/lions");
    expect(rewriteForHost("lions.knitwright.com", "/t/Ab3dEf7hJk", "knitwright.com")).toBeNull();
    expect(rewriteForHost("lions.knitwright.com", "/", undefined)).toBeNull();
    expect(rewriteForHost(null, "/", "knitwright.com")).toBeNull();
    expect(rewriteForHost("evil.example", "/", "knitwright.com")).toBeNull();
  });

  it("keeps platform names and malformed names out", () => {
    expect(isClubSlug("lahore-lions-fc")).toBe(true);
    for (const bad of ["www", "api", "ab", "-lions", "lions-", "li--ons", "Lions", "a".repeat(41)]) expect(isClubSlug(bad)).toBe(false);
  });

  it("suggests an address from the club's name and says where the page is", () => {
    expect(suggestSlug("Lahore Lions FC")).toBe("lahore-lions-fc");
    expect(suggestSlug("  Saint Étienne U16s! ")).toBe("saint-etienne-u16s");
    expect(clubPageAddress("lions", "knitwright.com", "https://app.example")).toBe("https://lions.knitwright.com");
    expect(clubPageAddress("lions", undefined, "https://app.example/")).toBe("https://app.example/clubs/lions");
    expect(clubPageAddress("lions", "localhost", "http://localhost:3000")).toBe("http://localhost:3000/clubs/lions");
  });
});

describe("the QR code", () => {
  it("is a square of dark modules inside a quiet zone", () => {
    const qr = qrPath("https://knitwright.example/t/Ab3dEf7hJk");
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.box).toBe(qr.size + 2 * QUIET_ZONE);
    // The top-left finder pattern starts at the quiet zone.
    expect(qr.d.startsWith(`M${QUIET_ZONE} ${QUIET_ZONE}h1v1h-1z`)).toBe(true);
    expect(qrPath("https://knitwright.example/t/Ab3dEf7hJk").d).toBe(qr.d);
  });
});
