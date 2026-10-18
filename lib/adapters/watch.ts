/**
 * Call `check` after the page changes, at most every 500 ms. These sites are
 * single-page apps, so results appear without a page load.
 */
export function watchPage(check: () => void): () => void {
  let timer: number | null = null;
  const observer = new MutationObserver(() => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      check();
    }, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    if (timer !== null) window.clearTimeout(timer);
  };
}
