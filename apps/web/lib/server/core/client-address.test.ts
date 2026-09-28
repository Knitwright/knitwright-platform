import { describe, expect, it } from "vitest";
import { clientAddress } from "./client-address";

const headers = (values: Record<string, string>) => new Headers(values);
const TRUSTED = "x-vercel-forwarded-for";

describe("clientAddress", () => {
  it("reads the address from the one header the host is known to write", () => {
    expect(clientAddress(headers({ [TRUSTED]: "198.51.100.1" }), TRUSTED)).toBe("198.51.100.1");
  });

  it("ignores every other header, because the caller can write those", () => {
    const spoofed = headers({
      "x-forwarded-for": "203.0.113.50",
      "x-real-ip": "203.0.113.51",
      forwarded: "for=203.0.113.52",
    });

    expect(clientAddress(spoofed, TRUSTED)).toBe("unknown");
  });

  it("is not moved by other headers when the trusted one is present", () => {
    const mixed = headers({ [TRUSTED]: "198.51.100.1", "x-forwarded-for": "203.0.113.50" });

    expect(clientAddress(mixed, TRUSTED)).toBe("198.51.100.1");
  });

  it("reads another header when the host is configured to use it", () => {
    expect(clientAddress(headers({ "x-real-ip": "198.51.100.2" }), "x-real-ip")).toBe(
      "198.51.100.2",
    );
  });

  it("takes the first address when the header lists several", () => {
    expect(clientAddress(headers({ [TRUSTED]: "198.51.100.3, 10.0.0.1" }), TRUSTED)).toBe(
      "198.51.100.3",
    );
  });

  it("groups an IPv6 address by its /64 network, since one user holds a whole network", () => {
    expect(
      clientAddress(headers({ [TRUSTED]: "2001:db8:85a3:8d3:1319:8a2e:370:7348" }), TRUSTED),
    ).toBe("2001:db8:85a3:8d3::/64");
  });

  it("expands a shortened IPv6 address before grouping it", () => {
    expect(clientAddress(headers({ [TRUSTED]: "2001:db8::1" }), TRUSTED)).toBe(
      "2001:db8:0:0::/64",
    );
  });

  it("reads an IPv4 address wrapped in IPv6 as IPv4", () => {
    expect(clientAddress(headers({ [TRUSTED]: "::ffff:198.51.100.9" }), TRUSTED)).toBe(
      "198.51.100.9",
    );
  });

  it("puts every request without a usable address in one shared bucket", () => {
    expect(clientAddress(headers({}), TRUSTED)).toBe("unknown");
    expect(clientAddress(headers({ [TRUSTED]: "not an address" }), TRUSTED)).toBe("unknown");
    expect(clientAddress(headers({ [TRUSTED]: "  " }), TRUSTED)).toBe("unknown");
  });

  it("never returns header text that is not an address, so keys cannot be forged", () => {
    expect(clientAddress(headers({ [TRUSTED]: "1.2.3.4:user:victim" }), TRUSTED)).toBe("unknown");
  });
});
