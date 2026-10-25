import { describe, expect, it } from "vitest";
import { acceptSubmissionSchema, enrolSchema, newSubmissionSchema, payoutStateSchema, rejectSubmissionSchema, sendSubmissionSchema } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("enrolSchema", () => {
  it("trims the name and refuses an empty or long one, in words", () => {
    expect(enrolSchema.parse({ displayName: "  Ada  " })).toEqual({ displayName: "Ada" });
    expect(message(enrolSchema.safeParse({ displayName: "  " }))).toBe("Give the name to show on your templates.");
    expect(message(enrolSchema.safeParse({}))).toBe("Give the name to show on your templates.");
    expect(message(enrolSchema.safeParse({ displayName: "x".repeat(81) }))).toBe("Use 80 characters or fewer.");
  });
});

describe("newSubmissionSchema", () => {
  const ok = { projectId: ID, title: " Navy hoops ", sport: "football", style: "hoops", colourFamily: "blue" };

  it("accepts a design with a title, sport, style and colour", () => {
    expect(newSubmissionSchema.parse(ok)).toMatchObject({ title: "Navy hoops", sport: "football" });
  });

  it("refuses each missing or unlisted part, in words", () => {
    expect(message(newSubmissionSchema.safeParse({ ...ok, projectId: "x" }))).toBe("Choose one of your designs.");
    expect(message(newSubmissionSchema.safeParse({ ...ok, title: "" }))).toBe("Give the template a title.");
    expect(message(newSubmissionSchema.safeParse({ ...ok, title: "x".repeat(121) }))).toBe("Use 120 characters or fewer.");
    expect(message(newSubmissionSchema.safeParse({ ...ok, sport: "golf" }))).toBe("Choose a sport.");
    expect(message(newSubmissionSchema.safeParse({ ...ok, style: "zigzag" }))).toBe("Choose a style.");
    expect(message(newSubmissionSchema.safeParse({ ...ok, colourFamily: "pink" }))).toBe("Choose the main colour.");
  });
});

describe("sendSubmissionSchema", () => {
  it("needs the rights box ticked", () => {
    expect(sendSubmissionSchema.safeParse({ submissionId: ID, rightsAttested: "on" }).success).toBe(true);
    expect(message(sendSubmissionSchema.safeParse({ submissionId: ID }))).toMatch(/Tick the box/);
    expect(message(sendSubmissionSchema.safeParse({ submissionId: ID, rightsAttested: "off" }))).toMatch(/Tick the box/);
    expect(message(sendSubmissionSchema.safeParse({ submissionId: "no", rightsAttested: "on" }))).toBe("Choose a submission.");
  });
});

describe("the admin schemas", () => {
  it("accept names a submission", () => {
    expect(acceptSubmissionSchema.safeParse({ submissionId: ID }).success).toBe(true);
    expect(acceptSubmissionSchema.safeParse({ submissionId: "no" }).success).toBe(false);
  });

  it("reject needs a reason", () => {
    expect(rejectSubmissionSchema.parse({ submissionId: ID, reason: " Artwork is not theirs " }).reason).toBe("Artwork is not theirs");
    expect(message(rejectSubmissionSchema.safeParse({ submissionId: ID, reason: "" }))).toBe("Say why.");
    expect(message(rejectSubmissionSchema.safeParse({ submissionId: ID, reason: "x".repeat(501) }))).toBe("Use 500 characters or fewer.");
  });

  it("a payout state is one of three, with an optional short note", () => {
    expect(payoutStateSchema.parse({ designerId: ID, state: "on_hold" })).toEqual({ designerId: ID, state: "on_hold", note: "" });
    expect(message(payoutStateSchema.safeParse({ designerId: ID, state: "sent" }))).toBe("Choose a state.");
    expect(message(payoutStateSchema.safeParse({ designerId: ID, state: "paid", note: "x".repeat(301) }))).toBe("Use 300 characters or fewer.");
  });
});
