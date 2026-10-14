import type { SupabaseClient } from "@supabase/supabase-js";

type Answer = { data?: unknown; error?: { code?: string; hint?: string | null; message: string } | null };

export interface Call {
  readonly kind: "from" | "rpc";
  readonly name: string;
  readonly steps: readonly (readonly [string, readonly unknown[]])[];
}

/**
 * A stand-in for a Supabase client in unit tests. `answers` maps a table or function name to what
 * it gives back, or to a function of the steps taken (so a test can answer one query differently).
 * Every call is recorded.
 */
export function fakeClient(answers: Readonly<Record<string, Answer | ((call: Call) => Answer)>>) {
  const calls: Call[] = [];
  const answer = (call: Call): { data: unknown; error: Answer["error"] } => {
    const given = answers[call.name];
    const resolved = typeof given === "function" ? given(call) : given;
    return { data: resolved?.data ?? null, error: resolved?.error ?? null };
  };
  const chain = (kind: Call["kind"], name: string, steps: Call["steps"] = []): unknown =>
    new Proxy(() => undefined, {
      get: (_t, prop: string) => {
        if (prop === "then") {
          const call: Call = { kind, name, steps };
          calls.push(call);
          return (resolve: (v: unknown) => void) => resolve(answer(call));
        }
        return (...args: unknown[]) => chain(kind, name, [...steps, [prop, args]]);
      },
    });
  const client = {
    from: (table: string) => chain("from", table),
    rpc: (name: string, args: unknown) => chain("rpc", name, [["args", [args]]]),
  } as unknown as SupabaseClient;
  return { client, calls };
}
