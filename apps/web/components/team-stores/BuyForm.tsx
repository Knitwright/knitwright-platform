"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Select, TextInput } from "@/components/ui/Inputs";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { formatMoney } from "@/lib/factory/pricing";
import { buyFromStoreAction } from "@/lib/team-stores/actions";
import { MAX_PIECES_PER_ORDER } from "@/lib/team-stores/model";

export type BuyFormStore = Readonly<{
  code: string;
  currency: "GBP" | "AUD";
  pieceMinor: number;
  sizes: readonly string[];
  namesNumbers: boolean;
  nameMax: number;
  numberMin: number;
  numberMax: number;
}>;

type Piece = Readonly<{ size: string; name: string; number: string }>;

const LABEL = "flex flex-col gap-1 text-small text-text";

/**
 * A player's or parent's order from a team store (spec F-T6 "buy from a short link or QR code without an account",
 * acceptance "a parent checks out in under 2 minutes on a phone"). Per piece: a size and, where the store prints
 * them, a shirt name and number. Then a name and an email for the receipt and any refund, the bot check, and Pay,
 * which opens the card checkout. Nothing else is asked (decision 0136).
 */
export function BuyForm({ store, siteKey }: Readonly<{ store: BuyFormStore; siteKey: string }>) {
  const { form, state, onSubmit, pending, summary, fieldErrors } = useSendForm(buyFromStoreAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const [pieces, setPiecesNow] = useState<readonly Piece[]>([{ size: "", name: "", number: "" }]);
  const base = useId();
  // One key per order as it stands: a changed order is a new payment, a second press of the same one is not.
  const key = useRef<string | null>(null);
  const setPieces = (next: (all: readonly Piece[]) => readonly Piece[]) => {
    key.current = null;
    setPiecesNow(next);
  };
  const lines = JSON.stringify(pieces);
  const reply = state.result;

  useEffect(() => {
    if (reply?.success) window.location.assign(reply.data.url);
  }, [reply]);

  const change = (index: number, patch: Partial<Piece>) => setPieces((all) => all.map((piece, at) => (at === index ? { ...piece, ...patch } : piece)));

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        guard(event);
        key.current ??= crypto.randomUUID();
        const field = event.currentTarget.elements.namedItem("requestKey");
        if (field instanceof HTMLInputElement) field.value = key.current;
        void onSubmit(event);
      }}
      className="flex flex-col gap-5"
      noValidate
      aria-label="Your order"
    >
      <FormSummary message={summary} />
      <input type="hidden" name="code" value={store.code} />
      <input type="hidden" name="requestKey" defaultValue="" />
      <input type="hidden" name="lines" value={lines} />
      <ol className="flex flex-col gap-3">
        {pieces.map((piece, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="store-piece">
            <div className="flex items-center justify-between">
              <span className="text-small font-semibold text-text">Piece {index + 1}</span>
              {pieces.length > 1 ? (
                <Button variant="ghost" size="xs" icon={<Icon icon={X} size={14} />} onClick={() => setPieces((all) => all.filter((_, at) => at !== index))}>
                  Remove
                </Button>
              ) : null}
            </div>
            <label htmlFor={`${base}-size-${index}`} className={LABEL}>
              Size
              <Select id={`${base}-size-${index}`} value={piece.size} required onChange={(event) => change(index, { size: event.target.value })}>
                <option value="">Choose a size</option>
                {store.sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </label>
            {store.namesNumbers ? (
              <div className="grid grid-cols-3 gap-2">
                <label htmlFor={`${base}-name-${index}`} className={`${LABEL} col-span-2`}>
                  Name on the back
                  <TextInput id={`${base}-name-${index}`} value={piece.name} maxLength={store.nameMax} autoCapitalize="characters" onChange={(event) => change(index, { name: event.target.value })} />
                </label>
                <label htmlFor={`${base}-number-${index}`} className={LABEL}>
                  Number
                  <TextInput id={`${base}-number-${index}`} value={piece.number} inputMode="numeric" maxLength={3} onChange={(event) => change(index, { number: event.target.value.replace(/\D/g, "") })} />
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {store.namesNumbers ? (
        <p className="text-caption text-muted">
          Names up to {store.nameMax} characters; numbers {store.numberMin} to {store.numberMax}. Leave them empty for a plain shirt.
        </p>
      ) : null}
      {fieldErrors("lines").map((error) => (
        <p key={error} className="text-small text-bad" role="alert">
          {error}
        </p>
      ))}
      {pieces.length < MAX_PIECES_PER_ORDER ? (
        <Button variant="secondary" size="sm" icon={<Icon icon={Plus} />} className="self-start" onClick={() => setPieces((all) => [...all, { size: "", name: "", number: "" }])}>
          Add another piece
        </Button>
      ) : null}
      <Field name="buyerName" label="Your name" hint="For the receipt." autoComplete="name" maxLength={80} required defaultValue={state.values.name} errors={fieldErrors("buyerName")} />
      <Field name="buyerEmail" label="Your email" hint="The receipt goes here, and we write here if the order is refunded." type="email" autoComplete="email" maxLength={254} required errors={fieldErrors("buyerEmail")} />
      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending || Boolean(reply?.success)}>
        {`Pay ${formatMoney(store.pieceMinor * pieces.length, store.currency)}`}
      </Button>
    </form>
  );
}
