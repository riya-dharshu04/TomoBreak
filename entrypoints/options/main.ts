/**
 * Options page: the 3-step onboarding (character, modes, intervals) with a
 * live preview, focus settings, context reactions, and the bond & stats tab.
 * Opened automatically on install with `?welcome=1`. Nothing is stored until
 * Save.
 */
import '@/assets/characters/characters.css';
import { byId, el } from '@/lib/dom';
import { formatMinutes, normalizeSite } from '@/lib/focus';
import { MODE_IDS, MODES } from '@/lib/modes';
import { getItem, onItemChanged, updateItem } from '@/lib/storage';
import type { LessonLanguage, ModeId, ModeSettings, ReactionId } from '@/utils/types';
import { toCharacterId } from '@/lib/characters';
import { CharacterPicker } from './characters';
import { Preview } from './preview';
import { initStats, renderStats } from './stats';
import { initTabs } from './tabs';

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 240;
const MAX_GOAL = 20;

const REACTION_INFO: Record<ReactionId, { label: string; description: string }> = {
  lateNight: { label: '🌙 Late night', description: 'A sleepy nudge to go to bed when it gets late.' },
  longSession: { label: '⏱️ Long session', description: 'After 2 hours without a 5-minute break, suggest a stretch.' },
  tabOverload: { label: '🗂️ Tab overload', description: 'A joke when you have more than 25 tabs open.' },
  codingWins: { label: '🏆 Coding wins', description: 'Celebrate LeetCode “Accepted” and PRs you merge on GitHub; cheer you on after a wrong answer.' },
  socialNudge: { label: '👀 Social nudge', description: 'A playful nudge after 30 minutes on YouTube, Instagram, X or Reddit. Off by default.' },
};
const LANGUAGE_LABELS: Record<LessonLanguage, string> = {
  english: 'English',
  japanese: '日本語 Japanese',
};
const LANGUAGES: readonly LessonLanguage[] = ['english', 'japanese'];

const REACTION_IDS: readonly ReactionId[] = ['lateNight', 'longSession', 'tabOverload', 'codingWins', 'socialNudge'];

const welcome = byId('welcome', HTMLParagraphElement);
const form = byId('setup', HTMLFormElement);
const modeList = byId('mode-list', HTMLDivElement);
const intervalList = byId('interval-list', HTMLDivElement);
const quietEnabled = byId('quiet-enabled', HTMLInputElement);
const quietStart = byId('quiet-start', HTMLInputElement);
const quietEnd = byId('quiet-end', HTMLInputElement);
const meetingSites = byId('meeting-sites', HTMLTextAreaElement);
const blockedSites = byId('blocked-sites', HTMLTextAreaElement);
const reactionList = byId('reaction-list', HTMLDivElement);
const lateNightStart = byId('late-night-start', HTMLInputElement);
const socialSites = byId('social-sites', HTMLTextAreaElement);
const saveButton = byId('save', HTMLButtonElement);
const saveMsg = byId('save-msg', HTMLParagraphElement);
const stage = byId('preview-stage', HTMLDivElement);
const replayButton = byId('preview-replay', HTMLButtonElement);

/** "HH:MM" → minutes after midnight, or null if the field is empty/invalid. */
function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseSites(text: string): string[] {
  return [...new Set(text.split('\n').map(normalizeSite).filter((site) => site !== ''))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A labelled number input that writes into the draft and re-shows the clamped value. */
function numberField(label: string, suffix: string, value: number, min: number, max: number, onValue: (v: number) => void): HTMLLabelElement {
  const wrapper = el('label', 'interval-field');
  const input = el('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  let current = value;
  input.addEventListener('input', () => {
    if (!Number.isFinite(input.valueAsNumber)) return;
    current = clamp(input.valueAsNumber, min, max);
    onValue(current);
  });
  input.addEventListener('change', () => {
    input.value = String(current);
  });
  wrapper.append(el('span', 'interval-prefix', label), input, el('span', '', suffix));
  return wrapper;
}

async function main(): Promise<void> {
  const [settings, characters] = await Promise.all([getItem('settings'), getItem('characters')]);
  welcome.hidden = !(new URLSearchParams(location.search).has('welcome') || !settings.onboarded);

  // ---- Unsaved form state ----
  const modes: Record<ModeId, ModeSettings> = structuredClone(settings.modes);
  const goals: Record<ModeId, number> = structuredClone(settings.goals);
  const reactions: Record<ReactionId, boolean> = structuredClone(settings.reactions);
  let pomodoroBreakMin = settings.pomodoroBreakMin;
  let language: LessonLanguage = settings.language;

  // ---- Preview ----
  const preview = new Preview(stage);
  const sampleMode = (): ModeId => MODE_IDS.find((id) => modes[id].enabled) ?? 'hydration';
  let replayTimer: number | undefined;
  const replay = (): void => {
    window.clearTimeout(replayTimer);
    void preview.play(picker.selected, sampleMode(), language);
  };
  /** Debounced, so clicking through characters doesn't restart the walk each time. */
  const replaySoon = (): void => {
    window.clearTimeout(replayTimer);
    replayTimer = window.setTimeout(replay, 250);
  };
  replayButton.addEventListener('click', replay);

  // ---- Step 1 ----
  const picker = new CharacterPicker(toCharacterId(characters.activeId), { onSelect: replaySoon });
  picker.render();

  // ---- Step 2 ----
  /** English or Japanese, shown inside the Language card while it is on. */
  const languagePicker = (): HTMLElement => {
    const group = el('div', 'language-picker');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Language to learn');
    for (const lang of LANGUAGES) {
      const option = el('label', 'language-option');
      const radio = el('input');
      radio.type = 'radio';
      radio.name = 'lesson-language';
      radio.value = lang;
      radio.checked = language === lang;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        language = lang;
        replaySoon();
      });
      option.append(radio, el('span', '', LANGUAGE_LABELS[lang]));
      group.append(option);
    }
    group.append(el('p', 'language-hint', 'English: intermediate to advanced words. Japanese: basic to advanced, step by step.'));
    return group;
  };

  const renderModes = (): void => {
    modeList.replaceChildren(
      ...MODE_IDS.map((id) => {
        const def = MODES[id];
        const card = el('div', 'mode-card');
        const label = el('label', 'mode-toggle');
        const input = el('input');
        input.type = 'checkbox';
        input.checked = modes[id].enabled;
        input.addEventListener('change', () => {
          modes[id].enabled = input.checked;
          renderModes();
          renderIntervals();
          replaySoon();
        });
        const text = el('span', 'mode-text');
        text.append(el('span', 'mode-title', `${def.emoji} ${def.label}`), el('span', 'mode-desc', def.description));
        label.append(input, text);
        card.append(label);
        if (id === 'language' && modes.language.enabled) card.append(languagePicker());
        return card;
      }),
    );
  };

  // ---- Step 3 ----
  const renderIntervals = (): void => {
    const rows = MODE_IDS.filter((id) => modes[id].enabled).map((id) => {
      const row = el('div', 'interval-row');
      row.append(el('span', 'interval-name', `${MODES[id].emoji} ${MODES[id].label}`));
      const setMinutes = (v: number): void => {
        modes[id].intervalMin = v;
      };
      if (id === 'entertainment') {
        row.append(el('span', 'interval-note', 'Randomly every 60–120 min'));
      } else if (id === 'pomodoro') {
        row.append(
          numberField('Focus', 'min', modes[id].intervalMin, MIN_INTERVAL, MAX_INTERVAL, setMinutes),
          numberField('Break', 'min', pomodoroBreakMin, 1, 60, (v) => {
            pomodoroBreakMin = v;
          }),
        );
      } else {
        row.append(numberField('Every', 'min', modes[id].intervalMin, MIN_INTERVAL, MAX_INTERVAL, setMinutes));
      }
      const unit = id === 'pomodoro' ? 'sessions/day' : 'per day';
      row.append(
        numberField('Goal', unit, goals[id], 1, MAX_GOAL, (v) => {
          goals[id] = v;
        }),
      );
      return row;
    });
    if (rows.length === 0) rows.push(el('p', 'hint', 'Pick at least one mode above.'));
    intervalList.replaceChildren(...rows);
  };

  renderModes();
  renderIntervals();

  // ---- Focus settings ----
  quietEnabled.checked = settings.quietHours.enabled;
  quietStart.value = formatMinutes(settings.quietHours.startMin);
  quietEnd.value = formatMinutes(settings.quietHours.endMin);
  meetingSites.value = settings.meetingSites.join('\n');
  blockedSites.value = settings.blockedSites.join('\n');

  // ---- Reactions ----
  reactionList.replaceChildren(
    ...REACTION_IDS.map((id) => {
      const card = el('div', 'mode-card');
      const label = el('label', 'mode-toggle');
      const input = el('input');
      input.type = 'checkbox';
      input.checked = reactions[id];
      input.addEventListener('change', () => {
        reactions[id] = input.checked;
      });
      const text = el('span', 'mode-text');
      text.append(el('span', 'mode-title', REACTION_INFO[id].label), el('span', 'mode-desc', REACTION_INFO[id].description));
      label.append(input, text);
      card.append(label);
      return card;
    }),
  );
  lateNightStart.value = formatMinutes(settings.lateNightStartMin);
  socialSites.value = settings.socialSites.join('\n');

  // ---- Tabs & stats ----
  initStats();
  initTabs((tab) => {
    if (tab === 'stats') void renderStats();
    else preview.stop();
    if (tab === 'setup') replaySoon();
  });
  onItemChanged('stats', () => void renderStats());
  onItemChanged('bond', () => void renderStats());

  // ---- Save ----
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });

  const save = async (): Promise<void> => {
    saveButton.disabled = true;
    const meeting = parseSites(meetingSites.value);
    const blocked = parseSites(blockedSites.value);
    const social = parseSites(socialSites.value);
    try {
      await updateItem('settings', (s) => ({
        ...s,
        onboarded: true,
        modes: structuredClone(modes),
        goals: structuredClone(goals),
        pomodoroBreakMin,
        quietHours: {
          enabled: quietEnabled.checked,
          startMin: parseTime(quietStart.value) ?? s.quietHours.startMin,
          endMin: parseTime(quietEnd.value) ?? s.quietHours.endMin,
        },
        meetingSites: meeting,
        blockedSites: blocked,
        reactions: structuredClone(reactions),
        language,
        lateNightStartMin: parseTime(lateNightStart.value) ?? s.lateNightStartMin,
        socialSites: social,
      }));
      await updateItem('characters', (c) => ({ ...c, activeId: picker.selected }));
      meetingSites.value = meeting.join('\n');
      blockedSites.value = blocked.join('\n');
      socialSites.value = social.join('\n');
      welcome.hidden = true;
      const anyMode = MODE_IDS.some((id) => modes[id].enabled);
      saveMsg.textContent = anyMode
        ? 'Saved! Your buddy will drop by at a natural pause.'
        : 'Saved. No modes are on, so your buddy will rest for now.';
    } catch (error) {
      console.error('[TomoBreak] save failed', error);
      saveMsg.textContent = 'Could not save. Please try again.';
    } finally {
      saveButton.disabled = false;
    }
  };

  replay();
}

void main();
