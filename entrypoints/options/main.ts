/**
 * Options page: the 3-step onboarding (character, modes, intervals) with a
 * live preview, plus the focus settings. Opened automatically on install
 * with `?welcome=1`. Nothing is stored until Save, except uploads, which
 * are saved when added so the preview can use them.
 */
import '@/assets/characters/characters.css';
import { byId, el } from '@/lib/dom';
import { formatMinutes, normalizeSite } from '@/lib/focus';
import { MODE_IDS, MODES, SCHEDULED_MODES } from '@/lib/modes';
import { getItem, updateItem } from '@/lib/storage';
import type { ModeId, ModeSettings } from '@/utils/types';
import { CharacterPicker, UploadForm } from './characters';
import { Preview } from './preview';

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 240;

const welcome = byId('welcome', HTMLParagraphElement);
const form = byId('setup', HTMLFormElement);
const modeList = byId('mode-list', HTMLDivElement);
const intervalList = byId('interval-list', HTMLDivElement);
const quietEnabled = byId('quiet-enabled', HTMLInputElement);
const quietStart = byId('quiet-start', HTMLInputElement);
const quietEnd = byId('quiet-end', HTMLInputElement);
const meetingSites = byId('meeting-sites', HTMLTextAreaElement);
const blockedSites = byId('blocked-sites', HTMLTextAreaElement);
const saveButton = byId('save', HTMLButtonElement);
const saveMsg = byId('save-msg', HTMLParagraphElement);
const stage = byId('preview-stage', HTMLDivElement);
const replayButton = byId('preview-replay', HTMLButtonElement);

function isScheduled(mode: ModeId): boolean {
  return SCHEDULED_MODES.includes(mode);
}

/** "HH:MM" → minutes after midnight, or null if the field is empty/invalid. */
function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseSites(text: string): string[] {
  return [...new Set(text.split('\n').map(normalizeSite).filter((site) => site !== ''))];
}

function clampInterval(value: number): number {
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(value)));
}

async function main(): Promise<void> {
  const [settings, characters] = await Promise.all([getItem('settings'), getItem('characters')]);
  welcome.hidden = !(new URLSearchParams(location.search).has('welcome') || !settings.onboarded);

  /** The unsaved form state for steps 2 and 3. */
  const modes: Record<ModeId, ModeSettings> = structuredClone(settings.modes);

  // ---- Preview ----
  const preview = new Preview(stage);
  const sampleMode = (): ModeId => MODE_IDS.find((id) => modes[id].enabled && isScheduled(id)) ?? 'hydration';
  let replayTimer: number | undefined;
  const replay = (): void => {
    window.clearTimeout(replayTimer);
    void preview.play(picker.selected, sampleMode());
  };
  /** Debounced, so clicking through characters doesn't restart the walk each time. */
  const replaySoon = (): void => {
    window.clearTimeout(replayTimer);
    replayTimer = window.setTimeout(replay, 250);
  };
  replayButton.addEventListener('click', replay);

  // ---- Step 1 ----
  const picker = new CharacterPicker(characters.activeId, { onSelect: replaySoon });
  await picker.render();
  new UploadForm(async (id) => {
    await picker.render();
    picker.select(id);
  });

  // ---- Step 2 ----
  const renderModes = (): void => {
    modeList.replaceChildren(
      ...MODE_IDS.map((id) => {
        const def = MODES[id];
        const available = isScheduled(id);
        const label = el('label', available ? 'mode-card' : 'mode-card is-soon');
        const input = el('input');
        input.type = 'checkbox';
        input.checked = available && modes[id].enabled;
        input.disabled = !available;
        input.addEventListener('change', () => {
          modes[id].enabled = input.checked;
          renderIntervals();
          replaySoon();
        });
        const text = el('span', 'mode-text');
        const title = el('span', 'mode-title', `${def.emoji} ${def.label}`);
        if (!available) title.append(el('span', 'soon-tag', 'Coming soon'));
        text.append(title, el('span', 'mode-desc', def.description));
        label.append(input, text);
        return label;
      }),
    );
  };

  // ---- Step 3 ----
  const renderIntervals = (): void => {
    const rows = MODE_IDS.filter((id) => modes[id].enabled && isScheduled(id)).map((id) => {
      const def = MODES[id];
      const row = el('div', 'interval-row');
      const name = `${def.emoji} ${def.label}`;
      if (id === 'entertainment') {
        row.append(el('span', 'interval-name', name), el('span', 'interval-note', 'Randomly every 60–120 min'));
        return row;
      }
      const label = el('label', 'interval-field');
      const input = el('input');
      input.type = 'number';
      input.min = String(MIN_INTERVAL);
      input.max = String(MAX_INTERVAL);
      input.step = '1';
      input.value = String(modes[id].intervalMin);
      input.addEventListener('input', () => {
        const value = input.valueAsNumber;
        if (Number.isFinite(value)) modes[id].intervalMin = clampInterval(value);
      });
      input.addEventListener('change', () => {
        input.value = String(modes[id].intervalMin);
      });
      const prefix = id === 'pomodoro' ? 'Focus for' : 'Every';
      label.append(el('span', 'interval-name', name), el('span', 'interval-prefix', prefix), input, el('span', '', 'min'));
      row.append(label);
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

  // ---- Save ----
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });

  const save = async (): Promise<void> => {
    saveButton.disabled = true;
    const meeting = parseSites(meetingSites.value);
    const blocked = parseSites(blockedSites.value);
    try {
      await updateItem('settings', (s) => ({
        ...s,
        onboarded: true,
        modes: structuredClone(modes),
        quietHours: {
          enabled: quietEnabled.checked,
          startMin: parseTime(quietStart.value) ?? s.quietHours.startMin,
          endMin: parseTime(quietEnd.value) ?? s.quietHours.endMin,
        },
        meetingSites: meeting,
        blockedSites: blocked,
      }));
      await updateItem('characters', (c) => ({ ...c, activeId: picker.selected }));
      meetingSites.value = meeting.join('\n');
      blockedSites.value = blocked.join('\n');
      welcome.hidden = true;
      const anyMode = MODE_IDS.some((id) => modes[id].enabled && isScheduled(id));
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
