# Spec — Auto Mark Sent on Send (Kirim)

Date: 2026-11-12
Status: approved (chat), pending implementation
Depends on: nothing (independent of other specs)

## Problem

Clicking **Kirim** opens WhatsApp but never marks the contact as sent, so the card stays in the
"Belum terkirim" list and does not move down to the "Sudah terkirim (n)" section. The user must
mark every contact by hand.

Root cause: `openWa()` in `src/App.svelte` guards the `sentAt` write behind the return value of
`window.open`:

```js
const win = window.open(url, '_blank', 'noopener')
if (win) { contact.sentAt[active.id] = new Date().toISOString() }
else { blockedUrl = url; notify(t('popupBlocked')) }
```

Per browser behavior, when the `noopener` feature is present `window.open()` **always returns
`null`**. So `win` is always falsy, the `sentAt` write is skipped, and the "Popup diblokir" notice
fires on every send.

Evidence (Playwright repro against `vite preview`, click first card's Kirim):

```
window.open returned: null
sentBefore: 0
sentAfter: 0        <- click did not mark sent
sent-section present: 0
```

## Decision

1. **`openWa` always marks the contact sent** for the active template when Kirim is clicked,
   regardless of the `window.open` result. The user's click is the explicit intent.
2. **Remove the "Popup diblokir" fallback.** It is now always false and never useful: `blockedUrl`
   state, its resets, the alert link UI, the i18n key, and the now-unused `.alert-link` CSS.

## Ordering

No new ordering code. Ordering already exists in `src/lib/RecipientTable.svelte`:

- `splitBySent(listContacts, template.id)` splits into `unsent` / `sent`.
- When `statusFilter === 'all'` and any sent exist, `unsent` render in the top list and `sent`
  render inside `.sent-section` ("Sudah terkirim (n)", collapsed) at the bottom.

Because the sent list was never populated, this section never appeared. After decision 1 it works
automatically: unsent stay on top, sent move to the very bottom.

## Behavior after change

- Click **Kirim** on a card -> WhatsApp opens (unchanged) AND the contact is marked sent for the
  active template -> the card moves to "Sudah terkirim (n)".
- Click **Buka lagi** on an already-sent card -> still opens WhatsApp; `sentAt` is refreshed to a
  new ISO timestamp (same overwrite semantics as today).
- Manual mark toggle (the check / x icon button) is unchanged.
- Marking persists through the existing `store.scheduleSave(data)` effect.

## Components touched

- `src/App.svelte` — rewrite `openWa`; remove `blockedUrl` state, its two resets, and the
  `alert-link` block.
- `src/lib/i18n.svelte.js` — remove `popupBlocked` (EN + ID).
- `src/styles.css` — remove the now-unused `.alert-link` rule.

## Non-goals

- No reliable popup-blocked detection (impossible with `noopener`).
- No change to `splitBySent`, the sent section, `sendMode`, or focus mode.
- No new i18n string.

## Risks

- On a desktop browser with a strict popup blocker, a contact is marked sent even though WhatsApp
  never opened. Accepted: the click is explicit intent and "Buka lagi" is available on the sent
  card to retry.

## Testing

- Playwright repro asserts `sentAfter >= 1` and `.sent-section` present after clicking Kirim.
- `npm run build` passes with no warnings.
- `npm test` passes.
- Manual: send a card, confirm it leaves the top list and appears under "Sudah terkirim (n)".
