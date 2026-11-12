"use client";

import { Package, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, ErrorState, NoPermission, PremiumGate } from "@/components/ui/PageStates";
import { useToast } from "@/components/ui/Toast";
import { Section } from "../frame";

const PANEL = "rounded-xl border border-border bg-bg";

export function StatesSection() {
  const toast = useToast();
  const [requested, setRequested] = useState(false);
  const upgrade = () => toast.show({ tone: "info", title: "The plan modal opens on Studio Pro" });
  return (
    <Section id="states" title="Page states">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={PANEL}>
          <EmptyState icon={<Icon icon={Package} size={22} />} title="No orders yet" action={<Button>Create your first kit</Button>}>
            Order samples from any design, and they appear here.
          </EmptyState>
        </div>
        <div className={PANEL}>
          <ErrorState requestId="req_7f3a9c21" onRetry={() => toast.show({ tone: "info", title: "Trying again" })}>
            We could not load your orders. Nothing was changed.
          </ErrorState>
        </div>
        <div className={PANEL}>
          <NoPermission owner="Ayesha Javed" requested={requested} onRequest={() => setRequested(true)} />
        </div>
        <div className={`${PANEL} flex flex-col items-center justify-center gap-3 p-8`}>
          <p className="text-body text-muted">Premium-gated: the control stays, with ♛.</p>
          <PremiumGate label="AI video board" plan="Studio Pro" icon={<Icon icon={Sparkles} />} onUpgrade={upgrade} />
        </div>
      </div>
    </Section>
  );
}
