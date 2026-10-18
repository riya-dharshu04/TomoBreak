import { defineConfig } from 'wxt';

// Manifest settings and permissions live here; WXT generates manifest.json.
export default defineConfig({
  manifest: {
    name: 'TomoBreak',
    description: 'A companion that cares about you and never breaks your flow.',
    // `commands` is a manifest key (added in Phase 7), not a permission.
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'idle', 'notifications', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
  // Vite's modulepreload polyfill contains a fetch() call; we need none.
  vite: () => ({
    build: { modulePreload: { polyfill: false } },
  }),
});
