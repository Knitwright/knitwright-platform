import { AppError, MESSAGES } from "@/lib/server/core/errors";

export type BenchmarkDatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_cards: "A comparison holds 5 cards at most.",
  already_confirmed: "That card has already been confirmed.",
  append_only: "A benchmark's fetch record can never be changed or removed.",
  rate_limited: "This brand has read as many competitor pages as it may for now.",
  invalid_card: "That card is not in the shape a benchmark card takes.",
};

/** What the benchmark functions refuse with, in words. Another brand's row is simply not found. */
export function benchmarkFailure(error: BenchmarkDatabaseError): AppError {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (error.hint === "rate_limited") return new AppError("rate_limited", CONFLICTS.rate_limited as string);
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", "That benchmark could not be found.");
    case "42501":
      return new AppError("forbidden", "You may not change this brand's benchmarks.");
    case "22023":
    case "23505":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
}
