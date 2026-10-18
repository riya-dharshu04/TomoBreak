# TomoBreak Privacy Policy

_Last updated: October 18, 2026_

TomoBreak is a wellness companion for Chrome. It is built so that **nothing you do ever leaves your
device**.

## What TomoBreak does not do

- It makes **no network requests** of any kind. There is no server, account or sync.
- It contains **no analytics, tracking, ads or telemetry**.
- It loads **no remote code**; everything it runs ships inside the extension.
- It does **not sell, share or transfer** any data, because it never sends data anywhere.

## What is stored, and where

Everything below lives only in your browser's extension storage (`chrome.storage`) on your device:

| Data | Why |
| --- | --- |
| Settings (modes, intervals, goals, quiet hours, site lists, reactions) | So TomoBreak works the way you chose. |
| Which character you chose | So your chosen buddy can visit. |
| Daily answer counts per mode (e.g. "4 × Yes to hydration on Oct 18") | Streaks, the weekly summary and the stats page. |
| Bond data (affection, unlocked rewards) | The character's mood and rewards. |
| Reminder timing (next due times, Pomodoro phase, last reaction time) | Scheduling. |
| Recent activity **timestamps** (last activity, last typing), kept in session storage and cleared when the browser closes | To wait for a natural pause instead of interrupting you. |

## What TomoBreak reads from pages

- **Activity**: the content script notices *that* you typed, scrolled or moved the pointer, and tells
  the extension's background worker at most once every 5 seconds. It never records **which** keys you
  pressed, what you typed, or anything else on the page.
- **Typing check**: before showing the character, it checks whether a text field is focused, so it
  never appears while you type. Field contents are never read.
- **Site adapters** (only on leetcode.com and github.com, only if "Coding wins" is on): they look for
  result labels such as "Accepted", "Wrong Answer" or a pull request's "Merged" state, to celebrate
  with you. Nothing else is read, and nothing is stored or sent.
- **Tab information**: the active tab's address is used to decide whether the character can appear
  there (e.g. not on meeting sites, blocked sites or browser pages), and for the optional social-media
  nudge. The number of open tabs is used for the tab-overload joke. Addresses are not stored, except
  the site lists you type in yourself.

## Permissions

- `storage`: keep the data above on your device.
- `alarms`: schedule reminders and Pomodoro phases.
- `idle`: wait until you are back before showing a reminder.
- `notifications`: show reminders on pages where the character cannot appear.
- `tabs`: find the active tab, detect fullscreen and meeting tabs, and count tabs.
- Access to all sites: lets the character appear on whichever page you are viewing.

## Your control

- Turn TomoBreak off at any time from the popup; every reaction can be switched off in settings.
- Removing the extension deletes all of its data from your browser.

## Contact

Questions about this policy? Open an issue in the project's repository.
