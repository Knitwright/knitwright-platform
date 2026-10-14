import type { RosterRow } from "@/lib/production/contract";

const slug = (text: string): string => text.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

/** A safe file name stem for a piece: the size folder is added by the caller. Names never come from the player's text alone. */
export function fileStem(instanceId: string, player: RosterRow | null, transfer: boolean): string {
  const who = player ? `-${player.number}${slug(player.name) ? `-${slug(player.name)}` : ""}` : "";
  return `${instanceId}${who}${transfer ? "-transfer" : ""}`;
}

export const EXTENSIONS = { pdf: "pdf", svg: "svg", tiff: "tif" } as const;
