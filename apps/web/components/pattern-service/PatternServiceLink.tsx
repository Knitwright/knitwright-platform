import type { Route } from "next";
import Link from "next/link";

/** The entry to the pattern service from the factory file. Shown only for a garment that has no pattern yet. */
export function PatternServiceLink({ projectId }: Readonly<{ projectId: string }>) {
  return (
    <p className="mt-4 text-[15px] text-ink-2">
      No pattern for this garment yet?{" "}
      <Link href={`/studio/${projectId}/pattern-service` as Route} className="underline">Ask the Sialkot team for one</Link>.
    </p>
  );
}
