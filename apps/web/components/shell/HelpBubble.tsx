"use client";

import { MessageSquareText } from "lucide-react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { showsHelpBubble } from "@/lib/shell/help";

/**
 * The gold help bubble, bottom right (09 "Global shell"). There is no inbox yet, so it carries no
 * red unread dot: a dot with nothing behind it would be a promise. It opens a message to the team.
 * Not drawn on a phone, where Help is in the Menu, nor over a canvas, which has its own chrome.
 */
export function HelpBubble({ href }: Readonly<{ href: string }>) {
  const path = usePathname();
  if (!showsHelpBubble(path)) return null;
  return (
    <a
      href={href}
      aria-label="Message the Knitwright team"
      className="fixed right-6.5 bottom-6.5 z-40 hidden size-16 place-items-center rounded-full bg-gold text-navy shadow-e2 transition-colors duration-fast live:hover:bg-gold-2 md:grid"
    >
      <Icon icon={MessageSquareText} size={22} />
    </a>
  );
}
