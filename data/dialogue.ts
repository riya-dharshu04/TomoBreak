import type { ModeId } from '@/utils/types';

/** A list with at least one entry, so picking from it never yields undefined. */
export type Lines = readonly [string, ...string[]];

export interface ModeDialogue {
  prompt: Lines;
  buttons: { yes: string; no: string; snooze: string };
  yes: Lines;
  /** First line after "No" (shown with the sad face). */
  no: Lines;
  /** Optional encouraging follow-up after the sad line. */
  noFollowUp?: string;
  snooze: Lines;
  ignored: Lines;
}

const hydration: ModeDialogue = {
  prompt: [
    'Did you drink water?',
    'Water check! Did you have a sip recently?',
    'Hey, have you had some water lately?',
  ],
  buttons: { yes: 'Yes! 💧', no: 'Not yet', snooze: 'Snooze 10 min' },
  yes: ['Yay! Your cells are dancing with me!', 'Hydrated and happy! I love it!', 'Great job! Keep it flowing!'],
  no: ['Aww...', 'Oh no...'],
  noFollowUp: "Go grab some, I'll wait!",
  snooze: ["Okay! I'll check back in 10 minutes.", 'Got it, see you in a bit!'],
  ignored: ["You look busy. I'll come back later!"],
};

/** Used for modes whose own lines arrive in a later phase. */
const generic: ModeDialogue = {
  prompt: ['Time for a little break?'],
  buttons: { yes: 'Done!', no: 'Not now', snooze: 'Snooze 10 min' },
  yes: ['Nice! That felt good, right?'],
  no: ['Okay...'],
  snooze: ["Sure, I'll be back in 10 minutes."],
  ignored: ["You look busy. I'll come back later!"],
};

const DIALOGUE: Partial<Record<ModeId, ModeDialogue>> = { hydration };

export function dialogueFor(mode: ModeId): ModeDialogue {
  return DIALOGUE[mode] ?? generic;
}

export function pick(lines: Lines): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
}
