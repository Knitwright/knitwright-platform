import type { NextConfig } from "next";

/**
 * Sent with every response. A full content security policy for scripts, with a nonce
 * for each request, is part of launch hardening (plan step 26). These are the parts
 * that need no nonce.
 */
const SECURITY_HEADERS = [
  // The app is never shown inside another site's frame, so its buttons cannot be
  // covered and pressed by a trick page.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

/**
 * The export route sends files, and an SVG can hold script. Headers set here win over the headers a
 * route handler sets, so the sandbox policy of an export must be set here too, after the rule for
 * every path so that it wins (the later rule wins). It holds SVG_POLICY from
 * lib/techpack/exports/headers.ts and the framing rules above; a test checks both.
 */
const EXPORT_HEADERS = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // The PDF font is read from disk when a PDF is made (decision 0008), so the host must ship it with
  // the export route. The brackets are escaped because the key is a picomatch glob. A test fails
  // when this entry is missing or names another route.
  outputFileTracingIncludes: { "/api/projects/\\[projectId\\]/exports/\\[format\\]": ["./assets/fonts/**"] },
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    { source: "/api/projects/:projectId/exports/:format", headers: EXPORT_HEADERS },
  ],
};

export default nextConfig;
