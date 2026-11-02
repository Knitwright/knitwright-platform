"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { removeStyleAction } from "@/lib/collections/actions";

type Props = Readonly<{ collectionId: string; styleId: string; name: string }>;

/**
 * Taking one style card out of a collection plan (spec F-S10). `removeStyleAction` existed with no
 * button anywhere, so a style added by mistake stayed in the plan and in its totals for good.
 *
 * It asks first, and the question **names the style** and says what goes with it, because the sizes
 * and quantities typed against that style go too. The typed word of the design and plan deletions
 * would be too much here: this takes a row out of a plan and never touches the design behind it,
 * which the question says. Nothing is hidden while it is asked -- "Keep it" is beside "Remove it",
 * and both are real buttons, so a keyboard reaches them in reading order.
 */
export function RemoveStyle({ collectionId, styleId, name }: Props) {
  const router = useRouter();
  const askedId = useId();
  const [asked, setAsked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = () => {
    setProblem(null);
    start(async () => {
      const reply = await removeStyleAction({ collectionId, styleId }).catch(() => null);
      if (!reply) return setProblem("The style could not be removed. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      // The plan is read again, as this plan's other two forms do after a save: the board, the
      // totals and the line plan all move when a style goes, and none of them is this component's.
      setAsked(false);
      router.refresh();
    });
  };

  if (!asked) {
    return (
      <div>
        <Button type="button" variant="quiet" onClick={() => setAsked(true)} aria-label={`Remove ${name} from this plan`}>
          Remove
        </Button>
        {problem ? (
          <Notice tone="warn" role="alert">
            {problem}
          </Notice>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`remove-style-${styleId}`}>
      <p id={askedId} className="text-[13px] leading-relaxed text-muted">
        Remove {name} from this plan? Its sizes and quantities go with it. The design itself is not deleted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" pending={pending} aria-describedby={askedId} onClick={remove}>
          {pending ? "Removing" : "Remove it"}
        </Button>
        <Button type="button" variant="quiet" disabled={pending} onClick={() => setAsked(false)}>
          Keep it
        </Button>
      </div>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
    </div>
  );
}
