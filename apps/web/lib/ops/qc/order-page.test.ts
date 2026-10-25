import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const loadOrder = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("@/lib/server/deps", () => ({ sessionClient: async () => ({ me: "client" }) }));
vi.mock("../service", () => ({ loadOrder: (...a: unknown[]) => loadOrder(...a) }));

import { loadOrderOrNotFound } from "./order-page";

const ID = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";

beforeEach(() => {
  notFound.mockClear();
  loadOrder.mockReset();
});

describe("loadOrderOrNotFound", () => {
  it("answers not found for something that is not an order id, without touching the database", async () => {
    await expect(loadOrderOrNotFound("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadOrder).not.toHaveBeenCalled();
  });

  it("answers not found for an order that does not exist", async () => {
    loadOrder.mockRejectedValue(new AppError("not_found", "gone"));
    await expect(loadOrderOrNotFound(ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lets any other failure through", async () => {
    loadOrder.mockRejectedValue(new AppError("internal", "boom"));
    await expect(loadOrderOrNotFound(ID)).rejects.toMatchObject({ code: "internal" });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hands back the client and the order", async () => {
    loadOrder.mockResolvedValue({ order: { id: ID }, events: [] });
    expect(await loadOrderOrNotFound(ID)).toMatchObject({ client: { me: "client" }, order: { id: ID } });
  });
});
