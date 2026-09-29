import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { renderSpikePdf } from "@/lib/flat/pdf-spike";

/**
 * The spike of plan step 7, kept until the first deployed preview has been checked.
 * It draws one small flat as a PDF, to prove the renderer runs inside the built app.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const started = Date.now();
    const bytes = await renderSpikePdf();
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "no-store",
        "x-render-milliseconds": String(Date.now() - started),
        "x-heap-used-mb": String(Math.round(process.memoryUsage().heapUsed / 1024 / 1024)),
        "x-rss-mb": String(Math.round(process.memoryUsage().rss / 1024 / 1024)),
      },
    });
  },
});
