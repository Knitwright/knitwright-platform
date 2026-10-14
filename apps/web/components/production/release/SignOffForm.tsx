"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { call, projectUrl } from "../orders/call";

const ROLES = [
  { id: "pattern", label: "Pattern" },
  { id: "print", label: "Print" },
  { id: "production", label: "Production" },
  { id: "club", label: "Club" },
] as const;

type Props = Readonly<{ projectId: string; releaseId: string; onDone: () => void }>;

/** A person signs the release for a role. Their name and the date are kept with it for good. */
export function SignOffForm({ projectId, releaseId, onDone }: Props) {
  const [role, setRole] = useState<string>("print");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    const reply = await call<{ id: string }>(projectUrl(projectId, `releases/${releaseId}/sign-offs`), "POST", { role, name });
    setBusy(false);
    if (!reply.ok) return setProblem(Object.values(reply.fields).flat()[0] ?? reply.message);
    setName("");
    onDone();
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField name="sign-role" label="Signing for" options={ROLES} value={role} onChange={(e) => setRole(e.target.value)} />
        <Field name="sign-name" label="Name of the person signing" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} hint="Today's date is added. A signature cannot be changed or removed." />
      </div>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div><Button variant="secondary" pending={busy} disabled={busy || name.trim() === ""}>Sign</Button></div>
    </form>
  );
}
