"use client";

import { Copy, Ellipsis, FileDown, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Modal, type ModalSize } from "@/components/ui/Modal";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { Row, Section } from "../frame";

const ITEMS: readonly MenuEntry[] = [
  { id: "rename", label: "Rename", icon: <Icon icon={Pencil} />, shortcut: "F2" },
  { id: "duplicate", label: "Duplicate", icon: <Icon icon={Copy} />, shortcut: "Ctrl D" },
  { id: "share", label: "Share with", icon: <Icon icon={Share2} />, submenu: true },
  { id: "export", label: "Export PDF", icon: <Icon icon={FileDown} />, disabled: true },
  { id: "line", separator: true },
  { id: "delete", label: "Delete", icon: <Icon icon={Trash2} />, danger: true },
];

function Menus() {
  return (
    <Row label="Menu (Enter or ↓ opens; arrows, Home, End; Esc returns to the trigger) and compact menu">
      <Menu label="Project" items={ITEMS} />
      <Menu label="More actions" iconOnly variant="ghost" icon={<Icon icon={Ellipsis} />} items={ITEMS} />
      <Menu label="Zoom" compact size="sm" items={["Zoom to fit", "50%", "100%", "200%"].map((label) => ({ id: label, label }))} />
    </Row>
  );
}

function Popovers() {
  return (
    <Row label="Popover: Export 360 px, Share 400 px (Esc, a click outside, or the trigger closes it)">
      <Popover label="Export" width={360} align="start">
        {(close) => (
          <>
            <h3 className="text-title text-text">Export</h3>
            <p className="text-body text-muted">A print-ready PDF of every board, 3 mm bleed.</p>
            <Button onClick={close}>Download PDF</Button>
          </>
        )}
      </Popover>
      <Popover label="Share" width={400} align="start">
        <h3 className="text-title text-text">Share</h3>
        <Field name="invite" label="Invite by email" placeholder="coach@club.org" />
      </Popover>
    </Row>
  );
}

function ModalDemo({ size, label }: Readonly<{ size: ModalSize; label: string }>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setOpen(false);
    setName("");
  };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Rename design"
        size={size}
        dirty={name.length > 0}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button data-primary onClick={close}>
              Save
            </Button>
          </>
        }
      >
        <Field name="name" label="Name" value={name} onChange={(event) => setName(event.target.value)} hint="Type, then press Esc: it asks before discarding." />
      </Modal>
    </>
  );
}

function Toasts() {
  const toast = useToast();
  return (
    <Row label="Toasts: 4 s, held while hovered; an error is an alert with Retry">
      <Button variant="secondary" onClick={() => toast.show({ tone: "success", title: "Saved", body: "Home kit v7 is saved." })}>
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            tone: "error",
            title: "Generation failed",
            body: "Please try again later. No credits were used.",
            action: { label: "Retry", onAction: () => toast.show({ tone: "info", title: "Trying again" }) },
          })
        }
      >
        Error toast
      </Button>
      <Button variant="secondary" onClick={() => toast.show({ tone: "info", title: "Sample slot held until Mon 12:00 PKT" })}>
        Info toast
      </Button>
    </Row>
  );
}

export function OverlaysSection() {
  return (
    <Section id="overlays" title="Menus, popovers, modals, toasts">
      <Menus />
      <Popovers />
      <Row label="Modal: 480, 720, 960 px (focus is trapped; Esc closes)">
        <ModalDemo size="sm" label="Small modal" />
        <ModalDemo size="md" label="Medium modal" />
        <ModalDemo size="lg" label="Large modal" />
      </Row>
      <Toasts />
      <Row label="Tooltip (400 ms on hover, at once on focus)">
        <Tooltip content="Set by Knitwright QC after the golden sample">
          <Button variant="ghost">Hover me</Button>
        </Tooltip>
      </Row>
    </Section>
  );
}
