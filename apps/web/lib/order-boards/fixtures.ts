import { TECH_PACK_PAGES } from "@/lib/techpack/exports/pages";
import { orderSummary, techPackSummary } from "./summary";
import type { OrderBoardsData } from "./types";

/**
 * Made-up Tech pack and Order board data for `/dev/canvas` and the tests (decision 0148): a tech
 * pack with one field waiting for input and a three-piece sample in production, as e20 and e21
 * show. Labelled made up; nothing reads it in production.
 */
export function madeUpOrderBoards(designId: string): OrderBoardsData {
  return {
    brandName: "Lahore Lions (made up)",
    canOrder: true,
    techPacks: {
      [designId]: techPackSummary({
        designProjectId: designId,
        designName: "Home kit v7",
        version: 7,
        pages: TECH_PACK_PAGES,
        counts: { from_base: 42, from_design: 18, needs_input: 1, confirmed: 0 },
        review: { exportBlocked: false, summary: "Nothing on this tab stops the export." },
      }),
    },
    orders: {
      [designId]: orderSummary([
        {
          id: "00000000-0000-4000-8000-0000000000a1",
          kind: "sample",
          sizes: { S: 1, M: 1, XL: 1 },
          pieces: 3,
          value: { minor: 11_700, currency: "GBP" },
          status: "in_production",
          readyOn: "2026-11-18",
          createdAt: "2026-11-04T09:00:00Z",
        },
      ]),
    },
  };
}
