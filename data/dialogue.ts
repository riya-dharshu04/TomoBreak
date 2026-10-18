/**
 * Everything the buddy says. Kind and encouraging: when the user says No
 * the character is a little sad, never guilt-tripping.
 * `{name}` placeholders are filled with fill().
 */
import type { ModeId, Mood, ReactionKind, UnlockId } from '@/utils/types';

/** A list with at least one entry, so picking from it never yields undefined. */
export type Lines = readonly [string, ...string[]];

export interface ButtonLabels {
  yes: string;
  no: string;
  snooze: string;
}

export interface ModeDialogue {
  prompt: Lines;
  buttons: ButtonLabels;
  yes: Lines;
  /** First line after "No" (shown with the sad face). */
  no: Lines;
  /** Optional encouraging follow-up after the sad line. */
  noFollowUp?: string;
  snooze: Lines;
  ignored: Lines;
  /** Said when a timed activity (eye rest, stretch) finishes. */
  done?: Lines;
}

const SNOOZE: Lines = ["Okay! I'll check back in 10 minutes.", 'Got it, see you in a bit!'];
const IGNORED: Lines = ["You look busy. I'll come back later!", "I'll let you focus. See you soon!"];

const DIALOGUE: Record<ModeId, ModeDialogue> = {
  hydration: {
    prompt: ['Did you drink water?', 'Water check! Did you have a sip recently?', 'Hey, have you had some water lately?'],
    buttons: { yes: 'Yes! 💧', no: 'Not yet', snooze: 'Snooze 10 min' },
    yes: ['Yay! Your cells are dancing with me!', 'Hydrated and happy! I love it!', 'Great job! Keep it flowing!'],
    no: ['Aww...', 'Oh no...'],
    noFollowUp: "Go grab some, I'll wait!",
    snooze: SNOOZE,
    ignored: IGNORED,
  },
  eye: {
    prompt: ['Eye break! Look at something 20 feet away for 20 seconds.', 'Time for 20-20-20: find something far away and look at it for 20 seconds.'],
    buttons: { yes: 'Start 👀', no: 'Skip', snooze: 'Snooze 10 min' },
    yes: ["I'll close my eyes too. Look far away..."],
    no: ['Okay... your eyes work so hard.'],
    noFollowUp: 'Blink a few times for me at least!',
    snooze: SNOOZE,
    ignored: IGNORED,
    done: ['Thank you! Your eyes say thanks too.', 'All done! Doesn’t that feel nicer?'],
  },
  posture: {
    prompt: ['Sit up straight with me!', 'Posture check! Shoulders back, sit up tall with me!'],
    buttons: { yes: 'Fixed it', no: 'Not now', snooze: 'Snooze 10 min' },
    yes: ['Look at you, standing tall! Well, sitting tall!', 'Perfect posture! Your back says thank you.'],
    no: ['Aww, okay...'],
    noFollowUp: 'Maybe just roll your shoulders once?',
    snooze: SNOOZE,
    ignored: IGNORED,
  },
  stretch: {
    prompt: ['Stretch time! Try a {stretch} with me?', 'Let’s move a little: {stretch}?'],
    buttons: { yes: "Let's do it", no: 'Skip', snooze: 'Snooze 10 min' },
    yes: ['Yay! Follow me!'],
    no: ['Okay... maybe next time.'],
    noFollowUp: 'Even one big stretch helps!',
    snooze: SNOOZE,
    ignored: IGNORED,
    done: ['Nice stretch! Feeling looser?', 'That was great! You’re so bendy!'],
  },
  pomodoro: {
    prompt: ['Break time!'],
    buttons: { yes: 'Yay!', no: 'Skip', snooze: 'Later' },
    yes: ['Enjoy your break!'],
    no: ['Okay!'],
    snooze: SNOOZE,
    ignored: IGNORED,
  },
  entertainment: {
    prompt: ['Dance break! Here’s one for you:'],
    buttons: { yes: 'Haha 😂', no: 'Meh', snooze: 'Later' },
    yes: ['Hehe, I knew you’d like that one!', 'Your laugh made my day!'],
    no: ['Tough crowd...'],
    noFollowUp: "I'll work on my material!",
    snooze: ["Okay, I'll save my best jokes for later!"],
    ignored: ["I'll tell you another one later!"],
  },
};

export function dialogueFor(mode: ModeId): ModeDialogue {
  return DIALOGUE[mode];
}

// ---- Merged visits -----------------------------------------------------------

/** How each mode is named inside a merged question ("Water and a quick stretch?"). */
const MERGE_PHRASES: Record<ModeId, string> = {
  hydration: 'water',
  eye: 'an eye break',
  posture: 'a posture check',
  stretch: 'a quick stretch',
  pomodoro: 'a break',
  entertainment: 'a joke',
};

export const MERGED: Omit<ModeDialogue, 'prompt'> = {
  buttons: { yes: 'Yes!', no: 'Not now', snooze: 'Snooze 10 min' },
  yes: ['Yay! Let’s do this together!'],
  no: ['Aww, okay...'],
  noFollowUp: "I'll be here when you're ready.",
  snooze: SNOOZE,
  ignored: IGNORED,
  done: ['All done! You’re taking such good care of yourself!'],
};

export function mergedPrompt(modes: readonly ModeId[]): string {
  const phrases = modes.map((mode) => MERGE_PHRASES[mode]);
  const last = phrases.pop() ?? '';
  const joined = phrases.length > 0 ? `${phrases.join(', ')} and ${last}` : last;
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}?`;
}

// ---- Pomodoro ----------------------------------------------------------------

export const POMODORO = {
  breakStart: ['Break time! You focused so well. Rest for {min} minutes!', 'Ding! Focus round done. {min} minutes of break!'] as Lines,
  bundled: ['I saved these for your break:'] as Lines,
  breakAlone: ['Enjoy your break! Stretch, sip, look outside.'] as Lines,
  end: ["Break's over! Ready for another focus round?"] as Lines,
  endButtons: { yes: "Let's go!", no: "I'm done", snooze: '5 more min' } satisfies ButtonLabels,
  endYes: ["Focus mode on! I'll keep things quiet."] as Lines,
  endNo: ['Great work today! Proud of you.'] as Lines,
  endSnooze: ['Five more minutes of rest!'] as Lines,
};

// ---- Mood & bond ---------------------------------------------------------------

/** Said before the first prompt of a visit; empty means no greeting. */
export const MOOD_GREETING: Record<Mood, Lines> = {
  thrilled: ['Hiii! 💖', 'Yay, it’s you!', 'I missed you!'],
  happy: ['Hey there!', 'Hi!', ''],
  okay: [''],
  worried: ['Hey... I was a little worried about you.', 'Hi... are you doing okay?'],
};

/** Extra cheerful lines unlocked at a 14-day streak. */
export const BONUS_YES: Lines = [
  'Fourteen days of self-care and counting. You’re my hero!',
  'Best. Human. Ever.',
  'We make such a good team!',
  'You glow when you take care of yourself!',
];

export const UNLOCK_TEXT: Record<UnlockId, string> = {
  dance: '✨ 3-day streak! I learned a new dance for you!',
  outfit: '✨ 7-day streak! Look, a new party hat!',
  lines: '✨ 14-day streak! I have new things to say!',
  celebration: '✨ 30-day streak! This calls for a special celebration!',
};

export const SUMMARY = {
  title: 'Your week with me',
  proud: ["I'm proud of you!", 'What a week! Thank you for taking care of yourself.'] as Lines,
  button: 'Thanks! 💖',
};

/** "You drank water 31 times" style rows for the weekly summary. */
export const SUMMARY_ROWS: Record<ModeId, (count: number) => string> = {
  hydration: (n) => `💧 You drank water ${n} ${n === 1 ? 'time' : 'times'}`,
  eye: (n) => `👀 You rested your eyes ${n} ${n === 1 ? 'time' : 'times'}`,
  posture: (n) => `🪑 You fixed your posture ${n} ${n === 1 ? 'time' : 'times'}`,
  stretch: (n) => `🙆 You stretched ${n} ${n === 1 ? 'time' : 'times'}`,
  pomodoro: (n) => `🍅 You finished ${n} focus ${n === 1 ? 'session' : 'sessions'}`,
  entertainment: (n) => `🎉 You laughed at ${n} ${n === 1 ? 'joke' : 'jokes'}`,
};

// ---- Context reactions -------------------------------------------------------

export interface ReactionDialogue {
  lines: Lines;
  /** Without buttons, the reaction plays and leaves on its own. */
  buttons: { yes: string; no: string } | null;
  yesReply: Lines;
  noReply: Lines;
}

export const REACTIONS: Record<ReactionKind, ReactionDialogue> = {
  lateNight: {
    lines: ["It's {time}... the bugs will still be here tomorrow. Sleep?", "It's {time}! Even I'm getting sleepy... bedtime?"],
    buttons: { yes: 'Okay, bedtime 😴', no: '10 more minutes' },
    yesReply: ['Sweet dreams! 🌙'],
    noReply: ["Okay... don't stay up too late."],
  },
  longSession: {
    lines: ["You've been going for 2 hours straight! Stretch with me?", 'Two hours of hard work! Time to move a little?'],
    buttons: { yes: "Let's stretch", no: 'Not now' },
    yesReply: ['Yay!'],
    noReply: ['Okay! Maybe stand up for a sip of water then?'],
  },
  tabOverload: {
    lines: [
      'So... many... tabs! My brain has too many tabs open too.',
      'Are we collecting tabs now? I think one of them is playing music somewhere.',
      "Woah! That's a lot of tabs. Your RAM is asking for a hug.",
    ],
    buttons: { yes: "I'll close some", no: "They're all important!" },
    yesReply: ['Ahh, I can breathe again!'],
    noReply: ['Hehe, fair. They are all very important.'],
  },
  codingWin: {
    lines: ['Accepted! You did it! 🎉', 'YES! Look at you go!', 'Shipped it! Celebration dance!'],
    buttons: null,
    yesReply: [''],
    noReply: [''],
  },
  codingFail: {
    lines: [
      'So close! Every wrong answer is a step toward the right one.',
      "Don't give up! Check the edge cases, you've got this.",
      'Hmm, tricky one! Take a breath and try again.',
    ],
    buttons: null,
    yesReply: [''],
    noReply: [''],
  },
  socialNudge: {
    lines: ['Still researching? 👀', 'Thirty minutes of... important research? 👀'],
    buttons: { yes: 'Busted 😅', no: 'It IS research!' },
    yesReply: ['Hehe! Back to it, champ!'],
    noReply: ['Hehe, okay! Very scientific.'],
  },
};

// ---- Helpers -----------------------------------------------------------------

export function pick(lines: Lines): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
}

/** Replace `{key}` placeholders. */
export function fill(line: string, values: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
