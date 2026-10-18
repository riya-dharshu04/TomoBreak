/**
 * Visit scripts: what the buddy says and does during each kind of visit.
 * They drive a Stage (implemented by Overlay) and know nothing about the DOM.
 */
import {
  BONUS_YES,
  MERGED,
  MOOD_GREETING,
  POMODORO,
  REACTIONS,
  SUMMARY,
  SUMMARY_ROWS,
  UNLOCK_TEXT,
  dialogueFor,
  fill,
  mergedPrompt,
  pick,
  type ButtonLabels,
  type Lines,
  type ModeDialogue,
} from '@/data/dialogue';
import { randomJoke } from '@/data/jokes';
import { STRETCH_SECONDS, randomStretch, type Stretch } from '@/data/stretches';
import { MODE_IDS } from '@/lib/modes';
import type {
  Answer,
  AnswerOutcome,
  CharacterState,
  ModeId,
  Pose,
  UnlockId,
  Visit,
  VisitBody,
  WeeklySummary,
} from '@/utils/types';

/** Results of ask() besides a choice id. */
export const ESCAPE = '__escape';
export const TIMEOUT = '__timeout';

const EYE_SECONDS = 20;

export interface Choice {
  id: string;
  label: string;
  primary?: boolean;
}

/** What a visit script can do with the buddy. */
export interface Stage {
  readonly visit: Visit;
  setState(state: CharacterState): void;
  setPose(pose: Pose | null): void;
  /** Put on an unlocked reward right now (unlock celebration). */
  wear(unlock: UnlockId): void;
  confetti(): void;
  say(line: string): void;
  showCard(title: string, rows: readonly string[], footer: string): void;
  /** Resolves with the chosen id, ESCAPE, or TIMEOUT after `timeoutMs` (default 60 s). */
  ask(choices: readonly Choice[], timeoutMs?: number): Promise<string>;
  countdown(seconds: number, skipLabel: string): Promise<boolean>;
  report(answer: Answer): Promise<AnswerOutcome>;
  wait(ms: number): Promise<void>;
}

type ReminderVisit = Visit & Extract<VisitBody, { kind: 'reminder' }>;
type ReactionVisit = Visit & Extract<VisitBody, { kind: 'reaction' }>;

export async function runVisit(stage: Stage): Promise<void> {
  const visit = stage.visit;
  if (visit.summary) await presentSummary(stage, visit.summary);
  for (const unlock of visit.announce) await celebrateUnlock(stage, unlock);
  // Greet by mood, unless a card or celebration already said hello.
  const greeting = visit.summary || visit.announce.length > 0 ? '' : pick(MOOD_GREETING[visit.mood]);

  switch (visit.kind) {
    case 'reminder':
      await reminder(stage, visit, greeting);
      return;
    case 'pomodoroEnd':
      await pomodoroEnd(stage);
      return;
    case 'reaction':
      await reaction(stage, visit);
      return;
  }
}

// ---- Shared bits --------------------------------------------------------------

function threeButtons(labels: ButtonLabels): Choice[] {
  return [
    { id: 'yes', label: labels.yes, primary: true },
    { id: 'no', label: labels.no },
    { id: 'snooze', label: labels.snooze },
  ];
}

/** Escape counts as Snooze; no answer within 60 s counts as ignored. */
function toAnswer(choice: string): Answer {
  if (choice === 'yes' || choice === 'no' || choice === 'snooze') return choice;
  return choice === TIMEOUT ? 'ignored' : 'snooze';
}

function withGreeting(greeting: string, line: string): string {
  return greeting ? `${greeting} ${line}` : line;
}

function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

async function presentSummary(stage: Stage, summary: WeeklySummary): Promise<void> {
  stage.setState('happy');
  const rows = MODE_IDS.flatMap((mode) => {
    const count = summary.counts[mode] ?? 0;
    return count > 0 ? [SUMMARY_ROWS[mode](count)] : [];
  });
  stage.showCard(SUMMARY.title, rows, pick(SUMMARY.proud));
  await stage.ask([{ id: 'ok', label: SUMMARY.button, primary: true }], 30_000);
}

async function celebrateUnlock(stage: Stage, unlock: UnlockId): Promise<void> {
  stage.setPose(null);
  stage.setState('surprised');
  stage.say(UNLOCK_TEXT[unlock]);
  await stage.wait(1200);
  stage.wear(unlock);
  stage.setState('happy');
  stage.confetti();
  await stage.wait(3200);
}

async function eyeRest(stage: Stage): Promise<void> {
  stage.setState('idle');
  stage.setPose('rest-eyes');
  stage.say('Look at something far away... I’ll count for you.');
  await stage.countdown(EYE_SECONDS, 'Skip');
  stage.setPose(null);
}

async function doStretch(stage: Stage, stretch: Stretch): Promise<void> {
  stage.setState('idle');
  stage.setPose(stretch.pose);
  stage.say(`${capitalize(stretch.name)}: ${stretch.instruction}`);
  await stage.countdown(STRETCH_SECONDS, 'Done early');
  stage.setPose(null);
}

async function sadThenEncourage(stage: Stage, dialogue: Omit<ModeDialogue, 'prompt'>): Promise<void> {
  stage.setState('sad');
  stage.say(pick(dialogue.no));
  await stage.wait(1800);
  if (dialogue.noFollowUp) {
    stage.setState('talk');
    stage.say(dialogue.noFollowUp);
    await stage.wait(2500);
  }
}

// ---- Reminders (single, merged, Pomodoro break) --------------------------------

async function reminder(stage: Stage, visit: ReminderVisit, greeting: string): Promise<void> {
  const { modes } = visit;

  if (visit.pomodoroBreakMin !== null) {
    stage.setState('happy');
    stage.say(fill(pick(POMODORO.breakStart), { min: String(visit.pomodoroBreakMin) }));
    await stage.wait(3500);
    if (modes.length === 0) {
      stage.setState('talk');
      stage.say(pick(POMODORO.breakAlone));
      await stage.ask([{ id: 'ok', label: 'Thanks!', primary: true }], 20_000);
      void stage.report('yes');
      stage.setState('happy');
      await stage.wait(1500);
      return;
    }
    stage.setState('talk');
    stage.say(pick(POMODORO.bundled));
    await stage.wait(1500);
    greeting = '';
  }

  const single: ModeId | undefined = modes.length === 1 ? modes[0] : undefined;
  const dialogue: ModeDialogue = single
    ? dialogueFor(single)
    : { ...MERGED, prompt: [mergedPrompt(modes)] };
  const stretch = randomStretch();
  let prompt = fill(pick(dialogue.prompt), { stretch: stretch.name });

  if (single === 'entertainment') {
    // Comedy dance first, then the joke.
    stage.setState('happy');
    stage.say(withGreeting(greeting, prompt));
    if (visit.unlocks.includes('celebration')) stage.confetti();
    await stage.wait(3000);
    prompt = randomJoke();
    greeting = '';
  } else if (single === 'posture') {
    // Slouch first, then straighten up together.
    stage.setState('talk');
    stage.setPose('slouch');
    stage.say(withGreeting(greeting, 'Oof, my back...'));
    await stage.wait(1600);
    stage.setPose('straight');
    greeting = '';
  }

  stage.setState('talk');
  stage.say(withGreeting(greeting, prompt));
  const answer = toAnswer(await stage.ask(threeButtons(dialogue.buttons)));
  // Report at once so stats are safe even if the tab closes mid-reaction.
  const outcome = stage.report(answer);
  stage.setPose(null);

  switch (answer) {
    case 'yes':
      await reminderYes(stage, visit, dialogue, stretch);
      break;
    case 'no':
      await sadThenEncourage(stage, dialogue);
      break;
    case 'snooze':
      stage.setState('idle');
      stage.say(pick(dialogue.snooze));
      await stage.wait(2200);
      break;
    case 'ignored':
      stage.setState('sleepy');
      stage.say(pick(dialogue.ignored));
      await stage.wait(2200);
      break;
  }

  for (const unlock of (await outcome).unlocks) await celebrateUnlock(stage, unlock);
}

async function reminderYes(stage: Stage, visit: ReminderVisit, dialogue: ModeDialogue, stretch: Stretch): Promise<void> {
  const yesLines: Lines = visit.unlocks.includes('lines') ? [...dialogue.yes, ...BONUS_YES] : dialogue.yes;
  const timed = visit.modes.filter((mode) => mode === 'eye' || mode === 'stretch');

  stage.setState('happy');
  stage.say(pick(yesLines));
  if (visit.unlocks.includes('celebration')) stage.confetti();

  if (timed.length === 0) {
    // Hydration's happy dance lasts 5 seconds; the others a little less.
    await stage.wait(visit.modes.includes('hydration') ? 5000 : 3500);
    return;
  }
  await stage.wait(1800);
  for (const mode of timed) {
    if (mode === 'eye') await eyeRest(stage);
    else await doStretch(stage, stretch);
  }
  stage.setState('happy');
  stage.say(pick(dialogue.done ?? yesLines));
  await stage.wait(3000);
}

// ---- Pomodoro break over ---------------------------------------------------------

async function pomodoroEnd(stage: Stage): Promise<void> {
  stage.setState('talk');
  stage.say(pick(POMODORO.end));
  const answer = toAnswer(await stage.ask(threeButtons(POMODORO.endButtons)));
  void stage.report(answer);
  switch (answer) {
    case 'yes':
      stage.setState('happy');
      stage.say(pick(POMODORO.endYes));
      break;
    case 'no':
      stage.setState('happy');
      stage.say(pick(POMODORO.endNo));
      break;
    case 'snooze':
      stage.setState('idle');
      stage.say(pick(POMODORO.endSnooze));
      break;
    case 'ignored':
      stage.setState('sleepy');
      stage.say("I'll stop the timer so you can rest.");
      break;
  }
  await stage.wait(2500);
}

// ---- Context reactions -------------------------------------------------------------

/** "1 AM", or "1:20 AM" when it's not close to the hour. */
function clockText(date: Date): string {
  const hour = date.getHours() % 12 || 12;
  const suffix = date.getHours() < 12 ? 'AM' : 'PM';
  const minutes = date.getMinutes();
  return minutes < 5 ? `${hour} ${suffix}` : `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

const REACTION_ENTRY: Record<ReactionVisit['reaction'], CharacterState> = {
  lateNight: 'sleepy',
  longSession: 'talk',
  tabOverload: 'surprised',
  codingWin: 'happy',
  codingFail: 'talk',
  socialNudge: 'surprised',
};

async function reaction(stage: Stage, visit: ReactionVisit): Promise<void> {
  const dialogue = REACTIONS[visit.reaction];
  const line = fill(pick(dialogue.lines), { time: clockText(new Date()) });
  stage.setState(REACTION_ENTRY[visit.reaction]);
  stage.say(line);

  if (!dialogue.buttons) {
    // Celebrations and encouragement play and leave on their own.
    if (visit.reaction === 'codingWin') {
      stage.confetti();
      await stage.wait(5000);
    } else {
      await stage.wait(4000);
      stage.setState('happy');
      await stage.wait(1200);
    }
    void stage.report('yes');
    return;
  }

  if (visit.reaction === 'tabOverload' || visit.reaction === 'socialNudge') {
    await stage.wait(900);
    stage.setState('talk');
  }
  const choice = await stage.ask([
    { id: 'yes', label: dialogue.buttons.yes, primary: true },
    { id: 'no', label: dialogue.buttons.no },
  ]);
  const answer = toAnswer(choice);
  void stage.report(answer);

  if (answer === 'yes') {
    stage.setState('happy');
    stage.say(pick(dialogue.yesReply));
    if (visit.reaction === 'longSession') {
      await stage.wait(1500);
      await doStretch(stage, randomStretch());
      stage.setState('happy');
      stage.say(pick(dialogueFor('stretch').done ?? dialogue.yesReply));
    }
    await stage.wait(2500);
    return;
  }
  if (answer === 'ignored') {
    stage.setState('sleepy');
    stage.say("I'll leave you to it!");
  } else {
    stage.setState(visit.reaction === 'lateNight' ? 'sleepy' : 'talk');
    stage.say(pick(dialogue.noReply));
  }
  await stage.wait(2500);
}
