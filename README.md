# TomoBreak

**A companion that cares about you and never breaks your flow.**

TomoBreak is a Manifest V3 Chrome extension. A small animated character walks onto the page you're
viewing, stops near the centre and talks to you in a chat bubble: it reminds you to drink water, rest
your eyes, fix your posture, stretch, runs Pomodoro sessions, or just does a silly dance and tells a
joke. It reacts to your answers, remembers how well you take care of yourself, and waits for a natural
pause instead of interrupting focused work.

Everything stays on your device: no network requests, no analytics, no remote code. See
[PRIVACY.md](PRIVACY.md).

## Features

- **3 original characters** (Hana, Kenta, Kitsu) drawn as inline SVG with idle, walk, talk, happy,
  sad, sleepy and surprised states, plus **your own uploads** (PNG/GIF/WebP, up to 2 MB, 1–4 states;
  missing states are animated with CSS effects).
- **Onboarding on one screen**: character → modes → intervals, with a live preview.
- **Wellness modes**: Hydration, Eye break (20-20-20 with a 20 s countdown), Posture, Stretch (8 desk
  stretches with a 30 s timer and matching poses), Pomodoro (from the popup; reminders are held back
  and bundled into the break), Entertainment (comedy dance + one of 66 wholesome jokes).
- **Focus-aware timing**: due reminders wait for a natural pause (20 s without typing, a tab switch,
  a navigation, coming back to your desk). Never while typing, in fullscreen, on a call or in quiet
  hours. Within 10 minutes of the due time it shows anyway, gently peeking in from the edge. Several
  due reminders merge into one visit ("Water and a quick stretch?"), at least 5 minutes apart.
- **Bond system**: affection 10–100 per character, mood (thrilled / happy / okay / worried), daily
  streaks per mode with configurable goals, unlocks at 3 / 7 / 14 / 30 days (new dance, party hat,
  new lines, special celebration), a weekly summary card, and 7/30-day charts on the stats page.
- **Context reactions** (each can be turned off, max one per 15 min): late night, 2-hour sessions,
  25+ tabs, LeetCode/GitHub coding wins, and an opt-in social-media nudge.
- **Accessible**: keyboard-usable bubble, Escape = Snooze, `aria-live` speech, reduced-motion fade,
  light/dark mode, Windows High Contrast support, and **Alt+Shift+H** to hide the buddy instantly.
- **Fallback**: on pages that can't run content scripts (chrome:// pages, the Web Store, PDFs) the
  reminder arrives as a system notification with Yes / No buttons (closing it = Snooze).

## Setup

Requires Node.js 20+ and Chrome.

```bash
npm install
npm run dev        # opens Chrome with the extension loaded and auto-reloading
npm run typecheck  # tsc --noEmit (strict); must report zero errors
npm run build      # production build in .output/chrome-mv3
npm run zip        # store-ready zip in .output/tomobreak-<version>-chrome.zip
```

To load a production build by hand: open `chrome://extensions`, enable **Developer mode**, choose
**Load unpacked** and select `.output/chrome-mv3`.

After installing, **reload tabs that were already open** so they get the content script.

## Testing

### The debug panel

Open the popup and click the version number (bottom right) **5 times**. The debug panel offers:

- **Fast intervals**: every interval becomes 1 minute, the gap between visits 1 minute, the 10-minute
  limit 2 minutes, and the reaction thresholds a few minutes (long session 3 min, social nudge 2 min).
- **Scenario + Visit now**: shows any visit immediately on the current tab, skipping every timing
  rule: each mode, a merged visit, a Pomodoro break and break-over, the weekly summary, an unlock
  celebration, and every reaction.

### Checks per feature

| Feature | How to test |
| --- | --- |
| Onboarding | Fresh install opens the setup page. Pick characters/modes and watch the preview. Save. |
| Custom character | Setup → *Upload your own*. Try a >2 MB file (rejected), then one PNG. Select it and press *Play again*. |
| Hydration | Debug → Hydration. **Yes** = 5 s dance; **No** = sad face then "Go grab some, I'll wait!". |
| Eye break | Debug → Eye break → *Start*: eyes close, 20 s countdown, then a thank-you. |
| Posture | Debug → Posture: the character slouches, then straightens up. |
| Stretch | Debug → Stretch → *Let's do it*: instruction + 30 s timer + matching pose. |
| Entertainment | Debug → Entertainment: dance, then a joke. |
| Merging | Turn on several modes with Fast intervals; they arrive together as one visit. |
| Pomodoro | Enable Pomodoro in Setup, set focus to 1 min (or use Fast intervals), start it in the popup. Other reminders wait; the break visit delivers them. |
| Typing | With Fast intervals, keep typing in a text box: nothing appears. Stop for ~20 s: it walks in. |
| 10-minute limit | Keep scrolling/clicking without pausing (not in a text box): after 2 min (fast mode) it peeks in from the edge. |
| Fullscreen / calls | Fullscreen a video, or have a meet.google.com tab playing audio: nothing appears. |
| Notification fallback | Stay on `chrome://extensions` when a reminder is due: a notification appears. |
| Quiet hours | Set quiet hours around now and save: the popup says "Quiet hours until…". |
| Bond & stats | Answer a few visits, then open *Bond & stats*: affection, mood, streaks, unlocks, charts. |
| Unlocks | Debug → Unlock celebration (a demo; real unlocks come from streaks). |
| Weekly summary | Debug → Weekly summary. In real use it appears on the first visit of each week. |
| Reactions | Debug → each reaction. Real triggers: open 26+ tabs; get "Accepted" on LeetCode; merge a PR on GitHub. |
| Shortcut | During a visit press **Alt+Shift+H**: the buddy vanishes (counts as Snooze). Change it at `chrome://extensions/shortcuts`. |
| Off switch | Turn visits off in the popup during a visit: everything disappears at once. |
| No leftovers | After a visit, DevTools → Elements: no `tomobreak-buddy` element remains. |
| No network | DevTools → Network while a visit plays: no requests from the extension. |
| Restart | Restart Chrome: schedules, streaks and Pomodoro continue. |

## Architecture

```
entrypoints/
  background.ts          service worker: events → scheduler/delivery, message routing
  content/index.ts       activity reports, site adapters, plays visits
  popup/                 on/off, status, mood, Pomodoro timer, debug panel
  options/               onboarding (3 steps + live preview), reactions, bond & stats
lib/
  storage.ts             typed chrome.storage access, defaults, versioned migrations
  messaging.ts           typed message helpers
  scheduler.ts           due times, alarms, visit slot, answers
  delivery.ts            when and where the buddy appears (focus rules, fallbacks)
  focus.ts               pause detection, quiet hours, site matching
  bond.ts                affection, mood, streaks, unlocks, weekly summary
  pomodoro.ts            Pomodoro phases on alarms
  reactions.ts           context reaction detection
  modes.ts, stats.ts, characters.ts, notify.ts, dom.ts
  overlay/               Shadow-DOM overlay (stage), visit scripts (flows), activity tracker
  adapters/              LeetCode and GitHub result watchers
utils/types.ts           every stored object and message type
assets/characters/       default SVG characters and animation CSS
data/                    dialogue, 66 jokes, 8 stretches
```

Key rules the code follows:

- **The service worker keeps no state in memory.** Everything is in `chrome.storage` (activity
  timestamps in `chrome.storage.session`), and every wake-up is a `chrome.alarms` alarm. There is no
  `setTimeout`/`setInterval` in the service worker.
- **The content script stays light.** It sends a throttled activity flag (max one message per 5 s,
  never key data) and builds DOM only during a visit. The overlay host uses a closed shadow root and
  is removed completely afterwards.
- **Strict TypeScript, no `any`.** All messages are discriminated unions in `utils/types.ts`, sent
  through `lib/messaging.ts`, and handler maps must cover every message type.

### Adding a site adapter

Create `lib/adapters/<site>.ts` exporting a `SiteAdapter` (`id`, `hosts`, `start(emit)`), use
`watchPage()` from `lib/adapters/watch.ts` to react to page changes, and add it to `ADAPTERS` in
`lib/adapters/index.ts`. Adapters may only look for result text and emit `codingWin` or `codingFail`.

### Data model and migrations

`chrome.storage.local` holds `version`, `settings`, `characters`, `schedule`, `stats`, `bond`,
`pomodoro`, `reactions`, plus one `charimg:<id>` key per uploaded character. To change a stored shape,
bump `STORAGE_VERSION` in `lib/storage.ts` and add a step to `MIGRATIONS`; missing keys and new
settings are filled from defaults on install, update and browser start.

## Chrome Web Store submission checklist

- [ ] `npm run typecheck` and `npm run build` report zero errors.
- [ ] Bump `version` in `package.json` (WXT copies it into the manifest).
- [ ] `npm run zip` and upload `.output/tomobreak-<version>-chrome.zip`.
- [ ] Load the zip's contents unpacked once more and smoke-test: onboarding, a visit, the popup, the
      options tabs, and the notification fallback on `chrome://extensions`.
- [ ] Check DevTools on Google, YouTube, GitHub, LeetCode and Wikipedia: no console errors, no
      network requests from the extension.
- [ ] **Store listing**: name "TomoBreak", summary "A companion that cares about you and never breaks
      your flow.", a detailed description (feature list above), category *Productivity* (or
      *Lifestyle*), language.
- [ ] **Graphics**: 128×128 icon (`public/icons/128.png`), at least one 1280×800 (or 640×400)
      screenshot (a visit on a page, the onboarding page, the stats page), optional 440×280 small
      promo tile.
- [ ] **Privacy practices tab**:
  - Single purpose: "A wellness companion that shows friendly break reminders on the page you're
    viewing."
  - Permission justifications:
    - `storage`, `unlimitedStorage`: settings, stats and uploaded character images, on device only.
    - `alarms`: reminder and Pomodoro timing (MV3 service workers can't keep timers).
    - `idle`: wait until you're back at your desk before showing a reminder.
    - `notifications`: fallback on pages where the character can't appear.
    - `tabs`: show only in the active tab, detect fullscreen/meeting tabs and count tabs.
    - Host permission `<all_urls>`: the character must be able to appear on any page you visit.
  - Remote code: **No**.
  - Data usage: declare that **no user data is collected or transmitted**.
  - Link the privacy policy (host `PRIVACY.md`, e.g. on GitHub Pages or the repository).
- [ ] Mention the keyboard shortcut (Alt+Shift+H) and the opt-in social nudge in the description.
- [ ] Confirm no copyrighted characters ship (Hana, Kenta and Kitsu are original artwork).
- [ ] Submit for review; reply to reviewer questions with the justifications above.
