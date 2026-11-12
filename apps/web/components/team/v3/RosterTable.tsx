import type { Route } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { StatusPill } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import type { RosterRow } from "@/lib/team/view";

/**
 * The roster table of Team (09 screen 17, d18): name on shirt, number, size, status, and for someone
 * not in yet a link to chase them through the sign-up link.
 */
export function RosterTable({
  rows,
  season,
  signupHref,
  editHref,
  canEdit,
}: Readonly<{ rows: readonly RosterRow[]; season: string | null; signupHref: Route; editHref: Route; canEdit: boolean }>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={Users} size={22} />}
        title={season ? `No players in ${season} yet` : "No season yet"}
        action={canEdit ? <LinkButton href={season ? editHref : ("/team?tab=seasons" as Route)}>{season ? "Add players" : "Make a season"}</LinkButton> : undefined}
      >
        {season ? "Add players one by one, import a CSV, or send your squad the sign-up link." : "A roster belongs to a season. Make one, then add its players."}
      </EmptyState>
    );
  }
  return (
    <Table caption={season ? `Roster ${season}` : "Roster"}>
      <thead>
        <tr>
          <Th>NAME ON SHIRT</Th>
          <Th>NUMBER</Th>
          <Th>SIZE</Th>
          <Th>STATUS</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.key}>
            <Td className="h-13 font-semibold">{row.shirtName}</Td>
            <Td className="tabular-nums">{row.number}</Td>
            <Td>{row.size}</Td>
            <Td>
              <StatusPill tone={row.tone}>{row.status}</StatusPill>
            </Td>
            <Td className="text-small">
              {row.waiting && canEdit ? (
                <Link href={signupHref} className="font-semibold text-link no-underline live:hover:underline">
                  Send a reminder<span className="sr-only"> to {row.shirtName}</span>
                </Link>
              ) : null}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
