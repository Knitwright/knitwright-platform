import { describe, expect, it } from "vitest";
import type { Result } from "@/lib/server/core/errors";
import { nextFormState } from "./form-state";
import { canSend, initialSendState, sendReducer, type SendEvent, type SendState } from "./send-state";

type Answer = Readonly<{ id: string }>;

const run = (events: readonly SendEvent<Answer>[], from: SendState<Answer> = initialSendState<Answer>()) =>
  events.reduce(sendReducer<Answer>, from);

const answered = (result: Result<Answer>, attempt = 1): SendEvent<Answer> => ({
  type: "answered",
  form: { result, attempt, values: { name: "Sam" } },
});

const ok = answered({ success: true, data: { id: "q1" } });
const refused = answered({ success: false, error: { code: "invalid_input", message: "Some fields need another look." } });

describe("a form sent once", () => {
  it("can be sent at first", () => {
    expect(canSend(initialSendState())).toBe(true);
  });

  it("cannot be sent again while it is on its way", () => {
    const sending = run([{ type: "send" }]);

    expect(sending.phase).toBe("sending");
    expect(canSend(sending)).toBe(false);
    expect(run([{ type: "send" }], sending)).toBe(sending);
  });

  it("shows that it was sent as soon as the server answers, and cannot be sent again", () => {
    const sent = run([{ type: "send" }, ok]);

    expect(sent.phase).toBe("sent");
    expect(sent.form.result).toEqual({ success: true, data: { id: "q1" } });
    expect(canSend(sent)).toBe(false);
    expect(run([{ type: "send" }], sent)).toBe(sent);
  });

  it("can be sent again after a refusal, and keeps what was typed", () => {
    const failed = run([{ type: "send" }, refused]);

    expect(failed.phase).toBe("failed");
    expect(failed.form.values).toEqual({ name: "Sam" });
    expect(canSend(failed)).toBe(true);
    expect(run([{ type: "send" }], failed).phase).toBe("sending");
  });

  it("ignores an answer when nothing was sent", () => {
    const state = initialSendState<Answer>();

    expect(run([ok], state)).toBe(state);
  });

  it("ends in 'sent' when the action saved, even when the page is still being drawn again", async () => {
    // The action answers. Whatever the page does next, the answer alone decides the state.
    const action = async (): Promise<Result<Answer>> => ({ success: true, data: { id: "q2" } });
    const form = await nextFormState(initialSendState<Answer>().form, new FormData(), action, () => undefined);

    expect(run([{ type: "send" }, { type: "answered", form }]).phase).toBe("sent");
  });

  it("ends in 'failed', not 'sending', when the server cannot be reached", async () => {
    const action = async (): Promise<Result<Answer>> => {
      throw new Error("fetch failed");
    };
    const form = await nextFormState(initialSendState<Answer>().form, new FormData(), action, () => undefined);
    const state = run([{ type: "send" }, { type: "answered", form }]);

    expect(state.phase).toBe("failed");
    expect(canSend(state)).toBe(true);
  });
});
