import type { Pose, StretchId } from '@/utils/types';

export interface Stretch {
  id: StretchId;
  name: string;
  /** One-line instruction shown during the 30-second timer. */
  instruction: string;
  /** Matching character pose (see characters.css). */
  pose: Pose;
}

export const STRETCH_SECONDS = 30;

export const STRETCHES: readonly [Stretch, ...Stretch[]] = [
  { id: 'neckRoll', name: 'neck roll', instruction: 'Slowly roll your head in big, gentle circles.', pose: 'neck' },
  { id: 'shoulderShrug', name: 'shoulder shrug', instruction: 'Lift your shoulders to your ears, hold, then drop them.', pose: 'shrug' },
  { id: 'wristStretch', name: 'wrist stretch', instruction: 'Arms out, gently pull each hand back by the fingers.', pose: 'wrist' },
  { id: 'seatedTwist', name: 'seated twist', instruction: 'Sit tall and twist gently to each side, holding the chair.', pose: 'twist' },
  { id: 'overheadReach', name: 'overhead reach', instruction: 'Lace your fingers and reach up to the ceiling.', pose: 'reach' },
  { id: 'chestOpener', name: 'chest opener', instruction: 'Clasp your hands behind you and open up your chest.', pose: 'chest' },
  { id: 'sideBend', name: 'side bend', instruction: 'One arm overhead, lean gently to the side. Switch halfway.', pose: 'side' },
  { id: 'ankleCircles', name: 'ankle circles', instruction: 'Lift a foot and draw slow circles. Switch feet halfway.', pose: 'ankle' },
];

export function randomStretch(): Stretch {
  return STRETCHES[Math.floor(Math.random() * STRETCHES.length)] ?? STRETCHES[0];
}
