import { describe, expect, it } from "vitest";
import { nextStep, replyOf, sendLabel, sentNote } from "./reply";

describe("what an order door answers the browser", () => {
  it("is the checkout to go to", () => {
    const reply = replyOf({ kind: "checkout", paymentId: "p", url: "https://checkout.stripe.com/x" });
    expect(reply).toEqual({ kind: "checkout", url: "https://checkout.stripe.com/x" });
    expect(nextStep(reply)).toBe("https://checkout.stripe.com/x");
  });

  it("or the orders sent, with any refusals, in words that start 'Sent to production'", () => {
    const reply = replyOf({
      kind: "sent",
      paymentId: "p",
      fulfilment: {
        paymentId: "p",
        status: "fulfilled",
        lines: [
          { lineId: "a", status: "submitted", orderId: "o", message: null },
          { lineId: "b", status: "refused", orderId: null, message: "Blockers." },
        ],
      },
    });
    expect(reply).toEqual({ kind: "sent", sent: 1, refused: "Blockers." });
    expect(nextStep(reply)).toBeNull();
    if (reply.kind !== "sent") return;
    expect(sentNote(reply)).toBe("Sent to production: 1 order, waiting for the next cut-off. No price is on file yet, so Knitwright invoices it. Not sent: Blockers.");
    expect(sentNote({ kind: "sent", sent: 2, refused: null })).toMatch(/^Sent to production: 2 orders, waiting/);
  });

  it("labels the button Checkout only when there is a price to pay", () => {
    expect(sendLabel(true, "Send the sample request")).toBe("Checkout");
    expect(sendLabel(false, "Send the sample request")).toBe("Send the sample request");
  });
});
