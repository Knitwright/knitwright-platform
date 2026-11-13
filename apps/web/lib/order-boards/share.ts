/**
 * The Share popover's own words (plan v6 E4, decision 0148; `08` v3.6 "Share › Invite").
 *
 * The Knitwright factory desk is a fixed member row, not an invite: no account of a factory is ever
 * added to a brand. What it sees is the tech pack of a version an order hands to production, through
 * the order itself (`submit_order_for_production`) -- never the canvas, the artwork files or the
 * brand's other designs.
 */
export const FACTORY_DESK = {
  name: "Knitwright factory desk",
  access: "Tech pack only",
  note: "Sees the tech pack of a version once you order it. Nothing else on this canvas.",
} as const;

export const PRESENTATION_LATER = "Presentation mode is not built yet. A share link shows the design to people without an account today.";

export const PUBLISH_LATER =
  "Publishing a copy of your design to the community, so others can use and change it, is not built yet. When it is, your production files and tech pack stay private.";
