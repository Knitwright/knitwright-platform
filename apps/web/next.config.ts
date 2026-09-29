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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // The PDF font is read from disk at run time, so the host must ship it with the function.
  outputFileTracingIncludes: { "/api/flat-spike": ["./assets/fonts/**"] },
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
};

export default nextConfig;
