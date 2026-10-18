/**
 * LeetCode: "Accepted" → celebration dance; "Wrong Answer" (and other failed
 * verdicts) → encouragement. Reads only the submission result label.
 */
import type { SiteAdapter } from './index';
import { watchPage } from './watch';

const RESULT_SELECTOR = '[data-e2e-locator="submission-result"]';
const FAIL = /Wrong Answer|Time Limit Exceeded|Runtime Error|Memory Limit Exceeded/;

function readResult(): string | null {
  return document.querySelector(RESULT_SELECTOR)?.textContent?.trim() ?? null;
}

export const leetcodeAdapter: SiteAdapter = {
  id: 'leetcode',
  hosts: ['leetcode.com', 'leetcode.cn'],
  start(emit) {
    // A result already on screen when the page loads is old news.
    let last = readResult();
    return watchPage(() => {
      const result = readResult();
      if (result === last) return;
      last = result;
      if (result === null) return; // judging again: the label disappears first
      if (result.startsWith('Accepted')) emit('codingWin');
      else if (FAIL.test(result)) emit('codingFail');
    });
  },
};
