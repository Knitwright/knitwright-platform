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

/**
 * A share page (decision 0026) is open to anyone holding its link, and the link's token is in the
 * address. So the address is never sent to another site, the page is never indexed, and it is never
 * kept by a cache. This rule comes after the rule for every path, so its Referrer-Policy wins. A
 * dynamic page is already sent with no-store; the header here says so again.
 */
const SHARE_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Going back to a studio page seen in the last 30 seconds needs no trip to the server. Every
    // server action that changes data revalidates or sets a cookie, which empties this store.
    staleTimes: { dynamic: 30 },
  },
  typedRoutes: true,
  // Artwork intake (decision 0036) draws a PDF page with pdfjs-dist, which finds its native canvas package by name
  // from beside itself. That only works when pdfjs-dist is loaded from node_modules, not bundled into a chunk.
  serverExternalPackages: ["pdfjs-dist"],
  // The PDF font is read from disk when a PDF is made (decision 0008), so the host must ship it with
  // the export route. The brackets are escaped because the key is a picomatch glob. A test fails
  // when this entry is missing or names another route.
  outputFileTracingIncludes: {
    "/api/projects/\\[projectId\\]/exports/\\[format\\]": ["./assets/fonts/**"],
    // The print files outline names and numbers from the same font.
    "/api/projects/\\[projectId\\]/print-files": ["./assets/fonts/**"],
    // Reading an uploaded PDF draws a page with pdfjs-dist and its native canvas package, which are loaded by name at
    // run time, so the host cannot see them in the code. Ship the canvas binaries and the PDF reader's own fonts.
    "/api/artwork": ["../../node_modules/.pnpm/@napi-rs+canvas{,-linux-x64-gnu}@*/node_modules/@napi-rs/canvas{,-linux-x64-gnu}/*.{js,cjs,mjs,json,node}", "./node_modules/pdfjs-dist/standard_fonts/**"],
  },
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    { source: "/api/projects/:projectId/exports/:format", headers: EXPORT_HEADERS },
    { source: "/s/:token", headers: SHARE_HEADERS },
  ],
};

export default nextConfig;
