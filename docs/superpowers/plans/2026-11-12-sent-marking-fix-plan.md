# Implementation Plan — Auto Mark Sent on Send (Kirim)

Spec: `docs/superpowers/specs/2026-11-12-sent-marking-fix-design.md`
Date: 2026-11-12
Repo root: `E:\CODING\broadcast_reverse_whatsapp`

## Goal

Clicking **Kirim** must mark the contact as sent for the active template, so the card moves from
the top list into the "Sudah terkirim (n)" section. Also remove the always-false "Popup diblokir"
fallback.

## Constraints for the executor

- Do NOT change `splitBySent`, the sent section, `sendMode`, or focus mode.
- Do NOT add new i18n strings.
- Use the exact edits below. Match on the given code text, not on line numbers (numbers may drift).
- After every edit run `npm run build` (must pass, no warnings).
- Final: run `npm test` (must pass) and the Playwright check in Task 5.

---

## Task 1 — Rewrite `openWa` (src/App.svelte)

Find this function (currently ~line 793):

```js
  function openWa(contact) {
    if (!active) return
    const text = render(active.body, contact, active, lang())
    const url = buildWaUrl(contact.phone, text)
    const win = window.open(url, '_blank', 'noopener')
    if (win) {
      contact.sentAt ??= {}
      contact.sentAt[active.id] = new Date().toISOString()
    } else {
      blockedUrl = url
      notify(t('popupBlocked'))
    }
    if (url.length > 8000) notify(t('urlTooLong'))
  }
```

Replace with:

```js
  function openWa(contact) {
    if (!active) return
    const text = render(active.body, contact, active, lang())
    const url = buildWaUrl(contact.phone, text)
    window.open(url, '_blank', 'noopener')
    contact.sentAt ??= {}
    contact.sentAt[active.id] = new Date().toISOString()
    if (url.length > 8000) notify(t('urlTooLong'))
  }
```

Why: `window.open(..., 'noopener')` always returns `null`, so the old `if (win)` guard skipped the
`sentAt` write on every send.

Verify: `npm run build`.

---

## Task 2 — Remove `blockedUrl` state and resets (src/App.svelte)

2a. Delete the state declaration (~line 54):

```js
  let blockedUrl = $state('')
```

2b. In `notify()` (~line 335), remove the reset line:

```js
  function notify(message) {
    notice = message
    blockedUrl = ''
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 6000)
  }
```

becomes:

```js
  function notify(message) {
    notice = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 6000)
  }
```

2c. In `clearNotice()` (~line 342), remove the reset line:

```js
  function clearNotice() {
    clearTimeout(noticeTimer)
    notice = ''
    blockedUrl = ''
  }
```

becomes:

```js
  function clearNotice() {
    clearTimeout(noticeTimer)
    notice = ''
  }
```

Verify: `grep -n "blockedUrl" src/App.svelte` returns nothing after Task 3 too.

---

## Task 3 — Remove the alert link UI (src/App.svelte)

Find (~line 1199):

```svelte
      <div class="alert-body">
        <span>{notice}</span>
        {#if blockedUrl}
          <a class="alert-link" href={blockedUrl} target="_blank" rel="noopener">
            {blockedUrl.slice(0, 64)}…
          </a>
        {/if}
      </div>
```

Replace with:

```svelte
      <div class="alert-body">
        <span>{notice}</span>
      </div>
```

Verify: `grep -n "blockedUrl" src/App.svelte` returns nothing. `npm run build`.

---

## Task 4 — Remove `popupBlocked` i18n keys (src/lib/i18n.svelte.js)

4a. English dict (~line 280), delete:

```js
    popupBlocked: 'Popup blocked. Open this link manually:',
```

4b. Indonesian dict (~line 577), delete:

```js
    popupBlocked: 'Popup diblokir. Buka link ini manual:',
```

Verify: `grep -rn "popupBlocked" src` returns nothing. `npm run build`.

---

## Task 5 — Remove unused `.alert-link` CSS (src/styles.css)

Find (~line 577):

```css
.alert-link {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

Delete the whole rule. (Only used by the removed alert link.)

Verify: `grep -rn "alert-link" src` returns nothing. `npm run build`.

---

## Task 6 — Verification

6a. Build + tests:

```
npm run build
npm test
```

Both must pass.

6b. Playwright behavior check. Start preview if not running:

```
npm run preview
```

(Default port 4174. Adjust the URL below if different.)

Create a throwaway script OUTSIDE the repo (e.g. in the Playwright npx dir) that seeds
`localStorage['wa-broadcast:v1']` with one template + a few contacts, clicks the first card's
`.clist-row .btn.wa`, then asserts:

- `window.open` was called (returns null — expected, that is fine now).
- The contact is marked sent: parse `localStorage['wa-broadcast:v1']` and count
  `contacts.filter(c => c.sentAt?.tpl1).length >= 1`.
- `.sent-section` exists in the DOM.
- The first card is gone from the top `.clist` list.

Reference seed shape (SCHEMA_VERSION = 5):

```js
const state = {
  schemaVersion: 5,
  updatedAt: new Date().toISOString(),
  groups: [], templateGroups: [],
  templates: [{ id: 'tpl1', name: 'PROMOSI PAKET BARU', body: 'Hi {nama}',
    globals: {}, auto: {}, vars: [{ key: 'nama', label: 'Nama' }],
    groupId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  contacts: [
    { id: 'c0', phone: '62852344113', name: 'DAVID LAMUNGKUN', labels: ['GASTRA NETWORK - Take Over'], values: {}, sentAt: {} },
    // ...more contacts
  ],
}
```

Inject with `page.addInitScript((s) => localStorage.setItem('wa-broadcast:v1', JSON.stringify(s)), state)`
before `page.goto`.

Expected before fix: `sentAfter: 0`, `sent-section present: 0`.
Expected after fix: `sentAfter >= 1`, `sent-section present: 1`.

6c. Manual check (mobile + desktop, dark + light): click Kirim on a card; confirm it leaves the
top list and appears under "Sudah terkirim (n)" at the bottom; expand the section to confirm.

---

## Task 7 — Docs (optional but preferred)

`docs/USAGE.md`: if it describes the send flow, note that clicking **Kirim** marks the contact as
sent automatically and moves it under "Sudah terkirim (n)". Keep wording Indonesian, consistent
with surrounding text. Skip if already covered.

---

## Rollback

Revert the changes to `src/App.svelte`, `src/lib/i18n.svelte.js`, and `src/styles.css`. No data
migration is involved (`sentAt` shape is unchanged); already-written `sentAt` values stay valid.

## Done checklist

- [ ] `openWa` marks sent unconditionally (Task 1)
- [ ] `blockedUrl` state + resets removed (Task 2)
- [ ] alert link UI removed (Task 3)
- [ ] `popupBlocked` EN + ID removed (Task 4)
- [ ] `.alert-link` CSS removed (Task 5)
- [ ] `npm run build` passes, no warnings (Task 6)
- [ ] `npm test` passes (Task 6)
- [ ] Playwright check: `sentAfter >= 1`, `.sent-section` present (Task 6)
- [ ] Manual mobile + desktop confirm (Task 6)
- [ ] `grep -rn "blockedUrl\|popupBlocked\|alert-link" src` empty
