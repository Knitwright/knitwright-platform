import { useEffect, useState } from "react";
import { call } from "./call";

type State<T> = Readonly<{ data: T | null; problem: string | null }>;

/** Reads one address and again whenever `reload` is called. The answer arrives after the page is drawn. */
export function useRemote<T>(url: string): Readonly<State<T> & { reload: () => void }> {
  const [state, setState] = useState<State<T>>({ data: null, problem: null });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    void call<T>(url, "GET").then((reply) => {
      if (current) setState(reply.ok ? { data: reply.data, problem: null } : { data: null, problem: reply.message });
    });
    return () => {
      current = false;
    };
  }, [url, round]);

  return { ...state, reload: () => setRound((n) => n + 1) };
}
