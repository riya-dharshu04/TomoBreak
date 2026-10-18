/**
 * GitHub: when the pull request you're viewing turns "Merged" while you
 * watch (i.e. you just merged it), celebrate. Reads only the PR state label.
 */
import type { SiteAdapter } from './index';
import { watchPage } from './watch';

const PULL_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+/;
/** Classic and current PR header state labels. */
const STATE_SELECTOR = '.State, [class*="StateLabel"]';

function pullPath(): string | null {
  return PULL_PATH.exec(location.pathname)?.[0] ?? null;
}

function isMerged(): boolean {
  return [...document.querySelectorAll(STATE_SELECTOR)].some((label) => label.textContent?.trim() === 'Merged');
}

export const githubAdapter: SiteAdapter = {
  id: 'github',
  hosts: ['github.com'],
  start(emit) {
    let path = pullPath();
    let merged = path !== null && isMerged();
    return watchPage(() => {
      const current = pullPath();
      if (current !== path) {
        // Navigated to another page: take its state as the starting point.
        path = current;
        merged = current !== null && isMerged();
        return;
      }
      if (current === null) return;
      const nowMerged = isMerged();
      if (nowMerged && !merged) emit('codingWin');
      merged = nowMerged;
    });
  },
};
