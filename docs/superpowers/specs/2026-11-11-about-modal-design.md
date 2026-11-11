# Spec — About Modal

Date: 2026-11-11
Branch: `feat/labels-variables-contact-import` (same branch; independent of the labels work)
Status: approved (chat), pending implementation

## Problem

The app has Help and Import modals but nothing that says what the app is, its version,
its tech, or who made it.

## Decision

Add an **About modal**, same pattern as `HelpModal.svelte`. No router; the app is a
single-page Svelte app with overlay modals.

- Trigger: an "About" button in the desktop toolbar (next to Help) and an item in the
  mobile menu. Never opens automatically.
- Content: app name + version + year, feature summary, tech + privacy line, WhatsApp
  disclaimer, creator card (name, GitHub repo, email).
- Version comes from `package.json` (`import pkg from '../../package.json'`) so it is a
  single source of truth. Year computed at runtime.

## Non-goals

- No routing, no separate URL, no auto-open on first visit.
- No changelog, no license page, no analytics.

## Components

- `src/lib/AboutModal.svelte` (new) — props `{ t, onClose }`. Reuses `.overlay`,
  `.modal-card`, `.modal-header`, `.modal-body`, `.modal-actions` styles. Escape, backdrop
  click, focus-on-mount, focus-restore-on-unmount copied from `HelpModal.svelte`.
- `src/lib/Icon.svelte` — add one `info` icon.
- `src/App.svelte` — `showAbout` state, header button, mobile menu item, render.
- `src/lib/i18n.svelte.js` — EN + ID strings.
- `src/styles.css` — `.about-*` classes.
- `docs/USAGE.md` — usage section.

## Testing

No new pure logic (markup + a JSON import), so no new unit test. Verify with
`npm run build` (proves the JSON import resolves) and a manual pass: open from header and
from mobile menu, close via button / Escape / backdrop, focus returns to the trigger.

## Risk

Importing `package.json` outside `src/` is supported by Vite (inside the project root).
Fallback if a build/dev error appears: expose the version through `vite.config.js` with
`define: { __APP_VERSION__: JSON.stringify(pkg.version) }` and use `__APP_VERSION__`.
