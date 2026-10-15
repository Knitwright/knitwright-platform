import type { ReadinessItem } from "@/lib/production/contract";
import { listOf } from "../text";
import type { ArtworkAndColourSection } from "./types";

type Item = ReadinessItem;
export type ArtworkFacts = Pick<ArtworkAndColourSection, "images" | "picture" | "layers">;

const item = (id: string, whoActs: Item["whoActs"], met: boolean, whenMet: string, whenOpen: string): Item => ({
  id,
  whoActs,
  met,
  sentence: met ? whenMet : whenOpen,
});

const minimumOf = (note: string): string => note.match(/(\d+) dpi/)?.[1] ?? "150";

/** No placed picture below the print house's minimum resolution unless someone accepted it by name. */
function dpiItem(art: ArtworkFacts | undefined, imagesNote: string): Item {
  const images = art?.images ?? [];
  const min = minimumOf(imagesNote);
  const soft = images.filter((row) => row.result === "below" && row.acceptedBy.status !== "set");
  const unknown = images.filter((row) => row.result === "unknown");
  const softText = soft.map((row) => `${row.picture} (about ${row.dpi?.status === "set" ? row.dpi.number : "?"} dpi)`);
  const parts = [
    soft.length === 0 ? "" : `Use a larger file for ${listOf(softText)}, make it smaller on the shirt, or name the person who accepts it. The minimum is ${min} dpi.`,
    unknown.length === 0 ? "" : `The size of ${listOf(unknown.map((row) => row.layer))} is not on record, so its resolution is not known. Upload it again through the artwork upload.`,
  ].filter((part) => part !== "");
  return item(
    "print-image-dpi",
    "owner",
    soft.length === 0 && unknown.length === 0,
    images.length === 0 ? "No picture is placed in this design." : `Every placed picture meets the ${min} dpi minimum, or a named person accepted it.`,
    parts.join(" "),
  );
}

/** A design read from a picture shows the user's acceptance record. */
function pictureItem(art: ArtworkFacts | undefined): Item {
  const block = art?.picture ?? null;
  const by = block?.acceptedBy.status === "set" ? block.acceptedBy.value : "";
  const open =
    block !== null && block.acceptedBy.status === "set" && block.notAccepted.length > 0
      ? `The acceptance does not cover ${listOf(block.notAccepted)}. A named person accepts ${block.notAccepted.length === 1 ? "it" : "them"}.`
      : "A named person accepts the design read from a picture. No acceptance is on record.";
  return item(
    "print-picture-read",
    "owner",
    block === null || block.accepted,
    block === null ? "This design was not read from a picture." : `The design read from a picture was accepted by ${by}.`,
    open,
  );
}

export function artworkItems(art: ArtworkFacts | undefined, imagesNote: string): Item[] {
  return [dpiItem(art, imagesNote), pictureItem(art)];
}
