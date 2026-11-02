import {
  CROP_LABELS,
  FREE_BADGE,
  GAPS_HEADING,
  PEOPLE_BAND_LABELS,
  PREMIUM_BADGE,
  PREMIUM_TITLE,
  USE_SCENE_LABEL,
  isPremium,
  sceneGaps,
  type MockupScene,
} from "@/lib/mockups";
import { premiumProps, useSceneProps } from "./a11y";
import { SceneThumb, THUMB_NOTE } from "./SceneThumb";

/**
 * One scene in the mockup library (spec F-L1, "Mockup library panel").
 *
 * A card shows four things and hides none of them: what the scene is, what it costs, what it cannot
 * show yet, and the one button that puts it on the canvas. **A scene with a gap says so**, which is
 * the rule the owner asked for: a scene whose view is a turned drawing, or whose model presets do
 * not exist yet, must not look ready.
 */

type Props = Readonly<{
  scene: MockupScene;
  /** True while the shell is busy, so the card does not queue a second request. */
  busy: boolean;
  onUse: (scene: MockupScene) => void;
}>;

const CHIP = "rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-ink-2";

export function SceneCard({ scene, busy, onUse }: Props) {
  const premium = isPremium(scene);
  const gaps = sceneGaps(scene);
  return (
    <article data-testid={`mockup-scene-${scene.slug}`} className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-tile-2/90 p-3">
      <SceneThumb scene={scene} />
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[14px] font-medium leading-snug text-ink">{scene.title}</h4>
        {premium ? (
          <span {...premiumProps(PREMIUM_TITLE)} className="shrink-0 rounded-full border border-cobalt-soft/60 px-2 py-0.5 text-[11px] font-medium text-ink">
            {/* The spec's crown. The word is there as well, because a crown alone says nothing to a
                screen reader and nothing to somebody who has not seen one before. */}
            <span aria-hidden="true">♛ </span>
            {PREMIUM_BADGE}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-ink-2">{FREE_BADGE}</span>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-ink-2">{THUMB_NOTE}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={`What the ${scene.title} scene is`}>
        <li className={CHIP}>{PEOPLE_BAND_LABELS[scene.people]}</li>
        <li className={CHIP}>{scene.slots.length === 1 ? "1 garment" : `${scene.slots.length} garments`}</li>
        {scene.crops.map((crop) => (
          <li key={crop} className={CHIP}>
            {CROP_LABELS[crop]}
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-relaxed text-ink-2">{scene.lighting}</p>
      {gaps.length === 0 ? null : (
        <section className="flex flex-col gap-1 rounded-xl border border-warn/30 bg-warn-wash px-2.5 py-2">
          <h5 className="text-[11px] font-medium tracking-[0.04em] text-warn uppercase">{GAPS_HEADING}</h5>
          <ul className="flex flex-col gap-1">
            {gaps.map((gap) => (
              <li key={gap.line} className="text-[12px] leading-relaxed text-warn">
                {gap.line} <span className="font-mono text-[11px]">{gap.ruleId}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button
        {...useSceneProps(scene.title, busy)}
        onClick={() => onUse(scene)}
        data-testid={`mockup-use-${scene.slug}`}
        className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
      >
        {USE_SCENE_LABEL}
      </button>
    </article>
  );
}
