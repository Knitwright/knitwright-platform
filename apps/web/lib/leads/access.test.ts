import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { AppError } from "@/lib/server/core/errors";
import {
  ACCESS_REQUESTS_LISTED,
  accessRequestSchema,
  keepAccessRequest,
  loadAccessRequests,
  loggingAccessNotifier,
  saveAccessRequest,
  type AccessDeps,
  type AccessRequestInput,
} from "./access";

const ID = "7a1d0c3e-2b4f-4a6d-9e8c-1f2a3b4c5d6e";

const form = (patch: Record<string, unknown> = {}) => ({
  name: " Sam Lee ",
  email: " Sam@Northfield.ORG ",
  organisation: "Northfield FC",
  organisationType: "club",
  message: "We need 40 jerseys for next season.",
  [CAPTCHA_FIELD]: "passed-token",
  ...patch,
});

const input = (): AccessRequestInput => accessRequestSchema.parse(form());

const deps = (patch: Partial<AccessDeps> = {}): AccessDeps => ({
  botCheck: vi.fn(async () => "passed" as const),
  secret: "s3cret",
  address: "203.0.113.9",
  save: vi.fn(async () => ID),
  notify: vi.fn(async () => undefined),
  ...patch,
});

describe("accessRequestSchema", () => {
  it("tidies the name and the address, and keeps the rest", () => {
    expect(input()).toEqual({
      name: "Sam Lee",
      email: "sam@northfield.org",
      organisation: "Northfield FC",
      organisationType: "club",
      message: "We need 40 jerseys for next season.",
      [CAPTCHA_FIELD]: "passed-token",
    });
  });

  it("needs only a name, an address and the bot check", () => {
    const parsed = accessRequestSchema.parse({ name: "Sam", email: "sam@example.com", [CAPTCHA_FIELD]: "t" });
    expect(parsed).toMatchObject({ organisation: "", organisationType: null, message: "" });
    expect(accessRequestSchema.parse(form({ organisationType: "" })).organisationType).toBeNull();
  });

  it("refuses a missing name, a bad address, an unknown type and hidden characters, each beside its field", () => {
    const result = accessRequestSchema.safeParse(
      form({ name: "  ", email: "not an address", organisationType: "army", organisation: "A\u0007B", message: "Hi\u0000" }),
    );
    expect(result.success).toBe(false);
    const fields = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect(fields).toEqual(new Set(["name", "email", "organisationType", "organisation", "message"]));
  });

  it("refuses text that is too long, and a form without the bot check", () => {
    expect(accessRequestSchema.safeParse(form({ name: "x".repeat(81) })).success).toBe(false);
    expect(accessRequestSchema.safeParse(form({ message: "x".repeat(1001) })).success).toBe(false);
    expect(accessRequestSchema.safeParse(form({ [CAPTCHA_FIELD]: "" })).success).toBe(false);
  });
});

describe("keepAccessRequest", () => {
  it("checks the bot check, keeps the request without the token, and tells the team", async () => {
    const given = deps();

    await keepAccessRequest(given, input());

    expect(given.botCheck).toHaveBeenCalledWith({ secret: "s3cret", token: "passed-token", address: "203.0.113.9" });
    expect(given.save).toHaveBeenCalledWith({
      name: "Sam Lee",
      email: "sam@northfield.org",
      organisation: "Northfield FC",
      organisationType: "club",
      message: "We need 40 jerseys for next season.",
    });
    expect(given.notify).toHaveBeenCalledWith(ID);
  });

  it("keeps nothing when the check fails, and says so beside the check", async () => {
    const given = deps({ botCheck: vi.fn(async () => "failed" as const) });

    const error = await keepAccessRequest(given, input()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("invalid_input");
    expect((error as AppError).fields?.[CAPTCHA_FIELD]).toEqual(["The check did not pass. Try it again."]);
    expect(given.save).not.toHaveBeenCalled();
  });

  it("asks the person to try later when the check cannot be reached or is not set up", async () => {
    for (const given of [deps({ botCheck: vi.fn(async () => "unreachable" as const) }), deps({ secret: null })]) {
      await expect(keepAccessRequest(given, input())).rejects.toMatchObject({ code: "unavailable" });
      expect(given.save).not.toHaveBeenCalled();
    }
  });
});

describe("saveAccessRequest", () => {
  it("calls the database function with every field, an empty type for none", async () => {
    const rpc = vi.fn(async () => ({ data: ID, error: null }));
    const request = { name: "Sam", email: "sam@example.com", organisation: "", organisationType: null, message: "" };

    expect(await saveAccessRequest({ rpc } as unknown as SupabaseClient, request)).toBe(ID);
    expect(rpc).toHaveBeenCalledWith("request_access", {
      p_email: "sam@example.com",
      p_name: "Sam",
      p_organisation: "",
      p_organisation_type: "",
      p_message: "",
    });
  });

  it("turns a database failure into an error that hides the detail", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "XX000", message: "secret detail" } }));
    const request = { name: "Sam", email: "sam@example.com", organisation: "", organisationType: "club" as const, message: "" };

    const error = await saveAccessRequest({ rpc } as unknown as SupabaseClient, request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).not.toContain("secret detail");
  });
});

describe("loggingAccessNotifier", () => {
  it("logs the request's id only", async () => {
    const log = vi.fn();
    await loggingAccessNotifier(log)(ID);
    expect(log).toHaveBeenCalledWith({ level: "info", where: "access-request", message: `New access request ${ID}. See /admin/leads.` });
  });
});

describe("loadAccessRequests", () => {
  const query = (result: { data: unknown; error: unknown }) => {
    const chain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(async () => result),
    };
    return { client: { from: vi.fn(() => chain) } as unknown as SupabaseClient, chain };
  };

  it("reads the newest requests, and reads an unknown type as none", async () => {
    const { client, chain } = query({
      data: [
        {
          id: ID,
          email: "sam@example.com",
          name: "Sam",
          organisation: "Northfield FC",
          organisation_type: "army",
          message: "",
          created_at: "2026-10-13T09:00:00Z",
        },
      ],
      error: null,
    });

    expect(await loadAccessRequests(client)).toEqual([
      {
        id: ID,
        email: "sam@example.com",
        name: "Sam",
        organisation: "Northfield FC",
        organisationType: null,
        message: "",
        createdAt: "2026-10-13T09:00:00Z",
      },
    ]);
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(ACCESS_REQUESTS_LISTED);
  });

  it("reads no rows as an empty list, and fails on a database error", async () => {
    expect(await loadAccessRequests(query({ data: null, error: null }).client)).toEqual([]);
    await expect(loadAccessRequests(query({ data: null, error: { code: "XX000", message: "x" } }).client)).rejects.toBeInstanceOf(AppError);
  });
});
