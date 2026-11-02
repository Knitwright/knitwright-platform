"use client";

import { useId, useState, type MouseEvent } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { committeePinAction } from "@/lib/share/committee/actions";
import { NAME_MAX, PIN_MAX } from "@/lib/share/committee/fields";
import { PIN_PLACES, pinStyle, pointOfPlace, pointOfPress, placeOfPoint, type PinPlaceId, type PointBounds } from "@/lib/share/committee/points";
import type { CommitteeOption } from "@/lib/share/committee/public-view";

type PinFormProps = Readonly<{ token: string; option: CommitteeOption; siteKey: string }>;

const DEFAULT_PLACE: PinPlaceId = "middle-centre";

const placeOf = (id: PinPlaceId) => PIN_PLACES.find((place) => place.id === id) ?? PIN_PLACES[4];

/**
 * A comment pinned to a point on a panel (spec F-T3). The point can be put down two ways and they
 * always agree: press the drawing, or choose one of nine named places, which a keyboard reaches.
 * The panel is chosen by name, because a drawing is a picture on this page and cannot be asked
 * which panel a press landed on.
 */
export function PinForm({ token, option, siteKey }: PinFormProps) {
  const { form, state, onSubmit, pending, sent, summary, fieldErrors } = useSendForm(committeePinAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const bodyId = useId();
  const groupId = useId();
  const bounds: PointBounds = option.bounds;
  const [place, setPlace] = useState<PinPlaceId>(DEFAULT_PLACE);
  const [point, setPoint] = useState(() => pointOfPlace(placeOf(DEFAULT_PLACE), bounds));
  const front = option.preview?.views.find((view) => view.view === "front");
  const bodyErrors = fieldErrors("body");

  const chooseFromPress = (event: MouseEvent<HTMLButtonElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const next = pointOfPress({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }, bounds);
    setPoint(next);
    setPlace(placeOfPoint(next, bounds).id);
  };

  const chooseFromRadio = (id: PinPlaceId): void => {
    setPlace(id);
    setPoint(pointOfPlace(placeOf(id), bounds));
  };

  if (sent) {
    return (
      <FormDone>
        <strong className="font-semibold">Your comment is pinned.</strong> The club sees it with your name and the place you
        marked. Reload this page to pin another.
      </FormDone>
    );
  }

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        guard(event);
        void onSubmit(event);
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="version" value={option.version} />
      <input type="hidden" name="xMm" value={point.xMm} />
      <input type="hidden" name="yMm" value={point.yMm} />

      {front ? (
        <button
          type="button"
          onClick={chooseFromPress}
          aria-describedby={groupId}
          className="relative block w-full overflow-hidden rounded-xl border border-hairline bg-white p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
          data-testid={`committee-pin-target-${option.slot}`}
        >
          {/* A data address cannot go through next/image, and this is a drawing, not a photo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={front.src} alt={front.alt} className="mx-auto h-auto max-h-[22rem] w-full object-contain" />
          <span
            aria-hidden="true"
            style={pinStyle(point, bounds)}
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cobalt-soft"
            data-testid={`committee-pin-mark-${option.slot}`}
          />
        </button>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink" id={groupId}>
          Where on it?
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {PIN_PLACES.map((entry) => (
            <label
              key={entry.id}
              className="flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-3 text-sm text-ink has-[:checked]:border-cobalt-soft"
            >
              <input
                type="radio"
                name="place"
                value={entry.id}
                checked={place === entry.id}
                onChange={() => chooseFromRadio(entry.id)}
                className="size-4"
              />
              {entry.label}
            </label>
          ))}
        </div>
      </fieldset>

      <SelectField
        name="panelId"
        label="Which part"
        hint="The part of the kit you mean."
        options={option.panels.map((panel) => ({ id: panel.id, label: panel.label }))}
        placeholder="Choose a part"
        required
        defaultValue={state.values.panelId}
        errors={fieldErrors("panelId")}
      />

      <Field
        name="name"
        label="Your name"
        hint="Shown to the club beside your comment."
        autoComplete="name"
        maxLength={NAME_MAX}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={bodyId} className="text-sm font-medium text-ink">
          What would you change?
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={3}
          maxLength={PIN_MAX}
          required
          defaultValue={state.values.body}
          aria-invalid={bodyErrors.length > 0 || undefined}
          aria-describedby={bodyErrors.length > 0 ? `${bodyId}-error` : undefined}
          className={TEXT_AREA}
        />
        {bodyErrors.length > 0 ? (
          <p id={`${bodyId}-error`} className="text-sm text-warn">
            {bodyErrors.join(" ")}
          </p>
        ) : null}
      </div>

      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Pinning" : "Pin this comment"}
      </Button>
    </form>
  );
}
