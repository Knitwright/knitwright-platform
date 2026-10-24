"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { ASSIGNABLE_ROLES, ROLE_EXPLANATIONS, ROLE_LABELS, type AssignableRole } from "@/lib/clubs/roles";
import type { InvitationView, MemberView } from "./types";

type Props = Readonly<{ members: readonly MemberView[]; invitations: readonly InvitationView[]; me: string; canManage: boolean }>;

function RoleSelect({ value, label, disabled, onChange }: Readonly<{ value: string; label: string; disabled?: boolean; onChange: (role: AssignableRole) => void }>) {
  return (
    <select aria-label={label} className={`${FIELD_CONTROL} h-10`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as AssignableRole)}>
      {ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
    </select>
  );
}

/** Who belongs to the club and what each may do. Changing members needs the owner or an admin. */
export function MembersPanel({ members, invitations, me, canManage }: Props) {
  const router = useRouter();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("viewer");
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);

  const run = async (method: "POST" | "PUT" | "DELETE", url: string, body: unknown, done: string) => {
    const reply = await call(url, method, body);
    setNote(reply.ok ? { tone: "ok", text: done } : { tone: "warn", text: reply.message });
    if (reply.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-hairline">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-ink">{member.name}{member.userId === me ? " (you)" : ""}</p>
              <p className="text-[13px] text-muted">{ROLE_EXPLANATIONS[member.role]}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && member.role !== "owner" ? (
                <RoleSelect value={member.role} label={`Role of ${member.name}`} onChange={(next) => void run("PUT", `/api/club/members/${member.userId}`, { role: next }, "The role is changed.")} />
              ) : (
                <span className="rounded-full border border-hairline px-3 py-1 text-sm text-ink-2">{ROLE_LABELS[member.role]}</span>
              )}
              {(canManage && member.role !== "owner") || (member.userId === me && member.role !== "owner") ? (
                <Button variant="quiet" type="button" onClick={() => void run("DELETE", `/api/club/members/${member.userId}`, undefined, member.userId === me ? "You left the club." : "The member is removed.")}>
                  {member.userId === me ? "Leave" : "Remove"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {canManage ? (
        <>
          {invitations.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-ink">Waiting to join</h3>
              <ul className="mt-2 flex flex-col divide-y divide-hairline">
                {invitations.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-[15px] text-ink-2">{invite.email} · {ROLE_LABELS[invite.role as AssignableRole] ?? invite.role}</span>
                    <Button variant="quiet" type="button" onClick={() => void run("DELETE", `/api/club/invitations/${invite.id}`, undefined, "The invitation is cancelled.")}>Cancel</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run("POST", "/api/club/members", { email, role }, "Invited. They join when they sign in with that address and accept.").then(() => setEmail(""));
            }}
          >
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <label htmlFor={emailId} className="text-sm font-medium text-ink">Invite by email address</label>
              <input id={emailId} type="email" required className={FIELD_CONTROL} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <RoleSelect value={role} label="Role to give" onChange={setRole} />
            <Button variant="secondary" type="submit">Invite</Button>
          </form>
          <p className="text-[13px] text-muted">We do not send an email yet. Tell them to sign in with that address and open Club.</p>
        </>
      ) : null}
      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}
    </div>
  );
}
