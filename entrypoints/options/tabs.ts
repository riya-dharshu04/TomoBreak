/**
 * Accessible tabs (WAI-ARIA tabs pattern): click or arrow keys switch, only
 * the selected tab is in the tab order. Setup and Reactions live inside the
 * settings form (one Save button); Bond & stats is outside it.
 */
import { byId } from '@/lib/dom';

export type TabId = 'setup' | 'stats' | 'reactions';

const TAB_IDS: readonly TabId[] = ['setup', 'stats', 'reactions'];

export function initTabs(onShow: (tab: TabId) => void): void {
  const form = byId('setup', HTMLFormElement);
  const tabs = TAB_IDS.map((id) => ({ id, button: byId(`tab-${id}`, HTMLButtonElement), panel: byId(`panel-${id}`, HTMLElement) }));

  const select = (id: TabId, focus: boolean): void => {
    for (const tab of tabs) {
      const selected = tab.id === id;
      tab.button.setAttribute('aria-selected', String(selected));
      tab.button.tabIndex = selected ? 0 : -1;
      tab.panel.hidden = !selected;
      if (selected && focus) tab.button.focus();
    }
    form.hidden = id === 'stats';
    onShow(id);
  };

  tabs.forEach((tab, index) => {
    tab.button.addEventListener('click', () => select(tab.id, false));
    tab.button.addEventListener('keydown', (event) => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      const next = tabs[(index + delta + tabs.length) % tabs.length];
      if (next) select(next.id, true);
    });
  });
}
