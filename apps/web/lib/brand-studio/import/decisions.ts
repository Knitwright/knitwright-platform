/**
 * What the person said about each row, and the one gate every picture passes through.
 *
 * **The rights tick is the whole of this file's reason to exist.** The spec allows exactly one
 * third-party byte to be kept: a product photo of the brand's **own**, stored as their own upload,
 * and only behind an explicit tick recorded with the file. So `uploadsFor` returns nothing at all
 * while the tick is false — not fewer uploads, none — and the tick cannot be set by accident
 * because a proposal is born with `ticked: false` and only `tickRights` changes it.
 *
 * No zod and no `sharp` here: the screen reduces its own state with these functions.
 */

import type { Decision, ImportItem, ImportProposal, ItemKind, PictureFacts, UploadIntent } from "./types";
import { itemId, pictureLabel } from "./items";

/** One row's decision changed. Every other row, and the tick, are left exactly as they were. */
export const decide = (proposal: ImportProposal, id: string, decision: Decision): ImportProposal => ({
  ...proposal,
  items: proposal.items.map((item) => (item.id === id ? { ...item, decision } : item)),
});

/** Every row of one kind at once, for the "Keep all 6 colours" shortcut above a group. */
export const decideKind = (proposal: ImportProposal, kind: ItemKind, decision: Decision): ImportProposal => ({
  ...proposal,
  items: proposal.items.map((item) => (item.kind === kind ? { ...item, decision } : item)),
});

/** The tick beside the pictures. Never ticked for the person, and never ticked by an import. */
export const tickRights = (proposal: ImportProposal, ticked: boolean): ImportProposal => ({ ...proposal, rights: { ...proposal.rights, ticked } });

export const itemsOfKind = (proposal: ImportProposal, kind: ItemKind): readonly ImportItem[] => proposal.items.filter((item) => item.kind === kind);

export const acceptedIds = (proposal: ImportProposal, kind: ItemKind): ReadonlySet<string> =>
  new Set(itemsOfKind(proposal, kind).filter((item) => item.decision === "accepted").map((item) => item.id));

export const countOf = (proposal: ImportProposal, decision: Decision): number => proposal.items.filter((item) => item.decision === decision).length;

/** The pictures of one kind the person kept. Facts only: no bytes have been read since the run. */
export const acceptedPictures = (proposal: ImportProposal, kind: "logo" | "graphic"): readonly PictureFacts[] => {
  const kept = acceptedIds(proposal, kind);
  const from = kind === "logo" ? proposal.logos : proposal.graphics;
  return from.filter((facts) => kept.has(itemId(kind, facts.url)));
};

/**
 * The label an upload is offered under. It is read from the facts by the same function that built
 * the row, so the name on the screen and the name on the file are one and cannot drift apart.
 */
const labelFor = (facts: PictureFacts): string => pictureLabel(facts);

/**
 * The pictures to fetch once more and hand to `lib/storage/store.ts` as the brand's own uploads.
 *
 * Nothing comes back while the rights box is unticked, whatever the person accepted, and the tick
 * they gave is carried on every intent: who ticked, when, and the version of the words they saw —
 * the same record `lib/storage/rights.ts` writes for every other artwork upload.
 */
export function uploadsFor(proposal: ImportProposal, userId: string, now: Date): readonly UploadIntent[] {
  if (!proposal.rights.ticked) return [];
  const rights = { confirmedBy: userId, confirmedAt: now.toISOString(), wordingVersion: proposal.rights.wordingVersion };
  const of = (kind: "logo" | "graphic"): readonly UploadIntent[] =>
    acceptedPictures(proposal, kind).map((facts) => ({
      url: facts.url,
      assetKind: kind,
      label: labelFor(facts),
      contentType: facts.contentType,
      rights,
    }));
  return [...of("logo"), ...of("graphic")];
}

/** Why the uploads are empty, in words, so a screen never shows a silent nothing. */
export const whyNoUploads = (proposal: ImportProposal): string | null => {
  const kept = acceptedPictures(proposal, "logo").length + acceptedPictures(proposal, "graphic").length;
  if (kept === 0) return "No picture is being kept, so nothing will be uploaded.";
  if (!proposal.rights.ticked) return proposal.rights.ask;
  return null;
};
