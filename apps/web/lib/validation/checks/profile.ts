import type { Finding } from "@/lib/production/contract";
import { finding } from "../finding";
import type { FactoryProfile } from "../profile";
import type { DesignInput } from "../registry";

/** What the design needs from the factory profile. */
export function profileFindings(design: DesignInput, profile: FactoryProfile): readonly Finding[] {
  const article = profile.articles.find((a) => a.typeId === design.typeId);
  if (!article) {
    return [
      finding({
        code: "article-not-made",
        severity: "blocker",
        article: design.typeId,
        message: `Profile "${profile.name}" does not list this garment as one it makes.`,
        action: "Pick a garment the factory makes, or ask the factory to add it to its profile.",
        whoActs: "owner",
      }),
    ];
  }
  const open: Finding[] = [];
  if (article.moq.status === "not-set") {
    open.push(finding({ code: "moq-not-set", severity: "warning", article: design.typeId, message: "The minimum order for this garment is not set in the factory profile.", action: "Ask the factory for its minimum order.", whoActs: "factory" }));
  }
  if (profile.leadTimeDays.status === "not-set") {
    open.push(finding({ code: "lead-time-not-set", severity: "warning", message: "The factory profile has no lead time, so no delivery date can be given.", action: "Ask the factory for its lead time.", whoActs: "factory" }));
  }
  if (profile.priceLadder.status === "not-set") {
    open.push(finding({ code: "price-ladder-not-set", severity: "warning", message: "The factory profile has no price ladder, so no price can be given.", action: "Ask the factory for its prices by quantity.", whoActs: "factory" }));
  }
  return open;
}
