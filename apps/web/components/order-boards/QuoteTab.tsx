"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Checkbox, Select, TextInput } from "@/components/ui/Inputs";
import { QUOTE_MAX_PIECES, QUOTE_SPORTS, quoteLink } from "@/lib/order-boards/canvas";

/**
 * The Order drawer's Quote PDF tab (screen 13: "Quote: download PDF"; spec F-T5). The quote is the
 * Orders area's own document (`/api/quotes`, decision 0106): built when the link is pressed, priced
 * again on the server from the factory's tiers, never stored.
 */
export function QuoteTab({ articleCode, designName }: Readonly<{ articleCode: string | null; designName: string }>) {
  const ids = { sport: useId(), pieces: useId(), market: useId() };
  const [sport, setSport] = useState(QUOTE_SPORTS[0]?.id ?? "football");
  const [market, setMarket] = useState("GBP");
  const [pieces, setPieces] = useState("20");
  const [names, setNames] = useState(false);
  const href = quoteLink({ sportId: sport, currency: market, articleCode, pieces: Number(pieces), names });

  if (articleCode === null) {
    return <p className="text-small text-muted">{designName} has no catalogue article yet, so there is nothing a quote can price.</p>;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="order-drawer-quote">
      <div className="grid grid-cols-3 gap-2">
        <label htmlFor={ids.sport} className="flex flex-col gap-1 text-small text-text">
          Sport
          <Select id={ids.sport} value={sport} onChange={(event) => setSport(event.target.value)}>
            {QUOTE_SPORTS.map((one) => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor={ids.pieces} className="flex flex-col gap-1 text-small text-text">
          Pieces
          <TextInput id={ids.pieces} inputMode="numeric" value={pieces} onChange={(event) => setPieces(event.target.value.replace(/\D/g, "").slice(0, 5))} />
        </label>
        <label htmlFor={ids.market} className="flex flex-col gap-1 text-small text-text">
          Market
          <Select id={ids.market} value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="GBP">GBP</option>
            <option value="AUD">AUD</option>
          </Select>
        </label>
      </div>
      <Checkbox label="Names and numbers" checked={names} onChange={(event) => setNames(event.target.checked)} />
      <p className="text-caption text-muted">
        {articleCode}, priced from today&apos;s tiers. Valid for 30 days; nothing is stored.
      </p>
      {href === null ? (
        <p className="text-small text-warn" role="alert">
          Type a number of pieces from 1 to {QUOTE_MAX_PIECES}.
        </p>
      ) : (
        <a href={href} download className={buttonClasses("primary", false, "")} data-testid="order-drawer-quote-download">
          <Icon icon={Download} size={16} />
          Download quote PDF
        </a>
      )}
    </div>
  );
}
