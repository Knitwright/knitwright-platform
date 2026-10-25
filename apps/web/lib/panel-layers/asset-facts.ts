import type { ArtworkStack, AssetReader } from "@/lib/artwork-stack";
import type { AssetFacts } from "./guardrail-input";

/** The kind and pixel width of each uploaded picture that a graphic layer uses. A picture that cannot be read is left out, never guessed. */
export async function assetFactsFor(stack: ArtworkStack, reader: AssetReader): Promise<AssetFacts> {
  const ids = [...new Set(stack.layers.flatMap((layer) => (layer.kind === "graphic" && layer.source.kind === "asset" ? [layer.source.assetId] : [])))];
  const found = await Promise.all(ids.map((id) => reader.getAsset(id).then((asset) => [id, asset] as const, () => [id, null] as const)));
  return Object.fromEntries(found.flatMap(([id, asset]) => (asset === null ? [] : [[id, { kind: asset.kind, widthPx: asset.widthPx }]])));
}
