"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ROLE_LABELS, isClubRole } from "@/lib/clubs/roles";

type Props = Readonly<{ invitations: readonly Readonly<{ id: string; brandName: string; role: string }>[] }>;

/** Invitations that name the signed-in person's own address. Accepting is the person's own choice. */
export function InvitationsForYou({ invitations }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  const accept = async (id: string) => {
    const reply = await call<{ brandId: string }>(`/api/club/invitations/${id}/accept`, "POST");
    if (!reply.ok) return setProblem(reply.message);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {invitations.map((invite) => (
        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-ink">{invite.brandName} invited you as {isClubRole(invite.role) ? ROLE_LABELS[invite.role] : invite.role}.</p>
          <Button variant="secondary" type="button" onClick={() => void accept(invite.id)}>Join</Button>
        </div>
      ))}
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
    </div>
  );
}
