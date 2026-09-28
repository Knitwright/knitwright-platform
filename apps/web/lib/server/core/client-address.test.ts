import { describe, expect, it } from "vitest";
import { clientAddress } from "./client-address";

const headers = (values: Record<string, string>) => new Headers(values);

describe("clientAddress", () => {
  it("prefers the address the host itself reports", () => {
    expect(
      clientAddress(
        headers({
          "x-vercel-forwarded-for": "198.51.100.1",
          "x-real-ip": "198.51.100.2",
          "x-forwarded-for": "198.51.100.3",
        }),
      ),
    ).toBe("198.51.100.1");
  });

  it("falls back to x-real-ip, then to the first forwarded address", () => {
    expect(clientAddress(headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientAddress(headers({ "x-forwarded-for": "198.51.100.3, 10.0.0.1" }))).toBe(
      "198.51.100.3",
    );
  });

  it("groups an IPv6 address by its /64 network, since one user holds a whole network", () => {
    expect(clientAddress(headers({ "x-real-ip": "2001:db8:85a3:8d3:1319:8a2e:370:7348" }))).toBe(
      "2001:db8:85a3:8d3::/64",
    );
  });

  it("expands a shortened IPv6 address before grouping it", () => {
    expect(clientAddress(headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8:0:0::/64");
  });

  it("reads an IPv4 address wrapped in IPv6 as IPv4", () => {
    expect(clientAddress(headers({ "x-real-ip": "::ffff:198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("puts every request without a usable address in one shared bucket", () => {
    expect(clientAddress(headers({}))).toBe("unknown");
    expect(clientAddress(headers({ "x-real-ip": "not an address" }))).toBe("unknown");
    expect(clientAddress(headers({ "x-forwarded-for": "  " }))).toBe("unknown");
  });

  it("never returns header text that is not an address, so keys cannot be forged", () => {
    expect(clientAddress(headers({ "x-real-ip": "1.2.3.4:user:victim" }))).toBe("unknown");
  });
});
