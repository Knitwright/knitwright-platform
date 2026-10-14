import type { ArtworkStack } from "@/lib/artwork-stack";

/**
 * A stand-in for the design reader (W7d) with a recorded reply: it returns the same design with every part marked as read
 * from a picture and each colour a little off, as a reading of a picture is. Phase B runs case 5 on the real reader.
 */
export function readFromPicture(truth: ArtworkStack): ArtworkStack {
  const nudge = (hex: string | undefined): string | undefined => {
    if (hex === undefined) return undefined;
    const n = Number.parseInt(hex.slice(1), 16);
    const bump = (v: number): number => Math.max(0, Math.min(255, v + 6));
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => bump(v).toString(16).padStart(2, "0")).join("")}`;
  };
  return {
    ...truth,
    colours: truth.colours.map((c) => ({ ...c, ...(c.screen === undefined ? {} : { screen: nudge(c.screen) }), provenance: "read-from-image" as const })),
    layers: truth.layers.map((l) => ({ ...l, provenance: "read-from-image" as const })),
  };
}
