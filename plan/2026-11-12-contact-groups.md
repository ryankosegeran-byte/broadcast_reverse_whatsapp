# Implementation Plan — Contact Groups, Group Manager, and Sent Tracking

Spec: `docs/superpowers/specs/2026-11-12-contact-groups-design.md`
Status: ready to implement

Follow existing patterns: Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`), all
user-facing text via `t('key')` with EN + ID in `src/lib/i18n.svelte.js`, plain logic in
dependency-free `src/lib/*.js` modules with `node:test` unit tests, modals copied from
`src/lib/HelpModal.svelte`, backup through `src/lib/storage.js`.

Tasks are in dependency order. Do them in sequence; each leaves the app buildable and
`npm run test` green.

---

## Task 1 — `src/lib/groups.js` (new file)

Pure helpers. No DOM, and **no import from `storage.js`** (storage imports this module; a cycle
would be created). Create with exactly this content:

```js
/** Contact-group registry helpers. Pure: no DOM, no storage import. */

const clean = (s) => String(s ?? '').trim()

function gid() {
  return 'grp_' + Math.random().toString(36).slice(2, 10)
}

/** Normalise raw registry rows: string names, unique, valid parent, no cycles. */
export function normalizeGroups(raw) {
  const rows = []
  const seen = new Set()
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!g || typeof g !== 'object') continue
    const name = clean(g.name)
    if (!name || seen.has(name)) continue
    seen.add(name)
    rows.push({
      id: typeof g.id === 'string' && g.id ? g.id : gid(),
      name,
      parentId: typeof g.parentId === 'string' && g.parentId ? g.parentId : null,
    })
  }
  const byId = new Map(rows.map((g) => [g.id, g]))
  const byName = new Map(rows.map((g) => [g.name, g]))
  for (const g of rows) {
    // parentId may be an id (normal) or a name (hand-written / older backup)
    let parent = g.parentId ? byId.get(g.parentId) : null
    if (!parent && g.parentId) parent = byName.get(clean(g.parentId)) ?? null
    g.parentId = parent && parent.id !== g.id ? parent.id : null
  }
  // break any remaining cycles
  for (const g of rows) {
    const seenIds = new Set([g.id])
    let cur = g
    while (cur?.parentId) {
      if (seenIds.has(cur.parentId)) {
        cur.parentId = null
        break
      }
      seenIds.add(cur.parentId)
      cur = byId.get(cur.parentId)
    }
  }
  return rows
}

/** Ensure every label used by a contact has a registry row (top-level). Returns `groups`. */
export function syncGroups(groups, contacts) {
  const known = new Set(groups.map((g) => g.name))
  for (const c of contacts ?? []) {
    for (const label of c.labels ?? []) {
      const name = clean(label)
      if (!name || known.has(name)) continue
      known.add(name)
      groups.push({ id: gid(), name, parentId: null })
    }
  }
  return groups
}

/** Create a group if the name is free; returns the existing or new row, or null for a blank name. */
export function createGroup(groups, name, parentId = null) {
  const cleanName = clean(name)
  if (!cleanName) return null
  const existing = groups.find((g) => g.name === cleanName)
  if (existing) return existing
  const row = { id: gid(), name: cleanName, parentId: parentId ?? null }
  groups.push(row)
  return row
}

/** Ancestor names of a group, nearest first, excluding the group itself. */
export function groupAncestors(groups, id) {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const out = []
  const seen = new Set([id])
  let cur = byId.get(id)
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId)
    cur = byId.get(cur.parentId)
    if (!cur) break
    out.push(cur.name)
  }
  return out
}

/** Labels a contact should get when assigned to `id`: the group name plus its ancestors. */
export function labelsForGroup(groups, id) {
  const g = groups.find((x) => x.id === id)
  if (!g) return []
  return [g.name, ...groupAncestors(groups, id)]
}

/** Expand a list of label names with the ancestor names of any that are registry groups. */
export function expandLabels(groups, names) {
  const out = []
  for (const raw of names ?? []) {
    const name = clean(raw)
    if (!name) continue
    out.push(name)
    const g = groups.find((x) => x.name === name)
    if (g) out.push(...groupAncestors(groups, g.id))
  }
  return [...new Set(out)]
}

/** Flat display order: parents A→Z, each followed by its descendants, with a depth. */
export function groupOutline(groups) {
  const children = new Map()
  for (const g of groups) {
    const key = g.parentId ?? ''
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(g)
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  const out = []
  const walk = (parentId, depth) => {
    for (const g of children.get(parentId) ?? []) {
      out.push({ ...g, depth })
      walk(g.id, depth + 1)
    }
  }
  walk('', 0)
  return out
}

/** True when `maybeId` is `id` itself or sits below it. */
export function isDescendant(groups, id, maybeId) {
  if (id === maybeId) return true
  const byId = new Map(groups.map((g) => [g.id, g]))
  const seen = new Set()
  let cur = byId.get(maybeId)
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId)
    if (cur.parentId === id) return true
    cur = byId.get(cur.parentId)
  }
  return false
}

/** Reparent a group. Rejects unknown parents, self and descendants. Returns true on change. */
export function setGroupParent(groups, id, parentId) {
  const g = groups.find((x) => x.id === id)
  if (!g) return false
  if (parentId && !groups.some((x) => x.id === parentId)) return false
  if (parentId && isDescendant(groups, id, parentId)) return false
  g.parentId = parentId ?? null
  return true
}

/** Rename a group and every contact label using the old name. Returns contacts changed. */
export function renameLabel(groups, contacts, from, to) {
  const oldName = clean(from)
  const newName = clean(to)
  if (!oldName || !newName || oldName === newName) return 0
  const g = groups.find((x) => x.name === oldName)
  if (g) g.name = newName
  let changed = 0
  for (const c of contacts ?? []) {
    if (!(c.labels ?? []).includes(oldName)) continue
    changed++
    c.labels = [...new Set(c.labels.map((l) => (l === oldName ? newName : l)))]
  }
  return changed
}

/** Delete a group: drop the row, strip the label, promote children one level. Returns contacts changed. */
export function deleteLabel(groups, contacts, name) {
  const target = clean(name)
  const g = groups.find((x) => x.name === target)
  if (g) {
    for (const child of groups) if (child.parentId === g.id) child.parentId = g.parentId
    groups.splice(groups.indexOf(g), 1)
  }
  let changed = 0
  for (const c of contacts ?? []) {
    if (!(c.labels ?? []).includes(target)) continue
    changed++
    c.labels = c.labels.filter((l) => l !== target)
  }
  return changed
}

/** Add or remove labels on the contacts in `ids`. Returns contacts changed. */
export function assignLabels(contacts, ids, labels, mode = 'add') {
  const set = new Set(ids)
  const names = [...new Set((labels ?? []).map(clean).filter(Boolean))]
  if (!names.length) return 0
  let changed = 0
  for (const c of contacts ?? []) {
    if (!set.has(c.id)) continue
    const before = (c.labels ?? []).join('\u0000')
    const own = c.labels ?? []
    c.labels =
      mode === 'remove'
        ? own.filter((l) => !names.includes(l))
        : [...new Set([...own, ...names])]
    if (c.labels.join('\u0000') !== before) changed++
  }
  return changed
}

/** Contacts matching the label filter. `and` = every label, `or` = any label. */
export function filterByLabels(contacts, labels, mode = 'and') {
  const wanted = [...new Set((labels ?? []).map(clean).filter(Boolean))]
  if (!wanted.length) return contacts ?? []
  return (contacts ?? []).filter((c) => {
    const own = c.labels ?? []
    return mode === 'or'
      ? wanted.some((l) => own.includes(l))
      : wanted.every((l) => own.includes(l))
  })
}

/** Split contacts into `{ unsent, sent }` for a template id, preserving order. */
export function splitBySent(contacts, templateId) {
  const unsent = []
  const sent = []
  for (const c of contacts ?? []) {
    if (templateId && c.sentAt?.[templateId]) sent.push(c)
    else unsent.push(c)
  }
  return { unsent, sent }
}
```

---

## Task 2 — `src/lib/groups.test.js` (new file)

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeGroups, syncGroups, createGroup, groupAncestors, labelsForGroup, expandLabels,
  groupOutline, isDescendant, setGroupParent, renameLabel, deleteLabel, assignLabels,
  filterByLabels, splitBySent,
} from './groups.js'

test('normalizeGroups trims, dedupes, and assigns ids', () => {
  const rows = normalizeGroups([
    { name: ' Kue ' },
    { name: 'Kue' },
    { name: '' },
    { name: 'Agape', parentId: 'Kue' },
  ])
  assert.equal(rows.length, 2)
  assert.ok(rows[0].id)
  assert.equal(rows[1].parentId, rows[0].id) // parent matched by name
})

test('normalizeGroups drops cycles and self-parents', () => {
  const rows = normalizeGroups([
    { id: 'a', name: 'A', parentId: 'b' },
    { id: 'b', name: 'B', parentId: 'a' },
    { id: 'c', name: 'C', parentId: 'c' },
  ])
  const byId = Object.fromEntries(rows.map((g) => [g.id, g]))
  assert.equal(byId.c.parentId, null)
  assert.ok(byId.a.parentId === null || byId.b.parentId === null)
})

test('syncGroups adds a top-level row per unknown label', () => {
  const groups = normalizeGroups([{ name: 'Kue' }])
  syncGroups(groups, [{ labels: ['Kue', 'Agape'] }, { labels: ['Agape'] }])
  assert.deepEqual(groups.map((g) => g.name), ['Kue', 'Agape'])
  assert.equal(groups[1].parentId, null)
})

test('groupOutline lists parents A-Z then indented children', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'b', name: 'Bolu' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  assert.deepEqual(
    groupOutline(groups).map((g) => [g.name, g.depth]),
    [['Bolu', 0], ['Kue', 0], ['Agape', 1]]
  )
})

test('ancestors, labelsForGroup, and expandLabels follow the chain', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
    { id: 'b', name: 'Blok B', parentId: 'a' },
  ])
  assert.deepEqual(groupAncestors(groups, 'b'), ['Agape', 'Kue'])
  assert.deepEqual(labelsForGroup(groups, 'b'), ['Blok B', 'Agape', 'Kue'])
  assert.deepEqual(expandLabels(groups, ['Blok B', 'Lain']), ['Blok B', 'Agape', 'Kue', 'Lain'])
})

test('setGroupParent rejects self and descendant parents', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  assert.equal(isDescendant(groups, 'k', 'a'), true)
  assert.equal(setGroupParent(groups, 'k', 'k'), false)
  assert.equal(setGroupParent(groups, 'k', 'a'), false)
  assert.equal(setGroupParent(groups, 'a', null), true)
  assert.equal(groups.find((g) => g.id === 'a').parentId, null)
})

test('renameLabel rewrites the registry and the contacts', () => {
  const groups = normalizeGroups([{ id: 'k', name: 'Kue' }])
  const contacts = [{ id: 'c1', labels: ['Kue', 'Agape'] }, { id: 'c2', labels: ['Lain'] }]
  assert.equal(renameLabel(groups, contacts, 'Kue', 'Kue Kering'), 1)
  assert.equal(groups[0].name, 'Kue Kering')
  assert.deepEqual(contacts[0].labels, ['Kue Kering', 'Agape'])
  assert.deepEqual(contacts[1].labels, ['Lain'])
})

test('deleteLabel strips the label and promotes children', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  const contacts = [{ id: 'c1', labels: ['Kue', 'Agape'] }]
  assert.equal(deleteLabel(groups, contacts, 'Kue'), 1)
  assert.deepEqual(groups.map((g) => g.name), ['Agape'])
  assert.equal(groups[0].parentId, null)
  assert.deepEqual(contacts[0].labels, ['Agape'])
})

test('assignLabels adds and removes without duplicates', () => {
  const contacts = [{ id: 'c1', labels: ['Kue'] }, { id: 'c2', labels: [] }]
  assert.equal(assignLabels(contacts, ['c1', 'c2'], ['Kue', 'Agape'], 'add'), 2)
  assert.deepEqual(contacts[0].labels, ['Kue', 'Agape'])
  assert.deepEqual(contacts[1].labels, ['Kue', 'Agape'])
  assert.equal(assignLabels(contacts, ['c1'], ['Kue'], 'remove'), 1)
  assert.deepEqual(contacts[0].labels, ['Agape'])
})

test('createGroup is idempotent by name', () => {
  const groups = []
  const a = createGroup(groups, 'Kue')
  const b = createGroup(groups, ' Kue ')
  assert.equal(a, b)
  assert.equal(groups.length, 1)
  assert.equal(createGroup(groups, '  '), null)
})

test('filterByLabels honours AND and OR', () => {
  const contacts = [
    { id: 'c1', labels: ['Kue', 'Agape'] },
    { id: 'c2', labels: ['Kue'] },
    { id: 'c3', labels: ['Bolu', 'Agape'] },
  ]
  assert.deepEqual(filterByLabels(contacts, ['Kue', 'Agape'], 'and').map((c) => c.id), ['c1'])
  assert.deepEqual(filterByLabels(contacts, ['Kue', 'Agape'], 'or').map((c) => c.id), ['c1', 'c2', 'c3'])
  assert.equal(filterByLabels(contacts, [], 'and').length, 3)
})

test('splitBySent separates by template id', () => {
  const contacts = [
    { id: 'c1', sentAt: { t1: '2026-01-01' } },
    { id: 'c2', sentAt: {} },
    { id: 'c3' },
  ]
  const { unsent, sent } = splitBySent(contacts, 't1')
  assert.deepEqual(sent.map((c) => c.id), ['c1'])
  assert.deepEqual(unsent.map((c) => c.id), ['c2', 'c3'])
  assert.equal(splitBySent(contacts, null).sent.length, 0)
})
```

Run `npm run test`. This file must pass before continuing.

---

## Task 3 — `src/lib/storage.js`: schema v4 + `groups`

1. Bump the version (line 5):

```js
export const SCHEMA_VERSION = 4
```

2. Add the import after the `contacts.js` import (line 2):

```js
import { normalizeGroups, syncGroups } from './groups.js'
```

3. `emptyState()` — add `groups`:

```js
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    groups: [],
    templates: [],
    contacts: [],
  }
}
```

4. `migrate()` — add `groups` to the returned object and sync at the end. The head becomes:

```js
export function migrate(raw) {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    groups: normalizeGroups(raw?.groups),
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    contacts: Array.isArray(raw?.contacts) ? raw.contacts : [],
  }
```

   …leave the template and contact mapping unchanged, then **immediately before** `return state`
   add:

```js
  syncGroups(state.groups, state.contacts)

  return state
```

5. `mergeStates()` — merge groups **before** `mergeContacts(local.contacts, incoming.contacts)`
   (line 167). Insert:

```js
  const gByName = new Map(local.groups.map((g) => [g.name, g]))
  for (const g of incoming.groups ?? []) {
    if (gByName.has(g.name)) continue
    local.groups.push({ ...g })
    gByName.set(g.name, g)
  }
  syncGroups(local.groups, local.contacts)
```

   (`local.groups` exists because `local` always comes from `loadState()`/`emptyState()`.)

6. `validateState()` — add the group count:

```js
    counts: {
      templates: data.templates.length,
      contacts: data.contacts.length,
      labels: uniqueLabels(data.contacts).length,
      groups: data.groups.length,
    },
```

No change to `loadState`, `scheduleSave`, `saveNow`, `downloadExport`.

---

## Task 4 — `src/lib/storage.test.js`

1. Test `migrate upgrades v1 to v3 with labels, vars, and auto` (line 63): rename it to
   `migrate upgrades v1 to v4 with labels, vars, auto, and groups`, change the version assert to
   `4`, and add:

```js
  assert.deepEqual(state.groups, [])
```

   (Contacts there have no labels, so no group rows are derived.)

2. Test `migrate normalises labels and validates vars` (line 74): the contact has label `VIP`,
   so add after the existing asserts:

```js
  assert.deepEqual(state.groups.map((g) => g.name), ['VIP'])
```

3. Test `validateState returns ... counts for v1 and v2` (line 103): change both version
   asserts to `4`, add `groups` to both count objects, and update the title to
   `... for v1 and v2` → keep the title. The v1 state has no labels → `groups: 0`; the v2 state
   uses labels `VIP`, `Jatuh Tempo` → `groups: 2`:

```js
  assert.deepEqual(v1.counts, { templates: 1, contacts: 1, labels: 0, groups: 0 })
```

```js
  assert.deepEqual(v2.counts, { templates: 1, contacts: 2, labels: 2, groups: 2 })
```

4. Add at the end of the file:

```js
test('migrate derives a top-level group per label', () => {
  const state = migrate({
    contacts: [
      { phone: '6281111111', name: 'A', labels: ['Kue', 'Agape'] },
      { phone: '6282222222', name: 'B', labels: ['Kue'] },
    ],
  })
  assert.deepEqual(state.groups.map((g) => g.name).sort(), ['Agape', 'Kue'])
  assert.ok(state.groups.every((g) => g.parentId === null))
})

test('mergeStates unions groups and keeps local parents', () => {
  const local = emptyState()
  local.groups.push({ id: 'k', name: 'Kue', parentId: null })
  local.contacts.push({ id: 'c1', phone: '628111', name: '', labels: ['Agape'], values: {}, sentAt: {} })
  const incoming = emptyState()
  incoming.groups.push({ id: 'a', name: 'Agape', parentId: 'k' })
  incoming.groups.push({ id: 'b', name: 'Bolu', parentId: null })

  mergeStates(local, incoming)

  const names = local.groups.map((g) => g.name)
  assert.ok(names.includes('Agape'))
  assert.ok(names.includes('Bolu'))
  assert.equal(local.groups.find((g) => g.name === 'Agape').parentId, 'k')
})
```

`npm run test` must pass before continuing.

---

## Task 5 — `src/lib/i18n.svelte.js`: strings

Add to the `en` dict (near the group/label keys, e.g. after `clearLabels`):

```js
    navContacts: 'Contacts',
    contactsTitle: 'Manage contacts',
    contactsDesc: 'Organise contacts into groups and subgroups, then send per group.',
    groupsTitle: 'Groups',
    mainGroups: 'Main groups',
    newGroup: 'New group',
    groupNamePlaceholder: 'Group name',
    subgroupOf: 'Subgroup of',
    makeTopLevel: 'Make main group',
    moveUnder: 'Move under',
    renameGroup: 'Rename group',
    deleteGroup: 'Delete group',
    deleteGroupConfirm: 'Remove this group from every contact?',
    createSubgroup: 'Add subgroup',
    noGroup: 'No group',
    allContactsGroup: 'All contacts',
    groupCount: '{n} contacts',
    dragHint: 'Drag a group onto another to nest it.',
    bulkActions: 'Selection',
    bulkAssign: 'Add label',
    bulkRemove: 'Remove label',
    bulkDelete: 'Delete selected',
    labelInputPlaceholder: 'Group name or label',
    labelRemovedPlaceholder: 'Label to remove',
    labelRenamed: 'Renamed to {name}',
    contactsUpdated: '{n} contacts updated',
    backToSend: 'Back to Send',
    filterMatchAll: 'All labels',
    filterMatchAny: 'Any label',
    statusAll: 'All',
    statusUnsent: 'Not sent',
    statusSent: 'Sent',
    sentSection: 'Sent ({n})',
    sentBadge: 'Sent',
    markSent: 'Mark as sent',
    markUnsent: 'Undo sent mark',
    undo: 'Undo',
```

Add the matching `id` dict keys:

```js
    navContacts: 'Kontak',
    contactsTitle: 'Kelola kontak',
    contactsDesc: 'Atur kontak per grup dan subgrup, lalu kirim per grup.',
    groupsTitle: 'Grup',
    mainGroups: 'Grup utama',
    newGroup: 'Grup baru',
    groupNamePlaceholder: 'Nama grup',
    subgroupOf: 'Subgrup dari',
    makeTopLevel: 'Jadikan grup utama',
    moveUnder: 'Pindah ke bawah',
    renameGroup: 'Ganti nama grup',
    deleteGroup: 'Hapus grup',
    deleteGroupConfirm: 'Hapus grup ini dari semua kontak?',
    createSubgroup: 'Tambah subgrup',
    noGroup: 'Tanpa grup',
    allContactsGroup: 'Semua kontak',
    groupCount: '{n} kontak',
    dragHint: 'Tarik grup ke grup lain untuk jadi subgrup.',
    bulkActions: 'Pilihan',
    bulkAssign: 'Tambah label',
    bulkRemove: 'Hapus label',
    bulkDelete: 'Hapus terpilih',
    labelInputPlaceholder: 'Nama grup atau label',
    labelRemovedPlaceholder: 'Label yang dihapus',
    labelRenamed: 'Diganti jadi {name}',
    contactsUpdated: '{n} kontak diperbarui',
    backToSend: 'Ke Kirim',
    filterMatchAll: 'Semua label',
    filterMatchAny: 'Salah satu label',
    statusAll: 'Semua',
    statusUnsent: 'Belum terkirim',
    statusSent: 'Sudah terkirim',
    sentSection: 'Sudah terkirim ({n})',
    sentBadge: 'Terkirim',
    markSent: 'Tandai terkirim',
    markUnsent: 'Batalkan tanda',
    undo: 'Batalkan',
```

Also extend the `aboutFeatures` array in **both** dicts: after the existing "Group contacts with
labels…" / "Kelompokkan kontak dengan label…" line, add an item:

- EN: `'Rename and nest groups into subgroups, then filter with All/Any labels.'`
- ID: `'Ganti nama dan susun grup jadi subgrup, lalu filter dengan semua/salah satu label.'`

Do not add these to `helpItems` in this task (Task 10).

---

## Task 6 — `src/lib/Icon.svelte`: two icons

Insert after the `calendar` branch (line 53):

```svelte
    {:else if name === 'folder'}
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z" />
    {:else if name === 'grip'}
      <circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />
```

(`check` already exists and is reused for the sent toggle.)

---

## Task 7 — `src/lib/RecipientTable.svelte`: filter mode, status filter, sent section

1. Props — add three to the destructured `$props()` block (after `onEdit`):

```js
    labelMode = 'and',
    onToggleLabelMode,
    onToggleSent,
```

2. Import the split helper. At the top of `<script>` add:

```js
  import { splitBySent } from './groups.js'
```

3. State — after `let selectedOnly = $state(false)` add:

```js
  let statusFilter = $state('all')
  let sentOpen = $state(false)
```

4. Derived — replace the `listContacts` and `scope` blocks (lines 43–49) with:

```js
  let statusScoped = $derived(
    !template || statusFilter === 'all'
      ? shown
      : shown.filter(
          (c) => (statusFilter === 'sent') === Boolean(c.sentAt?.[template.id])
        )
  )

  let listContacts = $derived(
    effectiveSelectedOnly ? statusScoped.filter((c) => selected.includes(c.id)) : statusScoped
  )

  let split = $derived(splitBySent(listContacts, template?.id ?? null))
  let unsent = $derived(split.unsent)
  let sent = $derived(split.sent)
  let groupedBySent = $derived(statusFilter === 'all' && sent.length > 0)

  let scope = $derived(
    selected.length ? statusScoped.filter((c) => selected.includes(c.id)) : statusScoped
  )
```

   Leave `sentCount`, `focusIndex`, `focusContact`, `allShownSelected`, `someShownSelected`
   unchanged.

5. Add a small effect that resets the status filter when the template disappears:

```js
  $effect(() => {
    if (!template && statusFilter !== 'all') statusFilter = 'all'
  })
```

6. Label filter row (lines 198–215): add the match-mode toggle after the `{#each}` of chips,
   before the `Clear` button:

```svelte
      <button
        class="btn ghost xs match-toggle"
        type="button"
        aria-pressed={labelMode === 'or'}
        onclick={() => onToggleLabelMode?.(labelMode === 'and' ? 'or' : 'and')}
      >
        {labelMode === 'and' ? t('filterMatchAll') : t('filterMatchAny')}
      </button>
```

7. Status filter control — inside `.list-controls-right`, immediately before `.mobile-send-bar`:

```svelte
      {#if template}
        <div
          class="segmented status-seg"
          role="group"
          aria-label={t('statusAll')}
          style="--seg-idx: {['all', 'unsent', 'sent'].indexOf(statusFilter)}"
        >
          <span class="segmented-thumb" aria-hidden="true"></span>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'all'}
            onclick={() => (statusFilter = 'all')}
          >{t('statusAll')}</button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'unsent'}
            onclick={() => (statusFilter = 'unsent')}
          >{t('statusUnsent')}</button>
          <button
            type="button"
            class="segmented-btn"
            aria-pressed={statusFilter === 'sent'}
            onclick={() => (statusFilter = 'sent')}
          >{t('statusSent')}</button>
        </div>
      {/if}
```

8. Row markup — convert the existing `{#each listContacts as contact (contact.id)} … {/each}`
   body (lines 341–464) into a Svelte snippet and render it twice. Declare the snippet at the
   top level of the markup, immediately before the `{#if totalCount === 0}` chain, and wrap the
   current row `<div class="clist-row">…</div>` in:

```svelte
  {#snippet contactRow(contact)}
    {@const isSent = Boolean(template && contact.sentAt?.[template.id])}
    {@const missingCount = missingCountFor(contact)}
    {@const isFocused = focusedId === contact.id}
    {@const isSelected = selected.includes(contact.id)}
    <div class="clist-row" class:focused={isFocused} class:selected={isSelected} class:sent={isSent} role="listitem" ondblclick={…}>
      …existing inner markup unchanged…
    </div>
  {/snippet}
```

   Inside the row, in `.clist-status`, replace the `{#if isSent}…{/if}` badge with the sent
   badge text and add the toggle button in `.clist-actions`:

```svelte
              {#if isSent}
                <span class="badge success sm" title={t('sentBadge')}>
                  <span class="badge-dot" aria-hidden="true"></span>
                  {t('sentBadge')}
                </span>
              {:else if missingCount > 0}
                …unchanged missing-fields button…
              {/if}
```

   and, as the **first** button inside `.clist-actions` (before "Kelola"):

```svelte
              {#if template}
                <button
                  class="btn icon-btn ghost xs"
                  type="button"
                  title={isSent ? t('markUnsent') : t('markSent')}
                  aria-label={isSent ? t('markUnsent') : t('markSent')}
                  onclick={(e) => {
                    e.stopPropagation()
                    onToggleSent?.(contact, !isSent)
                  }}
                >
                  <Icon name={isSent ? 'x' : 'check'} size={12} />
                </button>
              {/if}
```

9. The list body — replace the final `{:else} … {/if}` (lines 339–465) with:

```svelte
{:else if statusScoped.length === 0 || (sendMode === 'list' && listContacts.length === 0)}
  …the existing empty-state block (noMatches + clear buttons), unchanged…
{:else}
  <div class="clist" data-mobile-mode={sendMode} role="list">
    {#if groupedBySent}
      {#each unsent as contact (contact.id)}{@render contactRow(contact)}{/each}
    {:else}
      {#each listContacts as contact (contact.id)}{@render contactRow(contact)}{/each}
    {/if}
  </div>

  {#if groupedBySent}
    <section class="sent-section">
      <button
        class="sent-toggle"
        type="button"
        aria-expanded={sentOpen}
        onclick={() => (sentOpen = !sentOpen)}
      >
        <Icon name="chevron-right" size={14} className={sentOpen ? 'rot-open' : ''} />
        <span>{t('sentSection', { n: sent.length })}</span>
      </button>
      {#if sentOpen}
        <div class="clist sent-list" data-mobile-mode={sendMode} role="list">
          {#each sent as contact (contact.id)}{@render contactRow(contact)}{/each}
        </div>
      {/if}
    </section>
  {/if}
{/if}
```

   Move the existing empty-state markup (the `{:else if shown.length === 0 || …}` block,
   lines 318–338) into the new `{:else if statusScoped.length === 0 || …}` branch, and add a
   reset button for the status filter next to the others:

```svelte
      {#if statusFilter !== 'all'}
        <button class="btn secondary sm" type="button" onclick={() => (statusFilter = 'all')}>
          {t('statusAll')}
        </button>
      {/if}
```

10. `countLabel` (line 162) — include the status filter in the "filtered" condition:

```js
  let countLabel = $derived(
    (query.trim() || labelFilter.length || selected.length || statusFilter !== 'all') && totalCount > 0
      ? t('rowsFiltered', { shown: scope.length, n: totalCount })
      : t('rows', { n: totalCount })
  )
```

---

## Task 8 — `src/lib/ContactsView.svelte` (new file)

```svelte
<script>
  import Icon from './Icon.svelte'
  import { groupOutline, filterByLabels } from './groups.js'

  let {
    contacts = [],
    groups = [],
    t,
    onAdd,
    onPaste,
    onImport,
    onOpen,
    onDelete,
    onAssign,
    onRename,
    onDeleteLabel,
    onCreateGroup,
    onReparent,
    undoLabel = null,
    onUndoRename,
    onBack,
  } = $props()

  let query = $state('')
  let labelMode = $state('and')
  let filterLabels = $state([])
  let selected = $state([])
  let activeGroupId = $state('')
  let dragId = $state(null)
  let dropId = $state(null)
  let menuId = $state(null)
  let renameFor = $state(null)
  let renameText = $state('')
  let newGroupText = $state('')
  let newParentId = $state(null)
  let addLabelText = $state('')
  let removeLabelText = $state('')

  let outline = $derived(groupOutline(groups))
  let labelPool = $derived([...new Set(contacts.flatMap((c) => c.labels ?? []))].sort())

  let counts = $derived.by(() => {
    const map = new Map()
    for (const c of contacts) for (const l of c.labels ?? []) map.set(l, (map.get(l) ?? 0) + 1)
    return map
  })

  let visible = $derived.by(() => {
    let list = contacts
    const active = groups.find((g) => g.id === activeGroupId)
    if (active) list = list.filter((c) => (c.labels ?? []).includes(active.name))
    list = filterByLabels(list, filterLabels, labelMode)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((c) => c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q))
    return list
  })

  let allVisibleSelected = $derived(visible.length > 0 && visible.every((c) => selected.includes(c.id)))

  $effect(() => {
    const ids = new Set(contacts.map((c) => c.id))
    if (selected.some((id) => !ids.has(id))) selected = selected.filter((id) => ids.has(id))
  })

  function labelHue(name) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
    return h
  }

  function toggleSelect(contact) {
    selected = selected.includes(contact.id)
      ? selected.filter((id) => id !== contact.id)
      : [...selected, contact.id]
  }

  function toggleAll() {
    selected = allVisibleSelected ? [] : [...new Set([...selected, ...visible.map((c) => c.id)])]
  }

  function toggleFilterLabel(label) {
    filterLabels = filterLabels.includes(label)
      ? filterLabels.filter((l) => l !== label)
      : [...filterLabels, label]
  }

  function pickGroup(id) {
    activeGroupId = activeGroupId === id ? '' : id
  }

  function startRename(group) {
    menuId = null
    renameFor = group.id
    renameText = group.name
  }

  function commitRename() {
    const group = groups.find((g) => g.id === renameFor)
    const next = renameText.trim()
    renameFor = null
    if (group && next && next !== group.name) onRename?.(group.name, next)
  }

  function doAddLabel() {
    const names = addLabelText.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
    if (!names.length || !selected.length) return
    onAssign?.(selected, names, 'add')
    addLabelText = ''
    selected = []
  }

  function doRemoveLabel() {
    const names = removeLabelText.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
    if (!names.length || !selected.length) return
    onAssign?.(selected, names, 'remove')
    removeLabelText = ''
    selected = []
  }

  function doDelete() {
    for (const id of selected) {
      const c = contacts.find((x) => x.id === id)
      if (c) onDelete?.(c)
    }
    selected = []
  }

  function onDrop(targetId) {
    if (dragId && dragId !== targetId) onReparent?.(dragId, targetId || null)
    dragId = null
    dropId = null
  }
</script>

<section class="contacts-view" aria-label={t('contactsTitle')}>
  <header class="contacts-head">
    <div>
      <h2>{t('contactsTitle')}</h2>
      <p class="hint">{t('contactsDesc')}</p>
    </div>
    <div class="contacts-head-actions">
      <button class="btn secondary sm" type="button" onclick={onAdd}>
        <Icon name="plus" size={13} /><span>{t('addContactShort')}</span>
      </button>
      <button class="btn secondary sm" type="button" onclick={onPaste}>
        <Icon name="clipboard" size={13} /><span>{t('pasteRowsShort')}</span>
      </button>
      <button class="btn secondary sm" type="button" onclick={onImport}>
        <Icon name="upload" size={13} /><span>{t('importContactsShort')}</span>
      </button>
      <button class="btn primary sm" type="button" onclick={onBack}>
        <Icon name="send" size={13} /><span>{t('backToSend')}</span>
      </button>
    </div>
  </header>

  {#if undoLabel}
    <div class="undo-bar" role="status">
      <span>{t('labelRenamed', { name: undoLabel.to })}</span>
      <button class="btn secondary xs" type="button" onclick={onUndoRename}>{t('undo')}</button>
    </div>
  {/if}

  <div class="contacts-grid">
    <aside class="group-tree" aria-label={t('groupsTitle')}>
      <div class="group-tree-head">
        <h3>{t('groupsTitle')}</h3>
      </div>

      {#if newParentId}
        {@const parent = groups.find((g) => g.id === newParentId)}
        <div class="group-add-hint">
          <span>{t('subgroupOf')}: {parent?.name ?? ''}</span>
          <button class="btn ghost xs" type="button" onclick={() => (newParentId = null)}>{t('cancel')}</button>
        </div>
      {/if}
      <form
        class="group-add"
        onsubmit={(e) => {
          e.preventDefault()
          if (newGroupText.trim()) onCreateGroup?.(newGroupText, newParentId)
          newGroupText = ''
          newParentId = null
        }}
      >
        <input class="input" bind:value={newGroupText} placeholder={t('groupNamePlaceholder')} aria-label={t('newGroup')} />
        <button class="btn secondary sm" type="submit" disabled={!newGroupText.trim()} aria-label={t('newGroup')}>
          <Icon name="plus" size={14} />
        </button>
      </form>

      <ul class="group-list" role="tree">
        <li>
          <button
            class="group-row"
            class:active={!activeGroupId}
            type="button"
            ondragover={(e) => { e.preventDefault(); dropId = '' }}
            ondrop={(e) => { e.preventDefault(); onDrop('') }}
          >
            <Icon name="users" size={13} />
            <span class="group-name">{t('allContactsGroup')}</span>
            <span class="badge neutral sm tabular">{contacts.length}</span>
          </button>
        </li>
        {#each outline as group (group.id)}
          <li
            class="group-item"
            class:drop={dropId === group.id}
            style="--depth:{group.depth}"
            draggable="true"
            ondragstart={() => (dragId = group.id)}
            ondragover={(e) => { e.preventDefault(); dropId = group.id }}
            ondragleave={() => { if (dropId === group.id) dropId = null }}
            ondrop={(e) => { e.preventDefault(); onDrop(group.id) }}
          >
            {#if renameFor === group.id}
              <form
                class="group-add"
                onsubmit={(e) => {
                  e.preventDefault()
                  commitRename()
                }}
              >
                <input class="input" bind:value={renameText} aria-label={t('renameGroup')} />
                <button class="btn secondary sm" type="submit">{t('done')}</button>
                <button class="btn ghost sm" type="button" onclick={() => (renameFor = null)}>{t('cancel')}</button>
              </form>
            {:else}
              <button class="group-row" class:active={activeGroupId === group.id} type="button" onclick={() => pickGroup(group.id)}>
                <Icon name="folder" size={13} />
                <span class="group-name">{group.name}</span>
                <span class="badge neutral sm tabular">{counts.get(group.name) ?? 0}</span>
              </button>
              <button
                class="group-menu-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuId === group.id}
                aria-label={t('groupsTitle') + ': ' + group.name}
                onclick={() => (menuId = menuId === group.id ? null : group.id)}
              >
                <Icon name="menu" size={13} />
              </button>
              {#if menuId === group.id}
                <div class="group-menu" role="menu">
                  <button type="button" role="menuitem" onclick={() => startRename(group)}>
                    <Icon name="edit" size={12} /><span>{t('renameGroup')}</span>
                  </button>
                  <button type="button" role="menuitem" onclick={() => { newParentId = group.id; menuId = null }}>
                    <Icon name="plus" size={12} /><span>{t('createSubgroup')}</span>
                  </button>
                  {#if group.parentId}
                    <button type="button" role="menuitem" onclick={() => { onReparent?.(group.id, null); menuId = null }}>
                      <Icon name="chevron-left" size={12} /><span>{t('makeTopLevel')}</span>
                    </button>
                  {/if}
                  <label class="group-menu-field">
                    <span>{t('moveUnder')}</span>
                    <select
                      class="input"
                      value={group.parentId ?? ''}
                      onchange={(e) => { onReparent?.(group.id, e.currentTarget.value || null); menuId = null }}
                    >
                      <option value="">{t('mainGroups')}</option>
                      {#each groups.filter((g) => g.id !== group.id) as other (other.id)}
                        <option value={other.id}>{other.name}</option>
                      {/each}
                    </select>
                  </label>
                  <button class="danger" type="button" role="menuitem" onclick={() => { onDeleteLabel?.(group.name); menuId = null }}>
                    <Icon name="trash" size={12} /><span>{t('deleteGroup')}</span>
                  </button>
                </div>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
      <p class="hint group-hint">{t('dragHint')}</p>
    </aside>

    <div class="contacts-main">
      <div class="contacts-tools">
        <div class="search-field">
          <span class="search-icon" aria-hidden="true"><Icon name="search" size={15} /></span>
          <input class="input search-input" type="search" placeholder={t('search')} bind:value={query} aria-label={t('search')} />
        </div>
        <label class="select-all-check">
          <input type="checkbox" checked={allVisibleSelected} disabled={!visible.length} onchange={toggleAll} />
          <span>{t('selectAll')}</span>
        </label>
      </div>

      {#if labelPool.length}
        <div class="label-filter">
          {#each labelPool as label (label)}
            <button class="chip" type="button" aria-pressed={filterLabels.includes(label)} onclick={() => toggleFilterLabel(label)}>
              {label}
            </button>
          {/each}
          <button class="btn ghost xs match-toggle" type="button" aria-pressed={labelMode === 'or'} onclick={() => (labelMode = labelMode === 'and' ? 'or' : 'and')}>
            {labelMode === 'and' ? t('filterMatchAll') : t('filterMatchAny')}
          </button>
          {#if filterLabels.length}
            <button class="btn ghost xs" type="button" onclick={() => (filterLabels = [])}>{t('clearLabels')}</button>
          {/if}
        </div>
      {/if}

      {#if selected.length}
        <div class="bulk-bar" role="region" aria-label={t('bulkActions')}>
          <span class="badge accent sm tabular">{t('selectedCount', { n: selected.length })}</span>
          <form class="bulk-inline" onsubmit={(e) => { e.preventDefault(); doAddLabel() }}>
            <input class="input" bind:value={addLabelText} placeholder={t('labelInputPlaceholder')} aria-label={t('bulkAssign')} list="group-names" />
            <button class="btn secondary xs" type="submit">{t('bulkAssign')}</button>
          </form>
          <form class="bulk-inline" onsubmit={(e) => { e.preventDefault(); doRemoveLabel() }}>
            <input class="input" bind:value={removeLabelText} placeholder={t('labelRemovedPlaceholder')} aria-label={t('bulkRemove')} list="group-names" />
            <button class="btn secondary xs" type="submit">{t('bulkRemove')}</button>
          </form>
          <button class="btn danger-ghost xs" type="button" onclick={doDelete}>
            <Icon name="trash" size={12} /><span>{t('bulkDelete')}</span>
          </button>
          <button class="btn icon-btn ghost xs" type="button" aria-label={t('selectNone')} onclick={() => (selected = [])}>
            <Icon name="x" size={13} />
          </button>
        </div>
      {/if}

      <datalist id="group-names">
        {#each groups as g (g.id)}<option value={g.name}></option>{/each}
      </datalist>

      {#if !visible.length}
        <div class="empty-state compact"><p>{t('noMatches')}</p></div>
      {:else}
        <div class="clist" role="list">
          {#each visible as contact (contact.id)}
            <div class="clist-row" class:selected={selected.includes(contact.id)} role="listitem">
              <div class="clist-top">
                <label class="clist-check">
                  <input type="checkbox" aria-label={contact.name || contact.phone} checked={selected.includes(contact.id)} onchange={() => toggleSelect(contact)} />
                </label>
                <button class="clist-identity" type="button" onclick={() => onOpen?.(contact)}>
                  <span class="clist-name" class:mono={!contact.name}>{contact.name || contact.phone}</span>
                  {#if contact.name}<span class="clist-phone mono tabular">{contact.phone}</span>{/if}
                </button>
                <div class="clist-status">
                  <button class="btn secondary xs" type="button" onclick={() => onOpen?.(contact)}>
                    <Icon name="edit" size={12} /><span>{t('manageContact')}</span>
                  </button>
                  <button
                    class="btn icon-btn danger-ghost xs"
                    type="button"
                    title={t('delete')}
                    aria-label={t('deleteContactAria', { name: contact.name || contact.phone })}
                    onclick={() => onDelete?.(contact)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
              {#if (contact.labels ?? []).length}
                <div class="clist-labels">
                  {#each contact.labels as label (label)}
                    <span class="label-chip" style="--label-hue:{labelHue(label)}">{label}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>
```

---

## Task 9 — `src/App.svelte` wiring

1. Imports. After the `contacts.js` import (line 8) add:

```js
  import {
    filterByLabels, assignLabels, expandLabels, renameLabel, deleteLabel, createGroup, setGroupParent, syncGroups,
  } from './lib/groups.js'
```

   After the `RecipientTable` import (line 12) add:

```js
  import ContactsView from './lib/ContactsView.svelte'
```

2. State — after `let labelFilter = $state([])` (line 53) add:

```js
  let labelMode = $state('and')
  let labelUndo = $state(null)
  let undoTimer
```

3. Derived — replace `filteredContacts` (lines 81–85) with:

```js
  let labelPool = $derived(uniqueLabels(data.contacts))
  let filteredContacts = $derived(filterByLabels(data.contacts, labelFilter, labelMode))
```

   (`labelPool` moves up; remove the old line 80 to avoid a duplicate declaration.)

4. Add `syncGroups` to the migration-on-boot safety net. After the `$effect` at line 153
   (`JSON.stringify(data)`), add:

```js
  $effect(() => {
    const names = new Set(data.groups.map((g) => g.name))
    const missing = uniqueLabels(data.contacts).some((l) => !names.has(l))
    if (missing) syncGroups(data.groups, data.contacts)
  })
```

5. Group / label handlers — after `toggleLabelFilter` add:

```js
  function toggleLabelMode(mode) {
    labelMode = mode
  }

  function assignLabelsTo(ids, labels, mode) {
    const names = mode === 'remove' ? labels : expandLabels(data.groups, labels)
    const changed = assignLabels(data.contacts, ids, names, mode)
    notify(t('contactsUpdated', { n: changed }))
  }

  function renameGroupName(from, to) {
    renameLabel(data.groups, data.contacts, from, to)
    labelFilter = labelFilter.map((l) => (l === from ? to : l))
    labelUndo = { from, to }
    clearTimeout(undoTimer)
    undoTimer = setTimeout(() => (labelUndo = null), 8000)
  }

  function undoRenameGroup() {
    if (!labelUndo) return
    renameLabel(data.groups, data.contacts, labelUndo.to, labelUndo.from)
    labelFilter = labelFilter.map((l) => (l === labelUndo.to ? labelUndo.from : l))
    labelUndo = null
    clearTimeout(undoTimer)
  }

  function removeGroup(name) {
    deleteLabel(data.groups, data.contacts, name)
    labelFilter = labelFilter.filter((l) => l !== name)
    if (labelUndo && (labelUndo.from === name || labelUndo.to === name)) labelUndo = null
  }

  function createNewGroup(name, parentId = null) {
    const row = createGroup(data.groups, name, parentId)
    if (row) labelUndo = null
  }

  function reparentGroup(id, parentId) {
    if (!setGroupParent(data.groups, id, parentId)) notify(t('dragHint'))
  }

  function toggleSent(contact, sent) {
    if (!active) return
    contact.sentAt ??= {}
    if (sent) contact.sentAt[active.id] = new Date().toISOString()
    else delete contact.sentAt[active.id]
  }
```

6. `doReplace()` (line 582) — after `labelFilter = []` add `labelMode = 'and'` and `labelUndo = null`.

7. `doImportContacts` (line 601) — after the `labelFilter` re-filter line add
   `syncGroups(data.groups, data.contacts)`.

8. Entry points — add a desktop toolbar button. After the theme button (line 690), before Help:

```svelte
      <button class="btn secondary sm" type="button" onclick={() => switchMobileTab('contacts')}>
        <Icon name="users" size={15} />
        <span>{t('navContacts')}</span>
      </button>
```

9. Mobile menu — after the import-contacts item (line 828) add:

```svelte
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            switchMobileTab('contacts')
          }}
        >
          <Icon name="users" size={16} />
          <span>{t('navContacts')}</span>
        </button>
```

10. Render the view. The workspace currently sits directly inside
    `<div class="mobile-viewport">` (line 874). Change that region to render either the workspace
    or the contacts view:

```svelte
  <div class="mobile-viewport" bind:this={viewportEl}>
  {#if mobileTab === 'contacts'}
    <ContactsView
      contacts={data.contacts}
      groups={data.groups}
      {t}
      onAdd={openAddModal}
      onPaste={openPasteModal}
      onImport={() => (showContactImport = true)}
      onOpen={(contact) => openContactModal(contact, data.contacts)}
      onDelete={deleteContact}
      onAssign={assignLabelsTo}
      onRename={renameGroupName}
      onDeleteLabel={removeGroup}
      onCreateGroup={createNewGroup}
      onReparent={reparentGroup}
      {undoLabel}
      onUndoRename={undoRenameGroup}
      onBack={() => switchMobileTab('send')}
    />
  {:else}
  <main class="workspace" class:single={!active}>
    …existing workspace markup, unchanged…
  </main>
  {/if}
  </div>
```

11. Bottom nav — add a fifth button before `navSend` (line 1340):

```svelte
    <button
      type="button"
      class="mobile-nav-btn"
      class:active={mobileTab === 'contacts'}
      aria-current={mobileTab === 'contacts' ? 'page' : undefined}
      onclick={() => switchMobileTab('contacts')}
    >
      <Icon name="users" size={18} />
      <span class="mobile-nav-label">{t('navContacts')}</span>
    </button>
```

12. `RecipientTable` usage (line 1002) — add the new props:

```svelte
          {labelMode}
          onToggleLabelMode={toggleLabelMode}
          onToggleSent={toggleSent}
```

13. Modal-open guards — add `|| labelUndo` is **not** needed. But the `deleteContact` function
    must still work from the new view; it already exists and takes a contact. Confirm it removes
    from `data.contacts` (it does at line ~447).

---

## Task 10 — `src/styles.css`

Mobile nav columns. Change the media-query rule (line ~3850):

```css
  .mobile-nav {
    flex: none;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
    …
  }
```

Add a new block near the recipients styles (after `.recipients .label-filter .chip`, line 2138):

```css
.contacts-view {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.contacts-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.contacts-head h2 {
  font-size: 1rem;
}

.contacts-head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.contacts-grid {
  display: grid;
  grid-template-columns: clamp(210px, 24vw, 280px) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.group-tree {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  padding: var(--space-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
}

.group-tree-head h3 {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.group-add,
.bulk-inline {
  display: flex;
  gap: 6px;
  min-width: 0;
}

.group-add-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 8px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.group-list {
  display: grid;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.group-item {
  position: relative;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  padding: 0 8px 0 calc(8px + var(--depth, 0) * 14px);
  font: inherit;
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  color: var(--foreground);
  background: transparent;
  border: 0;
  border-radius: var(--radius-control);
}

.group-row:hover {
  background: var(--surface-muted);
}

.group-row.active {
  background: var(--accent-subtle);
  color: color-mix(in oklab, var(--accent-strong) 88%, var(--foreground));
}

.group-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-item.drop {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
  border-radius: var(--radius-control);
}

.group-menu-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.group-menu {
  position: absolute;
  z-index: 30;
  right: 4px;
  top: 30px;
  display: grid;
  gap: 2px;
  min-width: 190px;
  padding: 6px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-floating);
}

.group-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  color: var(--foreground);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.group-menu button:hover {
  background: var(--surface-muted);
}

.group-menu button.danger {
  color: var(--danger);
}

.group-menu-field {
  display: grid;
  gap: 4px;
  padding: 4px 8px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.contacts-main {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  min-width: 0;
}

.contacts-tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.bulk-bar .input {
  min-width: 120px;
  height: 30px;
  font-size: var(--text-xs);
}

.undo-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 8px 12px;
  font-size: var(--text-xs);
  background: var(--accent-subtle);
  border: 1px solid color-mix(in oklab, var(--accent) 35%, var(--border));
  border-radius: var(--radius-control);
}

.match-toggle {
  flex: none;
}

.sent-section {
  display: grid;
  gap: 4px;
  margin-top: var(--space-2);
}

.sent-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 10px;
  font: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.sent-toggle svg.rot-open {
  transform: rotate(90deg);
}

.sent-list {
  opacity: 0.86;
}
```

The contacts view is rendered only when `mobileTab === 'contacts'` (Task 9 step 10), so no
`display` toggling is needed — only the mobile stacking. Inside the `@media (max-width: 760px)`
block that defines the `data-mobile-tab` rules (line ~3469) add:

```css
  .contacts-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .contacts-tools {
    flex-wrap: wrap;
  }
```

Use only CSS variables already defined; do not add new `:root` entries.

---

## Task 11 — `src/lib/i18n.svelte.js`: help items

`HelpModal.svelte` renders `t('helpItems')` generically (line 52), so no component change is
needed. Find the `helpItems` array (EN + ID) and add one item to each:

- EN: `'Contacts view: group contacts, nest subgroups, rename or delete a group in one place, and filter with All/Any labels before sending.'`
- ID: `'Tampilan Kontak: kelompokkan kontak, susun subgrup, ganti nama atau hapus grup di satu tempat, dan filter dengan semua/salah satu label sebelum kirim.'`

---

## Task 12 — `docs/USAGE.md`

Add a section:

```md
## Grup dan subgrup kontak

Kontak dikelompokkan dengan label. Untuk mengatur per grup dan subgrup:

1. Buka tab **Kontak** (tombol di toolbar desktop, atau ikon Kontak di navigasi bawah).
2. Tab **Grup** di kiri: buat grup baru, atau buka menu (⋯) sebuah grup untuk mengganti nama,
   menambah subgrup, memindah, atau menghapus.
3. Tarik satu grup ke grup lain untuk menjadikannya subgrup; tarik ke "Grup utama" untuk
   mengembalikannya ke atas. Menu (⋯) → **Pindah ke bawah** melakukan hal yang sama tanpa tarik.
4. Pilih beberapa kontak, lalu pakai bilah pilihan untuk **Tambah label** (mis. `Kue`),
   **Hapus label**, atau hapus kontak.
5. Menghapus grup akan membuang label itu dari semua kontak; subgrupnya naik satu tingkat.
   Mengganti nama grup langsung mengubah label di semua kontak, dan ada tombol **Batalkan**.

### Kirim per grup

Di tab **Kirim**, pilih chip label: dengan mode **Semua label** kontak harus punya semua label
(mis. `Kue` + `Perumahan Agape`); dengan **Salah satu label** cukup salah satu. Filter
**Belum terkirim / Sudah terkirim** menyaring berdasarkan template yang aktif.

### Tanda terkirim

Membuka tautan WhatsApp menandai kontak itu terkirim untuk template aktif. Kontak terkirim
pindah ke bagian **Sudah terkirim (n)** yang terlipat di bawah daftar. Tiap baris punya tombol
kecil untuk **menandai** atau **membatalkan** tanda terkirim.

Semua grup dan label ikut tersimpan di backup (Export/Import), termasuk susunan subgrup, jadi
pindah perangkat tetap lengkap.
```

---

## Verification

```bash
npm run test
npm run build
npm run dev
```

Manual checklist:

- `npm run test`: all of `groups.test.js`, `storage.test.js`, and the existing suites green.
- Old local storage with labels loads; the Kontak tab shows each label as a group.
- Import a v3 backup: groups appear, contacts keep labels, no duplicates.
- Kontak tab: create group `Kue`, add `Agape` as a subgroup via the ⋯ menu; drag `Agape` onto
  `Kue`; drop onto "Grup utama" to un-nest. Cycle drop (drag `Kue` onto `Agape`) does nothing and
  shows a hint.
- Select several contacts → **Tambah label** `Kue`: they gain `Kue`; a subgroup assignment also
  adds ancestors.
- Rename `Kue` → `Kue Kering`: labels update everywhere, undo bar appears, **Batalkan** restores
  the old name; the Send tab chip updates too.
- Delete a group: label disappears from contacts; its subgroup becomes top-level.
- Send tab: pick `Kue` + `Perumahan Agape` in **Semua label** → only contacts with both;
  switch to **Salah satu label** → union.
- Status filter **Sudah terkirim / Belum terkirim** narrows the list; **Semua** shows both with
  the collapsed "Sudah terkirim (n)" section at the bottom.
- Open a WhatsApp link → contact moves into the sent section; toggle it off again.
- Export, then Import → groups, hierarchy, labels, and sent marks all return.
- Mobile ≤760px: bottom nav has 5 buttons and fits; the Kontak view stacks to one column;
  the group menu opens and is reachable by keyboard (Tab + Enter).
- Keyboard-only: reach a group row, open the ⋯ menu, use **Pindah ke bawah** select to reparent.

Commit:

```
Add contact groups with subgroups, group manager, and sent tracking
```
