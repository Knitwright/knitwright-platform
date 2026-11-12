"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Inputs";
import { Td, Tr } from "@/components/ui/Table";
import type { QuoteBasket } from "@/lib/order-desk/views";

export type SportQuote = Readonly<{ id: string; label: string; href: string }>;

/**
 * One quote the brand can download (spec F-T5). Nothing stores a quote: the PDF is built from the
 * basket when the link is pressed, priced again from today's tiers (decision 0106). A quote names its
 * sport, which neither a plan nor an order records, so the person chooses it here. The page makes
 * each sport's address on the server, so this row carries no parser.
 */
export function QuoteRow({ basket, sports }: Readonly<{ basket: QuoteBasket; sports: readonly SportQuote[] }>) {
  const id = useId();
  const [sport, setSport] = useState<string>(sports[0]?.id ?? "");
  const href = sports.find((one) => one.id === sport)?.href ?? "";
  return (
    <Tr>
      <Td className="font-semibold text-text">{basket.title}</Td>
      <Td>{basket.source}</Td>
      <Td numeric>{basket.pieces}</Td>
      <Td>{basket.currency}</Td>
      <Td>
        <label htmlFor={id} className="sr-only">
          Sport for the quote of {basket.title}
        </label>
        <Select id={id} value={sport} onChange={(event) => setSport(event.target.value)} className="w-40">
          {sports.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        {basket.lines.length === 0 || href === "" ? (
          <span className="text-small text-muted">No style has a catalogue article to price.</span>
        ) : (
          <a href={href} download className={buttonClasses("secondary", false, "no-underline", "sm")}>
            <Icon icon={Download} size={16} />
            Download quote
          </a>
        )}
      </Td>
    </Tr>
  );
}
