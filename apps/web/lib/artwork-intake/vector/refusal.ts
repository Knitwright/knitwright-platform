import { AppError } from "@/lib/server/core/errors";
import { SVG_REFUSALS, type SvgRefusal } from "../messages";

/** An SVG that is not taken in. The message says what was found; nothing has been stored. */
export class SvgRefused extends AppError {
  constructor(readonly reason: SvgRefusal) {
    super("invalid_input", SVG_REFUSALS[reason]);
    this.name = "SvgRefused";
  }
}

export const refuse = (reason: SvgRefusal): never => {
  throw new SvgRefused(reason);
};
