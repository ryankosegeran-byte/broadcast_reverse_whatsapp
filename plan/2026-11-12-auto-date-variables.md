# Implementation Plan — Auto Date Variables

Spec: `docs/superpowers/specs/2026-11-12-auto-date-variables-design.md`
Status: ready to implement

Follow existing patterns: Svelte 5 runes, all user-facing text via `t('key')` with EN + ID in
`src/lib/i18n.svelte.js`, modal structure copied from `src/lib/HelpModal.svelte`, plain logic in
dependency-free `src/lib/*.js` modules with `node:test` unit tests.

Tasks are in dependency order. Do them in sequence; each one leaves the app buildable.

---

## Task 1 — `src/lib/dates.js` (new file)

Create with exactly this content:

```js
/** Auto date presets for template variables. Order is the order shown in the picker. */
export const AUTO_PRESETS = [
  'dateMonthYear',
  'monthName',
  'year',
  'monthNum',
  'monthYear',
  'dayName',
  'numericDate',
]

const LOCALES = { id: 'id-ID', en: 'en-US' }

export function isAutoPreset(value) {
  return AUTO_PRESETS.includes(value)
}

/** App language is mirrored onto <html lang> by applyLang(); fall back to Indonesian. */
export function currentLang() {
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    return document.documentElement.lang
  }
  return 'id'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Value for an auto date variable. `preset` is one of AUTO_PRESETS; anything else returns ''.
 * Month/day names follow the app language. Numeric presets are always dd/MM/yyyy style.
 */
export function formatAutoDate(preset, date = new Date(), lang = currentLang()) {
  if (!isAutoPreset(preset)) return ''
  const locale = LOCALES[lang] ?? LOCALES.en
  const fmt = (options) => new Intl.DateTimeFormat(locale, options).format(date)
  switch (preset) {
    case 'dateMonthYear':
      return fmt({ day: 'numeric', month: 'long', year: 'numeric' })
    case 'monthName':
      return fmt({ month: 'long' })
    case 'year':
      return fmt({ year: 'numeric' })
    case 'monthNum':
      return pad2(date.getMonth() + 1)
    case 'monthYear':
      return pad2(date.getMonth() + 1) + '/' + date.getFullYear()
    case 'dayName':
      return fmt({ weekday: 'long' })
    case 'numericDate':
      return pad2(date.getDate()) + '/' + pad2(date.getMonth() + 1) + '/' + date.getFullYear()
    default:
      return ''
  }
}
```

Notes:

- No imports. Must not import `i18n.svelte.js` (it uses `$state`, which Node's test runner cannot
  parse).
- Verified outputs for `new Date(2026, 10, 12)` (Thursday):
  `id-ID` → `12 November 2026` / `November` / `2026` / `Kamis`;
  `en-US` → `November 12, 2026` / `November` / `Thursday`.

---

## Task 2 — `src/lib/dates.test.js` (new file)

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_PRESETS, formatAutoDate, isAutoPreset } from './dates.js'

const day = new Date(2026, 10, 12) // 12 November 2026, a Thursday

test('formats every preset in Indonesian', () => {
  assert.equal(formatAutoDate('dateMonthYear', day, 'id'), '12 November 2026')
  assert.equal(formatAutoDate('monthName', day, 'id'), 'November')
  assert.equal(formatAutoDate('year', day, 'id'), '2026')
  assert.equal(formatAutoDate('monthNum', day, 'id'), '11')
  assert.equal(formatAutoDate('monthYear', day, 'id'), '11/2026')
  assert.equal(formatAutoDate('dayName', day, 'id'), 'Kamis')
  assert.equal(formatAutoDate('numericDate', day, 'id'), '12/11/2026')
})

test('formats names in English', () => {
  assert.equal(formatAutoDate('monthName', day, 'en'), 'November')
  assert.equal(formatAutoDate('dayName', day, 'en'), 'Thursday')
  assert.equal(formatAutoDate('dateMonthYear', day, 'en'), 'November 12, 2026')
})

test('numeric presets stay zero-padded and locale-independent', () => {
  const jan = new Date(2026, 0, 5)
  assert.equal(formatAutoDate('monthNum', jan, 'en'), '01')
  assert.equal(formatAutoDate('monthYear', jan, 'en'), '01/2026')
  assert.equal(formatAutoDate('numericDate', jan, 'en'), '05/01/2026')
})

test('unknown presets are rejected', () => {
  assert.equal(formatAutoDate('nope', day, 'id'), '')
  assert.equal(formatAutoDate(undefined, day, 'id'), '')
  assert.equal(isAutoPreset('monthName'), true)
  assert.equal(isAutoPreset('nope'), false)
  assert.equal(AUTO_PRESETS.length, 7)
})
```

Run `npm run test` — this file must pass before continuing.

---

## Task 3 — `src/lib/vars.js`: auto branch in `resolve()`

Add the import at the top, after the first line:

```js
import { formatAutoDate, isAutoPreset } from './dates.js'
```

Replace the whole `resolve` function (current body ends with `return ''`, line 19) with:

```js
/** First non-empty wins: per-contact value, contact name, auto date, template globals. */
export function resolve(key, contact, template) {
  const own = template?.id ? contact?.values?.[template.id]?.[key] : undefined
  if (own !== undefined && own !== null && own !== '') return String(own)
  if (key === 'nama' && contact?.name) return contact.name
  const preset = template?.auto?.[key]
  if (isAutoPreset(preset)) return formatAutoDate(preset)
  const global = template?.globals?.[key]
  if (global !== undefined && global !== null && global !== '') return String(global)
  return ''
}
```

No other change in this file. Do not touch `render`, `detectVariables`, `templateVarKeys`,
`varLabel`.

---

## Task 4 — `src/lib/storage.js`: schema v3 + `auto` field

1. Line 4: bump the version.

```js
export const SCHEMA_VERSION = 3
```

2. Add the import after the `contacts.js` import (line 2):

```js
import { isAutoPreset } from './dates.js'
```

3. In `migrate()`, inside the template `.map(...)`, insert this right after the `globals:` line:

```js
      auto: t.auto && typeof t.auto === 'object'
        ? Object.fromEntries(
            Object.entries(t.auto).filter(
              ([key, preset]) => /^[\w.-]+$/.test(key) && isAutoPreset(preset)
            )
          )
        : {},
```

4. In `mergeStates()`, right after the existing `globals` fill loop (ends with
   `if (!t.globals[key]) t.globals[key] = value`, around line 151), add:

```js
    for (const [key, preset] of Object.entries(source.auto ?? {})) {
      if (!isAutoPreset(preset)) continue
      if (!t.auto) t.auto = {}
      if (!t.auto[key]) t.auto[key] = preset
    }
```

`emptyState()` needs no change.

5. Update the stale test title in `src/lib/storage.test.js` line 63–71 from
   `migrate upgrades v1 to v2 with labels and vars` to
   `migrate upgrades v1 to v3 with labels, vars, and auto` and make the body:

```js
test('migrate upgrades v1 to v3 with labels, vars, and auto', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '{{x}}' }],
    contacts: [{ phone: '62811111', name: 'Budi' }],
  })
  assert.equal(state.schemaVersion, 3)
  assert.deepEqual(state.templates[0].vars, [])
  assert.deepEqual(state.templates[0].auto, {})
  assert.deepEqual(state.contacts[0].labels, [])
})
```

Also update `validateState ... for v1 and v2` (line 102–121): change the two
`assert.equal(...).schemaVersion, 2` → `3`, and rename the test to
`validateState returns template, contact, and unique label counts for v1 and v2`.

6. Add these two tests at the end of `src/lib/storage.test.js`:

```js
test('migrate keeps valid auto presets and drops invalid ones', () => {
  const state = migrate({
    templates: [
      {
        name: 'A',
        body: '{{bulan}} {{tahun}}',
        auto: { bulan: 'monthName', tahun: 'nope', 'bad key!': 'year' },
      },
    ],
    contacts: [],
  })
  assert.deepEqual(state.templates[0].auto, { bulan: 'monthName' })
})

test('mergeStates fills missing auto entries and keeps local ones', () => {
  const local = emptyState()
  local.templates.push({
    id: 't1',
    name: 'Bills',
    body: '',
    vars: [],
    globals: {},
    auto: { bulan: 'monthNum' },
  })
  const incoming = emptyState()
  incoming.templates.push({
    id: 't1',
    name: 'Bills',
    body: '',
    vars: [],
    globals: {},
    auto: { bulan: 'monthName', tahun: 'year' },
  })

  mergeStates(local, incoming)

  assert.deepEqual(local.templates[0].auto, { bulan: 'monthNum', tahun: 'year' })
})
```

`npm run test` must pass before continuing.

---

## Task 5 — `src/lib/i18n.svelte.js`: strings

Add to the `en` dict, right after `globalHint: 'Default applies when a contact value is blank.',`
(line 93):

```js
    autoSet: 'Auto',
    autoChange: 'Change',
    autoClear: 'Clear',
    autoDateTitle: 'Auto value',
    autoDateDesc: 'Uses today’s date on this device and updates on its own.',
    autoNone: 'Manual value',
    autoNoneHint: 'Type the value yourself',
    autoPreset_dateMonthYear: 'Date, month name, year',
    autoPreset_monthName: 'Month name',
    autoPreset_year: 'Year',
    autoPreset_monthNum: 'Month number',
    autoPreset_monthYear: 'Month number / year',
    autoPreset_dayName: 'Day name',
    autoPreset_numericDate: 'Date as numbers',
```

Add to the `id` dict, right after `globalHint: 'Dipakai saat nilai kontak kosong.',` (line 302):

```js
    autoSet: 'Otomatis',
    autoChange: 'Ubah',
    autoClear: 'Hapus',
    autoDateTitle: 'Nilai otomatis',
    autoDateDesc: 'Pakai tanggal hari ini di perangkat dan berubah sendiri.',
    autoNone: 'Nilai manual',
    autoNoneHint: 'Isi sendiri nilainya',
    autoPreset_dateMonthYear: 'Tanggal, nama bulan, tahun',
    autoPreset_monthName: 'Nama bulan',
    autoPreset_year: 'Tahun',
    autoPreset_monthNum: 'Nomor bulan',
    autoPreset_monthYear: 'Nomor bulan / tahun',
    autoPreset_dayName: 'Nama hari',
    autoPreset_numericDate: 'Tanggal angka',
```

Do not add these to `helpItems`.

---

## Task 6 — `src/lib/Icon.svelte`: add a `calendar` icon

Insert one branch right after the `info` branch (line 51):

```svelte
    {:else if name === 'calendar'}
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" />
```

---

## Task 7 — `src/lib/AutoDateModal.svelte` (new file)

```svelte
<script>
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import { AUTO_PRESETS, formatAutoDate } from './dates.js'

  let { t, varKey, value, onPick, onClose } = $props()

  let dialogEl = $state(null)

  onMount(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function pick(preset) {
    onPick(preset)
    onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-auto"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auto-date-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="auto-date-title" class="modal-title">{t('autoDateTitle')}</h2>
        <p class="modal-desc">{'{{' + varKey + '}}'} · {t('autoDateDesc')}</p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
      <div class="auto-options" role="radiogroup" aria-label={t('autoDateTitle')}>
        <button
          class="auto-option"
          type="button"
          role="radio"
          aria-checked={!value}
          onclick={() => pick('')}
        >
          <span class="auto-option-label">{t('autoNone')}</span>
          <span class="auto-option-preview">{t('autoNoneHint')}</span>
        </button>
        {#each AUTO_PRESETS as preset (preset)}
          <button
            class="auto-option"
            type="button"
            role="radio"
            aria-checked={value === preset}
            onclick={() => pick(preset)}
          >
            <span class="auto-option-label">{t('autoPreset_' + preset)}</span>
            <span class="auto-option-preview tabular">{formatAutoDate(preset)}</span>
          </button>
        {/each}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" type="button" onclick={onClose}>{t('cancel')}</button>
      </div>
    </div>
  </div>
</div>
```

`formatAutoDate(preset)` with no date/language arguments uses today and the app language. The
modal is mounted fresh each time it opens, so the preview is current.

---

## Task 8 — `src/App.svelte` wiring

1. Imports. After line 4 (`import { render, resolve, ... } from './lib/vars.js'`) add:

```js
  import { formatAutoDate } from './lib/dates.js'
```

After line 16 (`import AboutModal ...`) add:

```js
  import AutoDateModal from './lib/AutoDateModal.svelte'
```

2. State. After `let showAbout = $state(false)` (line 28) add:

```js
  let autoFor = $state(null)
```

3. `newTemplate()` (line 245) — add `auto: {}` to the new template object:

```js
    const tpl = {
      id: store.uid('tpl'),
      name: '',
      body: '',
      vars: [],
      globals: {},
      auto: {},
      createdAt: now,
      updatedAt: now,
    }
```

4. Helpers. After `removeVar` (ends line 393) add:

```js
  function autoValue(key) {
    return formatAutoDate(active?.auto?.[key], new Date(), lang())
  }

  function clearVarAuto(key) {
    if (!active?.auto) return
    delete active.auto[key]
  }
```

5. Variable row markup. Replace the whole `<div class="var-row-inputs">…</div>` block inside the
   `{#each valueVars as v (v)}` loop in the Variables panel (currently lines 1047–1063) with:

```svelte
                  <div class="var-row-inputs">
                    <input
                      class="input"
                      bind:value={
                        () => (active.vars ?? []).find((x) => x.key === v)?.label ?? '',
                        (val) => setVarLabel(v, val)
                      }
                      placeholder={t('varDisplayName')}
                      aria-label={t('varDisplayName') + ' ' + v}
                    />
                    {#if active.auto?.[v]}
                      <button
                        class="input auto-display"
                        type="button"
                        title={t('autoChange')}
                        onclick={() => (autoFor = v)}
                      >
                        <Icon name="calendar" size={12} />
                        <span>{autoValue(v)}</span>
                      </button>
                    {:else}
                      <input
                        class="input"
                        bind:value={() => active.globals[v] ?? '', (val) => (active.globals[v] = val)}
                        placeholder={t('varDefault')}
                        aria-label={t('varDefault') + ' ' + v}
                      />
                    {/if}
                  </div>
                  <div class="var-auto-row">
                    <button class="btn secondary xs" type="button" onclick={() => (autoFor = v)}>
                      <Icon name="calendar" size={12} />
                      <span>{active.auto?.[v] ? t('autoChange') : t('autoSet')}</span>
                    </button>
                    {#if active.auto?.[v]}
                      <span class="badge neutral sm" title={t('autoDateTitle')}>
                        {t('autoPreset_' + active.auto[v])}
                      </span>
                      <button
                        class="btn icon-btn danger-ghost xs"
                        type="button"
                        title={t('autoClear')}
                        aria-label={t('autoClear') + ' ' + v}
                        onclick={() => clearVarAuto(v)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    {/if}
                  </div>
```

6. Add-contact modal placeholder (line 1406). Replace the single `placeholder={...}` line with:

```svelte
                      placeholder={active.auto?.[v]
                        ? t('usingDefault', { val: autoValue(v) })
                        : active.globals?.[v]
                          ? t('usingDefault', { val: active.globals[v] })
                          : '-'}
```

7. Modal open guards. Add `|| autoFor` to the three guard checks so page shortcuts stay disabled
   while the picker is open:

- line 176: `if (showHelp || showAbout || showImport || showContactImport || editingId) return`
- line 578: same expression inside `openPasteModal()`
- line 594: same expression inside `openAddModal()`

becomes `if (showHelp || showAbout || showImport || showContactImport || editingId || autoFor) return`

8. Render the modal. After the `{#if showAbout}` block (lines 1303–1305) add:

```svelte
{#if autoFor && active}
  <AutoDateModal
    {t}
    varKey={autoFor}
    value={active.auto?.[autoFor] ?? ''}
    onPick={(preset) => {
      if (!preset) clearVarAuto(autoFor)
      else (active.auto ??= {})[autoFor] = preset
    }}
    onClose={() => (autoFor = null)}
  />
{/if}
```

---

## Task 9 — `src/styles.css`

Add near the other `.var-*` rules (after `.var-row-inputs .input`, line 1395):

```css
.var-auto-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.var-auto-row .btn.xs {
  min-height: 24px;
  padding: 0 8px;
  font-size: 11px;
}

.var-auto-row .badge.sm {
  font-size: 10.5px;
}

.input.auto-display {
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  cursor: pointer;
  font-weight: 500;
  color: color-mix(in oklab, var(--accent-strong) 88%, var(--foreground));
  border-color: color-mix(in oklab, var(--accent) 36%, var(--border));
  background: var(--accent-subtle);
}
```

Add near the other modal styles (after `.modal-card.modal-paste`, line 2152):

```css
.modal-card.modal-auto {
  width: min(460px, calc(100vw - 32px));
  max-width: 460px;
}

.auto-options {
  display: grid;
  gap: 6px;
}

.auto-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--foreground);
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.auto-option:hover {
  border-color: var(--accent);
}

.auto-option[aria-checked='true'] {
  border-color: var(--accent);
  background: color-mix(in oklab, var(--accent) 14%, transparent);
}

.auto-option-label {
  font-size: 12.5px;
  font-weight: 500;
}

.auto-option-preview {
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
  color: var(--muted-foreground, var(--border-strong));
}
```

Use only CSS variables already defined in the file; do not add new `:root` entries.

---

## Task 10 — `src/lib/vars.test.js`: auto resolution order

Add the import at the top:

```js
import { formatAutoDate } from './dates.js'
```

Add these tests at the end of the file:

```js
test('auto date beats the manual template default', () => {
  const tpl = { id: 'tpl_1', auto: { bulan: 'monthName' }, globals: { bulan: 'GLOBAL' } }
  assert.equal(resolve('bulan', contact, tpl), formatAutoDate('monthName'))
})

test('per-contact value beats the auto date', () => {
  const tpl = {
    id: 'tpl_1',
    auto: { total: 'monthName' },
    globals: { total: 'GLOBAL' },
  }
  assert.equal(resolve('total', contact, tpl), '55.161')
})

test('invalid auto preset falls through to the manual default', () => {
  const tpl = { id: 'tpl_1', auto: { bulan: 'nope' }, globals: { bulan: 'GLOBAL' } }
  assert.equal(resolve('bulan', contact, tpl), 'GLOBAL')
})

test('auto date works with no contact and no globals', () => {
  const tpl = { id: 'tpl_1', auto: { tahun: 'year' }, globals: {} }
  assert.equal(resolve('tahun', null, tpl), formatAutoDate('year'))
})
```

These compare against `formatAutoDate(...)` rather than a hardcoded month so the suite passes on
any day of the year.

---

## Task 11 — `docs/USAGE.md`

Add a section after the variables/global-default explanation:

```md
## Nilai otomatis dari tanggal

Tiap variabel punya nilai bawaan manual. Untuk variabel tanggal (mis. `bulan_ini`, `tahun_ini`)
sebaiknya pakai **Otomatis**:

1. Buka panel **Variabel**, buka template yang dipakai.
2. Klik **Otomatis** di baris variabel.
3. Pilih format di modal: tanggal + nama bulan + tahun, nama bulan saja, tahun, nomor bulan,
   nomor bulan/tahun, nama hari, atau tanggal angka.
4. Nilainya langsung dipakai di pratinjau, tabel kontak, dan placeholder form tambah kontak.

Nilai diambil dari tanggal perangkat saat pesan ditampilkan, jadi ikut berubah sendiri tiap hari.
Bahasa nama bulan dan nama hari mengikuti bahasa aplikasi (Indonesia/Inggris). Tombol **Hapus**
mengembalikan variabel ke nilai bawaan manual. Nilai per kontak tetap menang kalau diisi manual.
```

---

## Verification

```bash
npm run test
npm run build
npm run dev
```

Manual checklist:

- Panel Variabel: klik **Otomatis** pada `bulan_ini`, pilih "Nama bulan". Input bawaan berganti
  jadi tampilan nilai hari ini; badge preset muncul di bawahnya.
- Pratinjau pesan, tabel kontak, dan placeholder modal tambah kontak menampilkan nilai sama.
- Peringatan "variabel kosong" tidak lagi muncul untuk variabel ber-auto.
- Ganti bahasa app ke English: nama bulan/hari berubah (November/Thursday), angka tetap.
- **Hapus** mengembalikan input bawaan manual; nilai manual dipakai lagi.
- Isi nilai variabel itu pada satu kontak: nilai kontak yang menang.
- Reload halaman: pilihan auto tetap tersimpan.
- Buka modal dengan klik luar, tombol close, dan `Escape`; fokus balik ke elemen pemicu.
- Cek layout panel di lebar 760px dan 400px: baris variabel tidak tumpang tindih.
- Export backup, lalu import kembali: pilihan auto ikut terbawa.

Commit:

```
Add auto date variables with preset format picker
```
