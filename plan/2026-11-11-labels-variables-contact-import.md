# Implementation Plan — Labels, Variable Manager, Selection, CSV/VCF Import

Spec: `docs/superpowers/specs/2026-11-11-labels-variables-contact-import-design.md`
Branch: `feat/labels-variables-contact-import`

## How to use this plan

Work phases in order. After each phase run:

```bash
npm run test
npm run build
```

Both must be green before the next phase. Commit at the end of each phase with the given
message. Keep every change inside this branch. Match existing code style: Svelte 5 runes
(`$state`, `$derived`, `$props`, `$effect`), `t('key')` for all user-facing text, EN + ID
strings in `src/lib/i18n.svelte.js`, docs + Help modal updated when features change.

Reference before editing: `src/App.svelte`, `src/lib/RecipientTable.svelte`,
`src/lib/storage.js`, `src/lib/vars.js`, `src/lib/i18n.svelte.js`, `src/styles.css`,
`docs/USAGE.md`.

---

## Phase 1 — Data model v2, labels, filter, selection

### 1.1 `src/lib/storage.js`

- `export const SCHEMA_VERSION = 2`
- In `migrate()` template map, add after `globals`:

```js
      vars: Array.isArray(t.vars)
        ? t.vars
            .filter((v) => v && typeof v === 'object' && /^[\w.-]+$/.test(String(v.key ?? '')))
            .map((v) => ({ key: String(v.key), label: String(v.label ?? '') }))
            .filter((v, i, all) => all.findIndex((x) => x.key === v.key) === i)
        : [],
```

- In `migrate()` contact map, add after `name`:

```js
      labels: Array.isArray(c.labels)
        ? [...new Set(c.labels.map((l) => String(l).trim()).filter(Boolean))]
        : [],
```

- In `mergeStates()` templates loop, when a local template matches `incoming` by id
  (inside the existing `for (const t of local.templates)` loop, before the globals block),
  add:

```js
    t.vars ??= []
    for (const v of source.vars ?? []) {
      const cur = t.vars.find((x) => x.key === v.key)
      if (!cur) t.vars.push({ ...v })
      else if (!cur.label && v.label) cur.label = v.label
    }
```

- Replace the contacts loop in `mergeStates()` with a call to the shared helper (added in
  Phase 3). For Phase 1, keep the current loop but add label union inside the `existing`
  branch:

```js
    if (!existing.name && c.name) existing.name = c.name
    existing.labels ??= []
    for (const l of c.labels ?? []) if (!existing.labels.includes(l)) existing.labels.push(l)
```

  (In Phase 3 this loop moves into `mergeContacts` verbatim.)

- `emptyState()` and `validateState()` need no other change (counts stay templates/contacts).

### 1.2 `src/lib/vars.js`

Append:

```js
/** Keys used by a template: declared vars first, then keys found in the body. */
export function templateVarKeys(template) {
  const declared = (template?.vars ?? []).filter((v) => /^[\w.-]+$/.test(String(v?.key ?? '')))
  const keys = [...declared.map((v) => v.key), ...detectVariables(template?.body)]
  return [...new Set(keys)]
}

/** Display name for a variable, falling back to the key itself. */
export function varLabel(template, key) {
  const found = (template?.vars ?? []).find((v) => v?.key === key)
  return found?.label?.trim() ? found.label.trim() : key
}
```

`detectVariables()` and `resolve()` stay as-is.

### 1.3 `src/styles.css`

Add near the `.chip` rules (keep token-based colours; no hard-coded hex except the hue):

```css
/* Label toggle chips in the recipients tool bar */
.chip[aria-pressed='true'] {
  background: var(--accent-subtle);
  border-color: color-mix(in oklab, var(--accent) 42%, var(--border));
  color: color-mix(in oklab, var(--accent-strong) 88%, var(--foreground));
}

.label-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
}

.label-filter-label {
  font-size: 12px;
  color: var(--muted-foreground, var(--border-strong));
}

/* Contact label chips */
.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  line-height: 1.7;
  border: 1px solid hsl(var(--label-hue, 160) 55% 45% / 45%);
  background: hsl(var(--label-hue, 160) 55% 45% / 14%);
  color: hsl(var(--label-hue, 160) 45% 32%);
  white-space: nowrap;
}

[data-theme='dark'] .label-chip {
  border-color: hsl(var(--label-hue, 160) 55% 60% / 50%);
  background: hsl(var(--label-hue, 160) 55% 60% / 18%);
  color: hsl(var(--label-hue, 160) 60% 82%);
}

.label-chip-x {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.label-chip-x:hover {
  opacity: 1;
}

.label-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.label-add-input {
  width: 96px;
  padding: 2px 6px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: inherit;
}

.col-select {
  width: 34px;
}

.select-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.var-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.var-row .var-key {
  font-family: var(--mono-font, monospace);
  font-size: 12px;
  color: var(--muted-foreground, var(--border-strong));
}
```

### 1.4 `src/App.svelte`

Script:

- Import: `import { detectVariables, render, resolve, templateVarKeys, varLabel } from './lib/vars.js'`
- Import: `import { uniqueLabels } from './lib/contacts.js'` (created in Phase 3; for
  Phase 1 add a tiny local helper instead and move it in Phase 3):

```js
  function uniqueLabels(contacts) {
    const set = new Set()
    for (const c of contacts) for (const l of c.labels ?? []) set.add(l)
    return [...set].sort((a, b) => a.localeCompare(b))
  }
```

- Replace variable derivation:

```js
  let vars = $derived(active ? templateVarKeys(active) : [])
  let valueVars = $derived(vars.filter((v) => v !== 'nama'))
```

- Add label filter state and derivation:

```js
  let labelFilter = $state([])
  let labelPool = $derived(uniqueLabels(data.contacts))
  let filteredContacts = $derived(
    labelFilter.length === 0
      ? data.contacts
      : data.contacts.filter((c) => labelFilter.some((l) => (c.labels ?? []).includes(l)))
  )
```

- `previewContact` uses the filtered list:

```js
  let previewContact = $derived(
    filteredContacts.find((c) => c.id === previewId) ?? filteredContacts[0] ?? null
  )
```

- Add toggle handler:

```js
  function toggleLabelFilter(label) {
    labelFilter = labelFilter.includes(label)
      ? labelFilter.filter((l) => l !== label)
      : [...labelFilter, label]
  }
```

- `pushContact()`: add `labels: []` to the new contact object.

Template editor markup — replace the Variables field block (the `{#each valueVars as v (v)}`
chips block and the separate `globals-block`) with a managed list. Keep the "Add variable"
form and the `+ {{nama}}` chip. New markup:

```svelte
        <div class="field">
          <span class="field-label">{t('variables')}</span>
          <form class="var-add" onsubmit={addVariable}>
            <input class="input" bind:value={newVar} placeholder={t('varNamePlaceholder')} aria-label={t('addVariable')} />
            <button class="btn secondary sm" type="submit">
              <Icon name="plus" size={14} />
              <span>{t('addVariable')}</span>
            </button>
          </form>
          <div class="chips">
            <button class="chip" type="button" onclick={() => insertVar('nama')}>+ {'{{nama}}'}</button>
            {#each valueVars as v (v)}
              <button class="chip" type="button" onclick={() => insertVar(v)}>+ {'{{' + v + '}}'}</button>
            {/each}
          </div>
          <p class="hint">{t('insertHint')}</p>
          <p class="hint">{t('nameBuiltinHint')}</p>

          {#if valueVars.length}
            <div class="var-rows" style="margin-top:10px">
              {#each valueVars as v (v)}
                <div class="var-row">
                  <span class="var-key">{'{{' + v + '}}'}</span>
                  <input
                    class="input"
                    value={varLabel(active, v) === v ? '' : varLabel(active, v)}
                    placeholder={t('varDisplayName')}
                    aria-label={t('varDisplayName') + ' ' + v}
                    oninput={(e) => setVarLabel(v, e.currentTarget.value)}
                  />
                  <input
                    class="input"
                    value={active.globals[v] ?? ''}
                    placeholder={t('varDefault')}
                    aria-label={t('varDefault') + ' ' + v}
                    oninput={(e) => (active.globals[v] = e.currentTarget.value)}
                  />
                  <button class="btn icon-btn danger-ghost sm" type="button" title={t('removeVariable')} aria-label={t('removeVariable')} onclick={() => removeVar(v)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              {/each}
            </div>
            <p class="hint">{t('globalHint')}</p>
          {/if}
        </div>
```

Add helpers:

```js
  function setVarLabel(key, value) {
    if (!active) return
    active.vars ??= []
    const found = active.vars.find((v) => v.key === key)
    if (found) found.label = value
    else active.vars.push({ key, label: value })
  }

  function removeVar(key) {
    if (!active) return
    active.vars = (active.vars ?? []).filter((v) => v.key !== key)
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    active.body = active.body.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'), '')
  }
```

Update `addVariable()` to also register the definition:

```js
  function addVariable(event) {
    event.preventDefault()
    const name = newVar.trim().replace(/^\{\{|\}\}$/g, '').trim()
    if (!/^[\w.-]+$/.test(name)) return notify(t('badVarName'))
    active.vars ??= []
    if (!active.vars.some((v) => v.key === name)) active.vars.push({ key: name, label: '' })
    insertVar(name)
    newVar = ''
  }
```

Preview picker iterates `filteredContacts` instead of `data.contacts` (both places: the
desktop `data.contacts.length > 1` guard and the `{#each}`), and the focus-mode mobile
picker too.

Recipients panel: add import button in `panel-head` row and pass new props to
`RecipientTable`:

```svelte
          <button class="btn sm secondary" type="button" onclick={() => (showContactImport = true)}>
            <Icon name="upload" size={14} />
            <span>{t('importContacts')}</span>
          </button>
```

```svelte
      <RecipientTable
        contacts={filteredContacts}
        template={active}
        vars={valueVars}
        labelPool={labelPool}
        {labelFilter}
        onToggleLabelFilter={toggleLabelFilter}
        onClearLabelFilter={() => (labelFilter = [])}
        focusedId={previewContact?.id ?? null}
        {t}
        onOpen={openWa}
        onDelete={deleteContact}
        onFocus={(contact) => (previewId = contact.id)}
      />
```

(`showContactImport` state + dialog are Phase 3; add the state now as `$state(false)`.)

### 1.5 `src/lib/RecipientTable.svelte`

Props:

```js
  let {
    contacts, template, vars, labelPool = [], labelFilter = [],
    onToggleLabelFilter, onClearLabelFilter,
    focusedId = null, t, onOpen, onDelete, onFocus,
  } = $props()
```

Import `varLabel` and add a local `labelHue`:

```js
  import { detectVariables, render, resolve, templateVarKeys, varLabel } from './vars.js'

  function labelHue(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return h
  }
```

State:

```js
  let selected = $state([])
  let labelDraft = $state({})   // contactId -> draft label text

  let allVars = $derived(templateVarKeys(template))
  let scope = $derived(
    selected.length ? shown.filter((c) => selected.includes(c.id)) : shown
  )
```

`allVars` replaces `detectVariables(template.body)`. Replace `contacts.length` uses for the
**working set** (progress, focus list, count) with `scope`; keep `contacts.length` only for
the "total" in the badge label if desired, but simplest: use `scope`.

- `sentCount = $derived(scope.filter((c) => c.sentAt?.[template.id]).length)`
- focus mode iterates `scope`; `focusIndex`/`focusContact` derived from `scope`.
- count label: `t('rowsFiltered', { shown: scope.length, n: contacts.length })` when a filter
  or search or selection is active, else `t('rows', { n: contacts.length })`.

Add:

```js
  function toggleSelect(contact) {
    selected = selected.includes(contact.id)
      ? selected.filter((id) => id !== contact.id)
      : [...selected, contact.id]
  }

  function selectAllShown() {
    selected = shown.map((c) => c.id)
  }

  function clearSelection() {
    selected = []
  }

  function addLabel(contact, raw) {
    const name = String(raw ?? '').trim()
    if (!name) return
    contact.labels ??= []
    for (const part of name.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)) {
      if (!contact.labels.includes(part)) contact.labels.push(part)
    }
  }

  function removeLabel(contact, label) {
    contact.labels = (contact.labels ?? []).filter((l) => l !== label)
  }

  function commitLabelDraft(contact) {
    const draft = labelDraft[contact.id]
    if (draft) addLabel(contact, draft)
    labelDraft[contact.id] = ''
  }
```

Markup changes:

1. Label filter row, inside/after `.table-tools`:

```svelte
{#if labelPool.length}
  <div class="label-filter">
    <span class="label-filter-label">{t('filterByLabel')}</span>
    {#each labelPool as label (label)}
      <button
        class="chip"
        type="button"
        aria-pressed={labelFilter.includes(label)}
        onclick={() => onToggleLabelFilter?.(label)}
      >
        {label}
      </button>
    {/each}
    {#if labelFilter.length}
      <button class="btn ghost sm" type="button" onclick={() => onClearLabelFilter?.()}>{t('clearLabels')}</button>
    {/if}
  </div>
{/if}
```

2. Select bar (only when contacts exist), after the search tools:

```svelte
{#if contacts.length}
  <div class="select-bar">
    <button class="btn ghost sm" type="button" onclick={selectAllShown}>{t('selectAll')}</button>
    {#if selected.length}
      <span class="badge neutral sm tabular">{t('selectedCount', { n: selected.length })}</span>
      <button class="btn ghost sm" type="button" onclick={clearSelection}>{t('selectNone')}</button>
    {/if}
  </div>
{/if}
```

3. Table header: add `<th class="col-select">` before `#` with an indeterminate-ish checkbox:

```svelte
<th class="col-select">
  <input
    type="checkbox"
    aria-label={t('selectAll')}
    checked={shown.length > 0 && shown.every((c) => selected.includes(c.id))}
    onchange={(e) => (e.currentTarget.checked ? selectAllShown() : clearSelection())}
  />
</th>
```

Add a Labels column header `<th>{t('labels')}</th>` after the name column.

4. Row: add select cell first, and a labels cell after the name cell:

```svelte
<td class="col-select">
  <input
    type="checkbox"
    aria-label={t('selectAll')}
    checked={selected.includes(contact.id)}
    onclick={(e) => e.stopPropagation()}
    onchange={() => toggleSelect(contact)}
  />
</td>
```

```svelte
<td class="col-labels">
  <div class="label-editor">
    {#each contact.labels ?? [] as label (label)}
      <span class="label-chip" style="--label-hue:{labelHue(label)}">
        {label}
        <button class="label-chip-x" type="button" aria-label={t('removeLabel')} onclick={() => removeLabel(contact, label)}>
          <Icon name="x" size={11} />
        </button>
      </span>
    {/each}
    <input
      class="label-add-input"
      list="label-pool"
      value={labelDraft[contact.id] ?? ''}
      placeholder="+ {t('labelPlaceholder')}"
      aria-label={t('addLabel')}
      oninput={(e) => (labelDraft[contact.id] = e.currentTarget.value)}
      onchange={() => commitLabelDraft(contact)}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitLabelDraft(contact)
        }
      }}
      onclick={(e) => e.stopPropagation()}
    />
  </div>
</td>
```

Add once inside the component markup:

```svelte
<datalist id="label-pool">
  {#each labelPool as label (label)}<option value={label}></option>{/each}
</datalist>
```

5. `colspan` for the empty row becomes `vars.length + 6` (select, phone, name, labels,
   vars…, actions).

6. Card views (focus + list): add a compact label editor under the fields, reusing the same
   markup; and add the checkbox to the card header so cards can be selected too.

7. Variable column headers and cards: display `varLabel(template, v)` with
   `title={v}` and `aria-label={v}`; keep the input keyed by `v` for `resolve`/`setValue`.

Keep the existing `hasMissing()` using `allVars`.

### 1.6 i18n (Phase 1 keys)

Add to both `en` and `id` dicts:

| key | en | id |
|---|---|---|
| `labels` | `Labels` | `Label` |
| `labelPlaceholder` | `label` | `label` |
| `addLabel` | `Add label` | `Tambah label` |
| `removeLabel` | `Remove label` | `Hapus label` |
| `filterByLabel` | `Filter by label` | `Filter label` |
| `clearLabels` | `Clear` | `Hapus` |
| `selectAll` | `Select all` | `Pilih semua` |
| `selectNone` | `Clear selection` | `Kosongkan pilihan` |
| `selectedCount` | `{n} selected` | `{n} dipilih` |

### 1.7 Tests (Phase 1)

Extend `src/lib/storage.test.js`:

```js
test('migrate upgrades v1 to v2 with labels and vars', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '{{x}}' }],
    contacts: [{ phone: '628111', name: 'Budi' }],
  })
  assert.equal(state.schemaVersion, 2)
  assert.deepEqual(state.templates[0].vars, [])
  assert.deepEqual(state.contacts[0].labels, [])
})

test('migrate normalises labels and validates vars', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '', vars: [{ key: 'x', label: 'X' }, { key: 'x', label: 'dup' }, { key: '!' }] }],
    contacts: [{ phone: '628111', name: '', labels: [' VIP ', 'VIP', ''] }],
  })
  assert.deepEqual(state.templates[0].vars, [{ key: 'x', label: 'X' }])
  assert.deepEqual(state.contacts[0].labels, ['VIP'])
})
```

Extend `src/lib/vars.test.js`:

```js
import { templateVarKeys, varLabel } from './vars.js'

test('templateVarKeys unions declared vars and body variables', () => {
  const tpl = { body: 'Hi {{nama}} {{total}}', vars: [{ key: 'invoice', label: 'No. Invoice' }] }
  assert.deepEqual(templateVarKeys(tpl), ['invoice', 'nama', 'total'])
})

test('varLabel falls back to the key', () => {
  const tpl = { body: '', vars: [{ key: 'invoice', label: 'No. Invoice' }] }
  assert.equal(varLabel(tpl, 'invoice'), 'No. Invoice')
  assert.equal(varLabel(tpl, 'other'), 'other')
})
```

Verify: `npm run test`, `npm run build`, then in `npm run dev` add a contact, add labels,
filter by label, select contacts, confirm the working set changes.

Commit: `Add contact labels, label filter, contact selection, and schema v2`

---

## Phase 2 — Variable manager polish

Phase 1 already introduces the manager markup and `setVarLabel` / `removeVar`. Verify and
finish:

- Add variable → appears as a row with empty display name; token inserted at cursor.
- Type `{{total}}` into the body → a row appears automatically; label stays empty until set.
- Set a display name → the recipient table column header and card labels show it, the key
  stays in the tooltip/`aria-label`.
- Edit default value → applied to contacts without their own value (via `globals`).
- Remove a variable → row and body tokens disappear; per-contact values for that key become
  unused but harmless.

Add i18n keys:

| key | en | id |
|---|---|---|
| `varDisplayName` | `Display name` | `Nama tampilan` |
| `varDefault` | `Default` | `Bawaan` |
| `removeVariable` | `Remove variable` | `Hapus variabel` |

Test: add a case in `vars.test.js` asserting `templateVarKeys` ignores malformed declared
vars and keeps body order stable.

Verify: `npm run test`, `npm run build`, manual check with a two-variable template.

Commit: `Add per-template variable manager with display names and defaults`

---

## Phase 3 — CSV/VCF import

### 3.1 `src/lib/contacts.js` (new)

```js
import { normalizePhone, isValidPhone } from './wa.js'

/** Parse a delimited text block, RFC 4180-ish (quotes, escaped quotes, no BOM issues). */
export function parseDelimited(text, delimiter = ',') {
  const src = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Auto-detect the delimiter from the first line. */
export function parseCsv(text) {
  const first = String(text ?? '').split(/\r?\n/)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return parseDelimited(text, counts[0][1] > 0 ? counts[0][0] : ',')
}

/** Parse a vCard file: one entry per vCard, first TEL + first FN/N. */
export function parseVcf(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const unfolded = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1)
    else unfolded.push(line)
  }
  const out = []
  let cur = null
  for (const raw of unfolded) {
    const line = raw.trim()
    if (/^BEGIN:VCARD$/i.test(line)) { cur = { phone: '', name: '' }; continue }
    if (/^END:VCARD$/i.test(line)) {
      if (cur?.phone) out.push(cur)
      cur = null
      continue
    }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).split(';')[0].toUpperCase()
    const value = line.slice(idx + 1).trim()
    if (!value) continue
    if (key === 'TEL' && !cur.phone) cur.phone = value
    else if ((key === 'FN' || key === 'N') && !cur.name) cur.name = value.replace(/;/g, ' ').trim()
  }
  return out
}

const HEADER_ALIASES = {
  phone: ['phone', 'nomor', 'tel', 'telepon', 'hp', 'wa', 'whatsapp', 'nomorwa', 'msisdn', 'mobile'],
  name: ['name', 'nama', 'fn', 'fullname', 'kontak'],
  label: ['label', 'tag', 'grup', 'group', 'kategori', 'category'],
}

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')

/** Guess column indexes for phone / name / label / variable keys. -1 = none. */
export function guessMapping(headers, varKeys = []) {
  const map = { phone: -1, name: -1, label: -1, vars: {} }
  const cells = (headers ?? []).map(norm)
  for (const [target, aliases] of Object.entries(HEADER_ALIASES)) {
    const at = cells.findIndex((c) => aliases.includes(c))
    map[target] = at
  }
  for (const key of varKeys) {
    const at = cells.findIndex((c, i) => c === norm(key) && !Object.values(map).includes(i))
    map.vars[key] = at
  }
  return map
}

/** Map parsed rows to contact drafts using a column mapping. */
export function mapRows(rows, mapping, varKeys = []) {
  return rows.map((row) => {
    const pick = (i) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    const phone = normalizePhone(pick(mapping.phone))
    const labels = pick(mapping.label).split(/[;|]/).map((s) => s.trim()).filter(Boolean)
    const values = {}
    for (const key of varKeys) {
      const value = pick(mapping.vars?.[key] ?? -1)
      if (value) values[key] = value
    }
    return {
      phone,
      name: pick(mapping.name),
      labels: [...new Set(labels)],
      values,
      valid: isValidPhone(phone),
    }
  })
}

/** Merge incoming contacts into local (dedup by phone). Returns { added, merged }. */
export function mergeContacts(local, incoming) {
  const byPhone = new Map(local.map((c) => [c.phone, c]))
  let added = 0
  let merged = 0
  for (const c of incoming) {
    const existing = byPhone.get(c.phone)
    if (!existing) {
      local.push(c)
      byPhone.set(c.phone, c)
      added++
      continue
    }
    merged++
    if (!existing.name && c.name) existing.name = c.name
    existing.labels ??= []
    for (const l of c.labels ?? []) if (!existing.labels.includes(l)) existing.labels.push(l)
    for (const [tid, values] of Object.entries(c.values ?? {})) {
      existing.values[tid] ??= {}
      for (const [k, v] of Object.entries(values ?? {})) {
        if (!existing.values[tid][k]) existing.values[tid][k] = v
      }
    }
    for (const [tid, when] of Object.entries(c.sentAt ?? {})) {
      if (!existing.sentAt[tid] || existing.sentAt[tid] < when) existing.sentAt[tid] = when
    }
  }
  return { added, merged }
}

/** Sorted unique labels across contacts. */
export function uniqueLabels(contacts) {
  const set = new Set()
  for (const c of contacts) for (const l of c.labels ?? []) if (l) set.add(l)
  return [...set].sort((a, b) => a.localeCompare(b))
}
```

Then in `src/lib/storage.js`: import `mergeContacts` and replace the merged contacts loop
with:

```js
  mergeContacts(local.contacts, incoming.contacts)
```

Remove the now-duplicated loop. In `src/App.svelte` drop the local `uniqueLabels` and import
it from `./lib/contacts.js`.

### 3.2 `src/lib/ContactImport.svelte` (new)

Self-contained dialog: choose file, parse, map, preview, import. Props:

```js
  let { varKeys = [], t, onImport, onCancel } = $props()
```

Behaviour:

- `<input type="file" accept=".csv,.vcf,text/csv,text/vcard">` + a drop zone (optional).
- On file: read text; choose parser by extension or content (`BEGIN:VCARD` → vcf).
- `rows = parseCsv(text)` or `parseVcf(text)` normalised into `{ headers, rows }`:
  - CSV: first row is the header if any mapped alias or known var key matches; otherwise
    synthesise headers `Kolom 1..n` and treat all rows as data.
  - VCF: single-column rows `[phone, name]`, headers `[phone, name]`.
- `mapping = $state(guessMapping(headers, varKeys))`.
- Preview: first 10 mapped rows as a table.
- Mapping controls: `<select>` per target; options = each header index, plus `abaikan`.
- Import button disabled if `mapping.phone < 0`.
- On import: `mapped = mapRows(rows.slice(hasHeader ? 1 : 0), mapping, varKeys)`;
  build contacts `{ id: crypto-safe uid, phone, name, labels, values, sentAt: {} }` for
  valid rows; call `onImport(contacts, { ok, bad: mapped.length - ok })`.

Use the shared `uid` from `storage.js` for ids. Follow `ImportDialog.svelte` markup
(`.overlay`, `.modal-card`, `.modal-header`, `.modal-body`, `.modal-actions`, Escape close,
backdrop click close, focus trap on the dialog element).

### 3.3 `src/App.svelte` wiring

```js
  import ContactImport from './lib/ContactImport.svelte'
  import { uniqueLabels, mergeContacts } from './lib/contacts.js'

  let showContactImport = $state(false)

  function doImportContacts(contacts, stats) {
    const { added, merged } = mergeContacts(data.contacts, contacts)
    labelFilter = labelFilter.filter((l) => uniqueLabels(data.contacts).includes(l))
    showContactImport = false
    notify(t('importContactsDone', { added, merged, bad: stats.bad }))
  }
```

Render near the JSON import dialog:

```svelte
{#if showContactImport}
  <ContactImport varKeys={valueVars} {t} onImport={doImportContacts} onCancel={() => (showContactImport = false)} />
{/if}
```

### 3.4 i18n keys

| key | en | id |
|---|---|---|
| `importContacts` | `Import CSV / VCF` | `Impor CSV / VCF` |
| `importContactsTitle` | `Import contacts from file` | `Impor kontak dari file` |
| `importChooseFile` | `Choose CSV or VCF file` | `Pilih file CSV atau VCF` |
| `importPreview` | `Preview` | `Pratinjau` |
| `importMapTitle` | `Map columns` | `Petakan kolom` |
| `importMapPhone` | `Phone` | `Nomor` |
| `importMapName` | `Name` | `Nama` |
| `importMapLabel` | `Label` | `Label` |
| `importMapIgnore` | `Ignore` | `Abaikan` |
| `importMapColumn` | `Column {n}` | `Kolom {n}` |
| `importNeedPhone` | `Map a phone column to continue` | `Petakan kolom nomor untuk lanjut` |
| `importContactsAction` | `Import` | `Impor` |
| `importContactsDone` | `Added {added}, merged {merged}, skipped {bad}.` | `Ditambah {added}, digabung {merged}, dilewati {bad}.` |
| `importLabelHint` | `Multiple labels in one cell: separate with ; or \|` | `Beberapa label dalam satu sel: pisah dengan ; atau \|` |
| `importFileEmpty` | `No rows found in that file.` | `Tidak ada baris di file itu.` |

### 3.5 Tests — `src/lib/contacts.test.js` (new)

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCsv, parseDelimited, parseVcf, guessMapping, mapRows, mergeContacts, uniqueLabels,
} from './contacts.js'

test('parseDelimited handles quotes, escaped quotes, and newlines', () => {
  const rows = parseDelimited('a,b\n"x,1","y""2"\n', ',')
  assert.deepEqual(rows, [['a', 'b'], ['x,1', 'y"2']])
})

test('parseCsv auto-detects semicolon', () => {
  assert.deepEqual(parseCsv('nomor;nama\n628111;Budi\n'), [['nomor', 'nama'], ['628111', 'Budi']])
})

test('parseVcf reads TEL and FN', () => {
  const vcf = 'BEGIN:VCARD\nVERSION:3.0\nFN:Budi\nTEL;TYPE=CELL:+62 811-1\nEND:VCARD\n'
  assert.deepEqual(parseVcf(vcf), [{ phone: '+62 811-1', name: 'Budi' }])
})

test('guessMapping finds aliases and variable keys', () => {
  const map = guessMapping(['Nomor WA', 'Nama', 'Tag', 'invoice'], ['invoice'])
  assert.equal(map.phone, 0)
  assert.equal(map.name, 1)
  assert.equal(map.label, 2)
  assert.equal(map.vars.invoice, 3)
})

test('mapRows normalises phone, splits labels, fills values', () => {
  const [row] = mapRows(
    [['0896-9812-9722', 'Budi', 'VIP;Pelanggan', 'INV-1']],
    { phone: 0, name: 1, label: 2, vars: { invoice: 3 } },
    ['invoice'],
  )
  assert.equal(row.phone, '6289698129722')
  assert.deepEqual(row.labels, ['VIP', 'Pelanggan'])
  assert.deepEqual(row.values, { invoice: 'INV-1' })
  assert.equal(row.valid, true)
})

test('mergeContacts adds new and unions labels on duplicates', () => {
  const local = [{ id: 'c1', phone: '628111', name: 'A', labels: ['VIP'], values: { t1: { x: 'L' } }, sentAt: {} }]
  const { added, merged } = mergeContacts(local, [
    { phone: '628111', name: 'B', labels: ['Pelanggan'], values: { t1: { x: 'F', y: '10' } } },
    { phone: '628222', name: 'C', labels: [], values: {} },
  ])
  assert.equal(added, 1)
  assert.equal(merged, 1)
  assert.equal(local.length, 2)
  assert.equal(local[0].name, 'A')
  assert.deepEqual(local[0].labels, ['VIP', 'Pelanggan'])
  assert.equal(local[0].values.t1.x, 'L')
  assert.equal(local[0].values.t1.y, '10')
})

test('uniqueLabels is sorted and unique', () => {
  assert.deepEqual(uniqueLabels([{ labels: ['b', 'a'] }, { labels: ['a', 'c'] }]), ['a', 'b', 'c'])
})
```

Verify: `npm run test`, `npm run build`, then import a real CSV and a `.vcf` export, confirm
mapping, dedup, and labels.

Commit: `Add CSV/VCF contact import with column mapping and merge`

---

## Phase 4 — Backup v2, docs, help

- Import dialog copy: mention labels/vars travel in the backup. Update
  `importFound` to include labels count if easy, otherwise leave text.
- `docs/USAGE.md`:
  - Section 2 (Variabel): add per-template manager (display name, default, remove).
  - New section: Label, filter, and selection (multi-label per contact, OR filter,
    checkbox selection, working set).
  - Section 3 (Menambah penerima): add "Import CSV/VCF" with mapping + preview, multi-label
    separator, dedup rule.
  - Section 7 (Export/Import): schemaVersion 2, labels + vars included, v1 files still import.
  - Section 9 (Batasan): CSV/VCF import needs a phone column; labels are free text.
- `src/lib/i18n.svelte.js` `helpItems` (EN + ID): add bullets for labels/filter/selection and
  CSV/VCF import; mention variable manager.
- Add `importContacts` to the mobile menu actions in `App.svelte` (open the dialog from the
  mobile menu too), next to Export/Import.

Verify: `npm run test`, `npm run build`, manual end-to-end: create template with variables,
set display names/defaults, add contacts by CSV, label them, filter by label, select a subset,
send via focus mode, export, clear, re-import (Merge), confirm labels/vars/values survive.

Commit: `Document labels, selection, and CSV/VCF import; polish backup v2`

---

## Definition of done

- `npm run test` and `npm run build` green on the branch.
- All new user-facing text present in EN and ID.
- `docs/USAGE.md` and Help modal updated.
- One runnable check per non-trivial pure module (`contacts.test.js`, extended
  `vars.test.js`, `storage.test.js`).
- No new dependencies.
