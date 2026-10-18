import { defineConfig } from 'wxt';

// Manifest settings and permissions live here; WXT generates manifest.json.
export default defineConfig({
  manifest: {
    name: 'TomoBreak',
    description: 'A companion that cares about you and never breaks your flow.',
    // `commands` is a manifest key (added in Phase 7), not a permission.
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'idle', 'notifications', 'tabs'],
    host_permissions: ['<all_urls>'],
    // Placeholder icons (also used by the notification fallback); polished in Phase 7.
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  },
  // Vite's modulepreload polyfill contains a fetch() call; we need none.
  vite: () => ({
    build: { modulePreload: { polyfill: false } },
  }),
});
