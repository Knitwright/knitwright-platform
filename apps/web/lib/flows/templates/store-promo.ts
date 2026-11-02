import { FLOW_GAP_RULE, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Team store promo" (`07`): a kit the club has a golden sample for -> order-now post and story ->
 * size reminder -> last-chance story. **6 assets.**
 *
 * `07` names four steps and six assets, so two of the steps make two things. This pack reads it as
 * a hanger mockup to carry the posts, an order-now post and story, a size reminder card and post,
 * and a last-chance story. A labelled default with an owner question (decision 0096).
 */

const SECTIONS = ["1 PICK YOUR KIT", "2 ORDER NOW", "3 REMINDERS"] as const;

export const TEAM_STORE_PROMO: FlowTemplateSpec = {
  slug: "team-store-promo",
  title: "Team store promo",
  lead: "The run a club does when the store opens: order now, a size reminder, and a last chance before it closes.",
  sections: [...SECTIONS],
  assets: 6,
  sort: 3,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Team store promo",
    "Six outputs, every one free: the platform draws the kit and builds the posts around it. Run it once when the store opens and again before it closes.",
  ),
  steps: [
    designStep(SECTIONS[0], "The kit you have a golden sample for", SWAP_NOTE),
    step({
      key: "hanger",
      section: SECTIONS[0],
      kind: "mockup",
      name: "Kit on a hanger",
      settings: { scene: "hanger", aspect: "1:1" },
      feeds: ["design"],
      note: "The one picture the four posts are built around.",
    }),
    step({
      key: "order-post",
      section: SECTIONS[1],
      kind: "marketing",
      name: '"Order now" post',
      settings: { campaign: "team-store-open", aspect: "1:1", headline: "Order now", copy: "" },
      feeds: ["hanger"],
      note: "Text comes from your brand's headline and body styles.",
    }),
    step({
      key: "order-story",
      section: SECTIONS[1],
      kind: "marketing",
      name: '"Order now" story',
      settings: { campaign: "team-store-open", aspect: "9:16", headline: "Order now", copy: "" },
      feeds: ["hanger"],
    }),
    step({
      key: "size-card",
      section: SECTIONS[2],
      kind: "info_card",
      name: "Size reminder card",
      settings: { card: "size_chart", aspect: "1:1" },
      feeds: ["design"],
      note: "Read from the factory file and the catalogue, so the numbers are the garment's own.",
    }),
    step({
      key: "size-post",
      section: SECTIONS[2],
      kind: "marketing",
      name: '"Check your size" post',
      settings: { campaign: "team-store-open", aspect: "4:5", headline: "Check your size", copy: "" },
      feeds: ["size-card"],
    }),
    step({
      key: "last-chance",
      section: SECTIONS[2],
      kind: "marketing",
      name: '"Last chance" story',
      settings: { campaign: "last-chance", aspect: "9:16", headline: "Last chance", copy: "" },
      feeds: ["hanger"],
      note: EXPORT_NOTE,
    }),
  ],
};
