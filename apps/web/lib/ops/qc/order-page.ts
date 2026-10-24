import { notFound } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { loadOrder } from "../service";

/** What every order sub-page starts with: a real order id, the person's own client, and "not found" for anything else. */
export async function loadOrderOrNotFound(rawId: string) {
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) notFound();
  const client = await sessionClient();
  const loaded = await loadOrder(client, parsed.data).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  });
  return { client, ...loaded };
}
