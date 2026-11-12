# Implementation Plan — Template Groups, Template Manager, Search and Filter

Spec: `docs/superpowers/specs/2026-11-12-template-groups-design.md`
Status: ready to implement

Follow existing patterns: Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`), all
user-facing text via `t('key')` with EN + ID in `src/lib/i18n.svelte.js`, plain logic in
dependency-free `src/lib/*.js` modules with `node:test` unit tests, modals copied from
`src/lib/LabelFilter.svelte`, backup through `src/lib/storage.js`.

Tasks are in dependency order. Do them in sequence; each leaves the app buildable and
`npm run test` green.

---

## Task 1 — `src/lib/templateGroups.js` (new file)

Pure helpers. No DOM, and **no import from `storage.js`** (storage imports this module; a cycle
would be created). Create with exactly this content:

```js
/** Template-group registry helpers. Pure: no DOM, no storage import. */

const clean = (s) => String(s ?? '').trim()

function tgid() {
  return 'tgrp_' + Math.random().toString(36).slice(2, 10)
}

/** Normalise raw registry rows: string names, unique, valid parent, no cycles. */
export function normalizeTemplateGroups(raw) {
  const rows = []
  const seen = new Set()
  const seenIds = new Set()
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!g || typeof g !== 'object') continue
    const name = clean(g.name)
    if (!name || seen.has(name)) continue
    seen.add(name)
    let id = typeof g.id === 'string' && g.id ? g.id : tgid()
    while (seenIds.has(id)) id = tgid()
    seenIds.add(id)
    rows.push({
      id,
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
    const visited = new Set([g.id])
    let cur = g
    while (cur?.parentId) {
      if (visited.has(cur.parentId)) {
        cur.parentId = null
        break
      }
      visited.add(cur.parentId)
      cur = byId.get(cur.parentId)
    }
  }
  return rows
}

/** Create a group if the name is free; returns the existing or new row, or null for a blank name. */
export function createTemplateGroup(groups, name, parentId = null) {
  const cleanName = clean(name)
  if (!cleanName) return null
  const existing = groups.find((g) => g.name === cleanName)
  if (existing) return existing
  const validParent = parentId && groups.some((g) => g.id === parentId) ? parentId : null
  const ids = new Set(groups.map((g) => g.id))
  let id = tgid()
  while (ids.has(id)) id = tgid()
  const row = { id, name: cleanName, parentId: validParent }
  groups.push(row)
  return row
}

/** Flat display order: parents A→Z, each followed by its descendants, with a depth. */
export function templateGroupOutline(groups) {
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
export function isTemplateGroupDescendant(groups, id, maybeId) {
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
export function setTemplateGroupParent(groups, id, parentId) {
  const g = groups.find((x) => x.id === id)
  if (!g) return false
  if (parentId && !groups.some((x) => x.id === parentId)) return false
  if (parentId && isTemplateGroupDescendant(groups, id, parentId)) return false
  g.parentId = parentId ?? null
  return true
}

/** Ancestor names of a group, nearest first, excluding the group itself. */
export function templateGroupAncestors(groups, id) {
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

/** Breadcrumb path root → leaf, e.g. "Usaha Roti › Pemberitahuan". Empty for an unknown group. */
export function templateGroupPath(groups, id) {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const g = id ? byId.get(id) : null
  if (!g) return ''
  return [...templateGroupAncestors(groups, g.id)].reverse().concat(g.name).join(' › ')
}

/** Ids of a group and every group beneath it, including the group itself. Empty for a falsy id. */
export function templateGroupDescendantIds(groups, id) {
  if (!id) return []
  return groups.filter((g) => isTemplateGroupDescendant(groups, id, g.id)).map((g) => g.id)
}

/**
 * Rename a group. Registry only — templates reference the group by id, so no template is touched.
 * Rejects blank names and names already taken. Returns true on change.
 */
export function renameTemplateGroup(groups, from, to) {
  const oldName = clean(from)
  const newName = clean(to)
  if (!oldName || !newName || oldName === newName) return false
  const g = groups.find((x) => x.name === oldName)
  if (!g) return false
  if (groups.some((x) => x.name === newName)) return false
  g.name = newName
  return true
}

/**
 * Delete a group: drop the row, promote its subgroups one level, and move its templates to the
 * deleted group's parent (or "No group" when it was top-level). Never deletes a template.
 * Returns the number of templates moved.
 */
export function deleteTemplateGroup(groups, templates, id) {
  const g = groups.find((x) => x.id === id)
  if (!g) return 0
  const parentId = g.parentId ?? null
  for (const child of groups) if (child.parentId === g.id) child.parentId = parentId
  groups.splice(groups.indexOf(g), 1)
  let moved = 0
  for (const t of templates ?? []) {
    if (t.groupId !== id) continue
    t.groupId = parentId
    moved++
  }
  return moved
}

/** Move the templates in `ids` into `groupId` (null = No group). Returns templates changed. */
export function assignTemplateGroup(templates, ids, groupId) {
  const set = new Set(ids)
  const target = groupId || null
  let changed = 0
  for (const t of templates ?? []) {
    if (!set.has(t.id)) continue
    if ((t.groupId ?? null) === target) continue
    t.groupId = target
    changed++
  }
  return changed
}

/** Map of groupId → number of templates directly in that group (subgroups not counted). */
export function templateGroupCounts(groups, templates) {
  const map = new Map(groups.map((g) => [g.id, 0]))
  for (const t of templates ?? []) {
    if (t.groupId && map.has(t.groupId)) map.set(t.groupId, map.get(t.groupId) + 1)
  }
  return map
}

/**
 * Templates matching the search query and the group filter.
 * `focusGroupId`: '' = all groups, '__none__' = only templates without a group, otherwise a group
 * id and all of its subgroups. `query` matches the template name or any name in its group path.
 */
export function filterTemplates(templates, groups, query = '', focusGroupId = '') {
  const q = clean(query).toLowerCase()
  let list = templates ?? []
  if (focusGroupId === '__none__') {
    list = list.filter((t) => !t.groupId)
  } else if (focusGroupId) {
    const ids = new Set(templateGroupDescendantIds(groups, focusGroupId))
    list = list.filter((t) => t.groupId && ids.has(t.groupId))
  }
  if (!q) return list
  return list.filter((t) => {
    if (String(t.name ?? '').toLowerCase().includes(q)) return true
    return templateGroupPath(groups, t.groupId).toLowerCase().includes(q)
  })
}
```

---

## Task 2 — `src/lib/templateGroups.test.js` (new file)

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTemplateGroups,
  createTemplateGroup,
  templateGroupOutline,
  isTemplateGroupDescendant,
  setTemplateGroupParent,
  templateGroupAncestors,
  templateGroupPath,
  templateGroupDescendantIds,
  renameTemplateGroup,
  deleteTemplateGroup,
  assignTemplateGroup,
  templateGroupCounts,
  filterTemplates,
} from './templateGroups.js'

const seed = () =>
  normalizeTemplateGroups([
    { id: 'roti', name: 'Usaha Roti' },
    { id: 'pem', name: 'Pemberitahuan', parentId: 'roti' },
    { id: 'ingat', name: 'Pengingat Pembayaran', parentId: 'pem' },
    { id: 'makasih', name: 'Terima kasih sudah bayar', parentId: 'pem' },
    { id: 'promo', name: 'Promo', parentId: 'roti' },
  ])

test('normalizeTemplateGroups trims, dedupes, and matches a parent by name', () => {
  const rows = normalizeTemplateGroups([
    { name: ' Usaha Roti ' },
    { name: 'Usaha Roti' },
    { name: '' },
    { name: 'Pemberitahuan', parentId: 'Usaha Roti' },
  ])
  assert.equal(rows.length, 2)
  assert.ok(rows[0].id)
  assert.equal(rows[1].parentId, rows[0].id)
})

test('normalizeTemplateGroups drops cycles and self-parents', () => {
  const rows = normalizeTemplateGroups([
    { id: 'a', name: 'A', parentId: 'b' },
    { id: 'b', name: 'B', parentId: 'a' },
    { id: 'c', name: 'C', parentId: 'c' },
  ])
  const byId = Object.fromEntries(rows.map((g) => [g.id, g]))
  assert.equal(byId.c.parentId, null)
  assert.ok(byId.a.parentId === null || byId.b.parentId === null)
})

test('createTemplateGroup is idempotent by name and rejects blanks', () => {
  const groups = []
  const a = createTemplateGroup(groups, 'Usaha Roti')
  const b = createTemplateGroup(groups, ' Usaha Roti ')
  assert.equal(a, b)
  assert.equal(groups.length, 1)
  assert.equal(createTemplateGroup(groups, '  '), null)
})

test('templateGroupOutline lists parents A-Z then indented descendants', () => {
  const groups = normalizeTemplateGroups([
    { id: 'r', name: 'Usaha Roti' },
    { id: 'p', name: 'Pemberitahuan', parentId: 'r' },
    { id: 'i', name: 'Pengingat', parentId: 'p' },
    { id: 'b', name: 'Bolu' },
  ])
  assert.deepEqual(
    templateGroupOutline(groups).map((g) => [g.name, g.depth]),
    [
      ['Bolu', 0],
      ['Usaha Roti', 0],
      ['Pemberitahuan', 1],
      ['Pengingat', 2],
    ]
  )
})

test('ancestors, path, and descendant ids follow the chain', () => {
  const groups = seed()
  assert.deepEqual(templateGroupAncestors(groups, 'ingat'), ['Pemberitahuan', 'Usaha Roti'])
  assert.equal(templateGroupPath(groups, 'ingat'), 'Usaha Roti › Pemberitahuan › Pengingat Pembayaran')
  assert.equal(templateGroupPath(groups, null), '')
  assert.deepEqual(new Set(templateGroupDescendantIds(groups, 'pem')), new Set(['pem', 'ingat', 'makasih']))
})

test('setTemplateGroupParent rejects self and descendant parents', () => {
  const groups = seed()
  assert.equal(isTemplateGroupDescendant(groups, 'roti', 'ingat'), true)
  assert.equal(setTemplateGroupParent(groups, 'roti', 'roti'), false)
  assert.equal(setTemplateGroupParent(groups, 'roti', 'ingat'), false)
  assert.equal(setTemplateGroupParent(groups, 'pem', null), true)
  assert.equal(groups.find((g) => g.id === 'pem').parentId, null)
})

test('renameTemplateGroup renames the registry only and rejects a taken name', () => {
  const groups = seed()
  assert.equal(renameTemplateGroup(groups, 'Promo', 'Diskon'), true)
  assert.equal(groups.find((g) => g.name === 'Diskon').id, 'promo')
  assert.equal(renameTemplateGroup(groups, 'Diskon', 'Pemberitahuan'), false)
  assert.equal(renameTemplateGroup(groups, 'Missing', 'X'), false)
})

test('deleteTemplateGroup promotes subgroups and moves templates up', () => {
  const groups = normalizeTemplateGroups([
    { id: 'roti', name: 'Usaha Roti' },
    { id: 'pem', name: 'Pemberitahuan', parentId: 'roti' },
    { id: 'ingat', name: 'Pengingat', parentId: 'pem' },
  ])
  const templates = [
    { id: 't1', groupId: 'pem' },
    { id: 't2', groupId: 'ingat' },
    { id: 't3', groupId: null },
  ]
  const moved = deleteTemplateGroup(groups, templates, 'pem')
  assert.equal(moved, 1)
  assert.equal(groups.find((g) => g.id === 'ingat').parentId, 'roti')
  assert.equal(templates.find((t) => t.id === 't1').groupId, 'roti')
  assert.equal(templates.find((t) => t.id === 't2').groupId, 'ingat')
  assert.equal(templates.length, 3)
})

test('deleteTemplateGroup on a top-level group sends templates to No group', () => {
  const groups = normalizeTemplateGroups([{ id: 'r', name: 'Usaha Roti' }])
  const templates = [{ id: 't1', groupId: 'r' }]
  assert.equal(deleteTemplateGroup(groups, templates, 'r'), 1)
  assert.equal(templates[0].groupId, null)
})

test('assignTemplateGroup skips templates already in the target group', () => {
  const templates = [
    { id: 't1', groupId: 'a' },
    { id: 't2', groupId: null },
  ]
  assert.equal(assignTemplateGroup(templates, ['t1', 't2'], 'a'), 1)
  assert.equal(templates[0].groupId, 'a')
  assert.equal(templates[1].groupId, 'a')
  assert.equal(assignTemplateGroup(templates, ['t1'], 'a'), 0)
})

test('templateGroupCounts counts direct members only', () => {
  const groups = seed()
  const templates = [
    { id: 't1', groupId: 'pem' },
    { id: 't2', groupId: 'ingat' },
    { id: 't3', groupId: 'ingat' },
  ]
  const counts = templateGroupCounts(groups, templates)
  assert.equal(counts.get('pem'), 1)
  assert.equal(counts.get('ingat'), 2)
  assert.equal(counts.get('roti'), 0)
})

test('filterTemplates narrows by group, subgroup, and No group', () => {
  const groups = seed()
  const templates = [
    { id: 't1', name: 'Ingat bayar', groupId: 'ingat' },
    { id: 't2', name: 'Terima kasih', groupId: 'makasih' },
    { id: 't3', name: 'Promo lebaran', groupId: 'promo' },
    { id: 't4', name: 'Draft', groupId: null },
  ]
  const ids = (list) => list.map((t) => t.id)
  assert.deepEqual(ids(filterTemplates(templates, groups, '', '')), ['t1', 't2', 't3', 't4'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', 'pem')), ['t1', 't2'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', 'roti')), ['t1', 't2', 't3'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', '__none__')), ['t4'])
})

test('filterTemplates matches the template name or the group path', () => {
  const groups = seed()
  const templates = [
    { id: 't1', name: 'Ingat bayar', groupId: 'ingat' },
    { id: 't2', name: 'Promo lebaran', groupId: 'promo' },
  ]
  assert.deepEqual(filterTemplates(templates, groups, 'bayar', '').map((t) => t.id), ['t1'])
  assert.deepEqual(filterTemplates(templates, groups, 'roti', '').map((t) => t.id), ['t1', 't2'])
  assert.deepEqual(filterTemplates(templates, groups, 'pemberitahuan', '').map((t) => t.id), ['t1'])
  assert.deepEqual(filterTemplates(templates, groups, 'zzz', ''), [])
})
```

Run `npm run test`. This file must pass before continuing.

---

## Task 3 — `src/lib/storage.js`: schema v5 + `templateGroups`

1. Bump the version (line 6):

```js
export const SCHEMA_VERSION = 5
```

2. Add the import after the `dates.js` import (line 4):

```js
import { normalizeTemplateGroups } from './templateGroups.js'
```

3. `emptyState()` — add `templateGroups`:

```js
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    groups: [],
    templateGroups: [],
    templates: [],
    contacts: [],
  }
}
```

4. `migrate()` — add `templateGroups` to the returned object:

```js
export function migrate(raw) {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    groups: normalizeGroups(raw?.groups),
    templateGroups: normalizeTemplateGroups(raw?.templateGroups),
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    contacts: Array.isArray(raw?.contacts) ? raw.contacts : [],
  }
```

5. In the same `migrate()`, inside the `state.templates = state.templates.map(...)` object, add
   `groupId` right after `vars` (so the mapped object ends `vars: [...], groupId: ..., createdAt: ...`):

```js
      groupId: typeof t.groupId === 'string' && t.groupId ? t.groupId : null,
```

6. Just **before** the existing `syncGroups(state.groups, state.contacts)` line (inside
   `migrate()`), add the dangling-reference guard:

```js
  const tgIds = new Set(state.templateGroups.map((g) => g.id))
  for (const t of state.templates) if (t.groupId && !tgIds.has(t.groupId)) t.groupId = null

  syncGroups(state.groups, state.contacts)
```

7. `mergeStates()` — insert this block at the very top of the function body, **before** the
   `const byId = new Map(local.templates.map(...))` line:

```js
  local.templateGroups ??= []
  const tgByName = new Map(local.templateGroups.map((g) => [g.name, g]))
  const tgIds = new Set(local.templateGroups.map((g) => g.id))
  const tgRemap = new Map()
  const tgAdded = []
  for (const g of incoming.templateGroups ?? []) {
    const existing = tgByName.get(g.name)
    if (existing) {
      tgRemap.set(g.id, existing.id)
      continue
    }
    let id = g.id && !tgIds.has(g.id) ? g.id : uid('tgrp')
    while (tgIds.has(id)) id = uid('tgrp')
    tgIds.add(id)
    const row = { id, name: g.name, parentId: null }
    tgByName.set(row.name, row)
    tgRemap.set(g.id, id)
    tgAdded.push([g, row])
  }
  for (const [src, row] of tgAdded) {
    const parentId = src.parentId
      ? tgRemap.get(src.parentId) ?? (tgIds.has(src.parentId) ? src.parentId : null)
      : null
    row.parentId = parentId && parentId !== row.id ? parentId : null
    local.templateGroups.push(row)
  }
```

8. In the same `mergeStates()`, in the templates loop, change the push line

```js
    local.templates.push(t)
```

   to

```js
    t.groupId = t.groupId ? tgRemap.get(t.groupId) ?? t.groupId : null
    local.templates.push(t)
```

9. `validateState()` counts — add the template-group count:

```js
    counts: {
      templates: data.templates.length,
      contacts: data.contacts.length,
      labels: uniqueLabels(data.contacts).length,
      groups: data.groups.length,
      templateGroups: data.templateGroups.length,
    },
```

No change to `loadState`, `scheduleSave`, `saveNow`, `downloadExport`.

---

## Task 4 — `src/lib/storage.test.js`

1. Test `migrate upgrades v1 to v4 with labels, vars, auto, and groups` (line 63): rename it to
   `migrate upgrades v1 to v5 with labels, vars, auto, groups, and template groups`, change the
   version assert to `5`, and add:

```js
  assert.deepEqual(state.templateGroups, [])
  assert.equal(state.templates[0].groupId, null)
```

2. Test `validateState returns ... for v1 and v2` (line 105): change both version asserts (lines
   111 and 123) to `5`, and add `templateGroups: 0` to both counts objects:

```js
  assert.deepEqual(v1.counts, { templates: 1, contacts: 1, labels: 0, groups: 0, templateGroups: 0 })
```

```js
  assert.deepEqual(v2.counts, { templates: 1, contacts: 2, labels: 2, groups: 2, templateGroups: 0 })
```

3. Add at the end of the file:

```js
test('migrate resets a groupId that references a missing template group', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '', groupId: 'ghost' }],
    templateGroups: [],
    contacts: [],
  })
  assert.equal(state.templates[0].groupId, null)
})

test('mergeStates unions template groups and remaps incoming template refs', () => {
  const local = emptyState()
  local.templateGroups.push({ id: 'r_local', name: 'Usaha Roti', parentId: null })
  local.templates.push({ id: 't1', name: 'A', body: '', groupId: null })

  const incoming = emptyState()
  incoming.templateGroups.push({ id: 'r_remote', name: 'Usaha Roti', parentId: null })
  incoming.templateGroups.push({ id: 'p_remote', name: 'Pemberitahuan', parentId: 'r_remote' })
  incoming.templates.push({ id: 't9', name: 'Ingat', body: '', groupId: 'p_remote' })

  mergeStates(local, incoming)

  assert.equal(local.templateGroups.filter((g) => g.name === 'Usaha Roti').length, 1)
  const added = local.templates.find((t) => t.id === 't9')
  const pem = local.templateGroups.find((g) => g.name === 'Pemberitahuan')
  assert.equal(added.groupId, pem.id)
  assert.equal(pem.parentId, 'r_local')
})
```

`npm run test` must pass before continuing.

---

## Task 5 — `src/lib/i18n.svelte.js`: strings

Add to the `en` dict (near `templates` / `newTemplate`, e.g. after `untitled`):

```js
    manageTemplates: 'Manage templates',
    templateGroupsTitle: 'Template groups',
    templateGroupsDesc: 'Organise templates into groups and subgroups, then search and filter.',
    templateGroupNamePlaceholder: 'Group name',
    newTemplateGroup: 'New group',
    renameTemplateGroup: 'Rename group',
    deleteTemplateGroup: 'Delete group',
    deleteTemplateGroupConfirm: 'Delete this group? Its templates move to the parent group.',
    createTemplateSubgroup: 'Add subgroup',
    templateSearchPlaceholder: 'Search templates or groups',
    filterByGroup: 'Filter by group',
    allGroups: 'All groups',
    templateGroupField: 'Group',
    templateDragHint: 'Drag a template onto a group to move it.',
    templatesMoved: '{n} templates moved',
```

(`noGroup`, `subgroupOf`, `moveUnder`, `mainGroups`, and `done` already exist — do not add them
again.)

Add the matching `id` dict keys:

```js
    manageTemplates: 'Kelola template',
    templateGroupsTitle: 'Grup template',
    templateGroupsDesc: 'Atur template per grup dan subgrup, lalu cari dan filter.',
    templateGroupNamePlaceholder: 'Nama grup',
    newTemplateGroup: 'Grup baru',
    renameTemplateGroup: 'Ganti nama grup',
    deleteTemplateGroup: 'Hapus grup',
    deleteTemplateGroupConfirm: 'Hapus grup ini? Template di dalamnya naik ke grup induk.',
    createTemplateSubgroup: 'Tambah subgrup',
    templateSearchPlaceholder: 'Cari template atau grup',
    filterByGroup: 'Filter grup',
    allGroups: 'Semua grup',
    templateGroupField: 'Grup',
    templateDragHint: 'Tarik template ke grup untuk memindahkannya.',
    templatesMoved: '{n} template dipindah',
```

Also extend the `aboutFeatures` array in **both** dicts: after the existing "Rename and nest
groups…" / "Ganti nama dan susun grup…" line, add an item:

- EN: `'Group templates into nested groups, then search and filter by group.'`
- ID: `'Kelompokkan template ke grup bersarang, lalu cari dan filter per grup.'`

Also extend `helpItems` in **both** dicts: after the first item (the one starting "Create a
template…" / "Buat template…"), add:

- EN: `'Organise templates in the left panel: use Kelola to create or nest template groups, search by template name or group, and pick a group in the filter to narrow the list. Drag a template onto a group to move it.'`
- ID: `'Atur template di panel kiri: pakai Kelola untuk membuat atau menyusun grup template, cari lewat nama template atau grup, dan pilih grup di filter untuk menyempitkan daftar. Tarik template ke grup untuk memindahkannya.'`

---

## Task 6 — `src/lib/TemplateGroupManager.svelte` (new file)

Modelled on `LabelFilter.svelte` (overlay, `Escape`, focus trap, backdrop click).

```svelte
<script>
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { templateGroupOutline } from './templateGroups.js'

  let {
    groups = [],
    t,
    onCreate,
    onRename,
    onDelete,
    onReparent,
    onClose,
  } = $props()

  let dialogEl = $state(null)
  let newName = $state('')
  let newParentId = $state(null)
  let renameFor = $state(null)
  let renameText = $state('')
  let menuId = $state(null)
  let dragId = $state(null)
  let dropId = $state(null)

  let outline = $derived(templateGroupOutline(groups))

  $effect(() => {
    const prev = document.activeElement
    dialogEl?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab' && dialogEl) {
        const focusables = [
          ...dialogEl.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
          ),
        ]
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  })

  function startRename(group) {
    menuId = null
    renameFor = group.id
    renameText = group.name
    tick().then(() => dialogEl?.querySelector('.tgm-rename input')?.focus())
  }

  function commitRename() {
    const group = groups.find((g) => g.id === renameFor)
    const next = renameText.trim()
    renameFor = null
    if (group && next && next !== group.name) onRename?.(group.name, next)
  }

  function onDrop(targetId) {
    if (dragId && dragId !== targetId) onReparent?.(dragId, targetId || null)
    dragId = null
    dropId = null
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onBackdropClick}>
  <div
    class="modal-card modal-tgm"
    bind:this={dialogEl}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tgm-title"
  >
    <div class="modal-header">
      <div>
        <h2 id="tgm-title" class="modal-title">{t('templateGroupsTitle')}</h2>
        <p class="modal-desc">{t('templateGroupsDesc')}</p>
      </div>
      <button class="modal-close" type="button" onclick={onClose} aria-label={t('close')}>
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="modal-body">
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
          if (newName.trim()) onCreate?.(newName, newParentId)
          newName = ''
          newParentId = null
        }}
      >
        <input
          class="input"
          bind:value={newName}
          placeholder={t('templateGroupNamePlaceholder')}
          aria-label={t('newTemplateGroup')}
        />
        <button class="btn secondary sm" type="submit" disabled={!newName.trim()} aria-label={t('newTemplateGroup')}>
          <Icon name="plus" size={14} />
        </button>
      </form>

      <ul class="group-list" role="tree">
        <li>
          <button
            class="group-row"
            type="button"
            ondragover={(e) => { e.preventDefault(); dropId = '' }}
            ondrop={(e) => { e.preventDefault(); onDrop('') }}
          >
            <Icon name="folder" size={13} />
            <span class="group-name">{t('allGroups')}</span>
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
              <form class="group-add tgm-rename" onsubmit={(e) => { e.preventDefault(); commitRename() }}>
                <input class="input" bind:value={renameText} aria-label={t('renameTemplateGroup')} />
                <button class="btn secondary sm" type="submit">{t('done')}</button>
                <button class="btn ghost sm" type="button" onclick={() => (renameFor = null)}>{t('cancel')}</button>
              </form>
            {:else}
              <button class="group-row" type="button" onclick={() => (menuId = menuId === group.id ? null : group.id)}>
                <Icon name="folder" size={13} />
                <span class="group-name">{group.name}</span>
              </button>
              <button
                class="group-menu-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuId === group.id}
                aria-label={t('templateGroupsTitle') + ': ' + group.name}
                onclick={() => (menuId = menuId === group.id ? null : group.id)}
              >
                <Icon name="menu" size={13} />
              </button>
              {#if menuId === group.id}
                <div class="group-menu" role="menu">
                  <button type="button" role="menuitem" onclick={() => startRename(group)}>
                    <Icon name="edit" size={12} /><span>{t('renameTemplateGroup')}</span>
                  </button>
                  <button type="button" role="menuitem" onclick={() => { newParentId = group.id; menuId = null }}>
                    <Icon name="plus" size={12} /><span>{t('createTemplateSubgroup')}</span>
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
                  <button class="danger" type="button" role="menuitem" onclick={() => { onDelete?.(group.id); menuId = null }}>
                    <Icon name="trash" size={12} /><span>{t('deleteTemplateGroup')}</span>
                  </button>
                </div>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>

      {#if groups.length === 0}
        <p class="hint">{t('noTemplates')}</p>
      {/if}
      <p class="hint group-hint">{t('templateDragHint')}</p>
    </div>

    <div class="modal-actions">
      <button class="btn primary sm" type="button" onclick={onClose}>{t('close')}</button>
    </div>
  </div>
</div>
```

Reused classes (`group-add`, `group-add-hint`, `group-list`, `group-item`, `group-row`,
`group-menu-btn`, `group-menu`, `group-menu-field`, `group-name`, `group-hint`) already exist in
`src/styles.css` from the Contacts view. Only `.modal-tgm` and `.tgm-rename` need new CSS
(Task 8).

---

## Task 7 — `src/App.svelte` wiring

1. Imports. After the `groups.js` import block (line 19) add:

```js
  import {
    templateGroupOutline,
    templateGroupPath,
    templateGroupCounts,
    filterTemplates,
    createTemplateGroup,
    renameTemplateGroup,
    deleteTemplateGroup,
    setTemplateGroupParent,
    assignTemplateGroup,
  } from './lib/templateGroups.js'
```

   After the `ContactsView` import (line 24) add:

```js
  import TemplateGroupManager from './lib/TemplateGroupManager.svelte'
```

2. State — after `let undoTimer` (line 68) add:

```js
  let showTemplateManager = $state(false)
  let tplQuery = $state('')
  let tplGroupFilter = $state('')
  let tplOpen = $state({})
  let tplDragId = $state(null)
  let tplDropGroupId = $state(null)
```

3. `templateOptions` (line 87) — add the group path as `meta`:

```js
  let templateOptions = $derived(
    data.templates.map((tpl) => ({
      value: tpl.id,
      label: tpl.name || t('untitled'),
      meta: templateGroupPath(data.templateGroups, tpl.groupId),
    }))
  )
```

4. Derived — after `let filteredContacts = ...` (line 96) add:

```js
  let tplOutline = $derived(templateGroupOutline(data.templateGroups))
  let tplGroupCounts = $derived(templateGroupCounts(data.templateGroups, data.templates))
  let tplVisible = $derived(
    filterTemplates(data.templates, data.templateGroups, tplQuery, tplGroupFilter)
  )
  let tplVisibleUngrouped = $derived(tplVisible.filter((x) => !x.groupId))
  let tplVisibleGroupIds = $derived.by(() => {
    const byId = new Map(data.templateGroups.map((g) => [g.id, g]))
    const set = new Set()
    for (const tpl of tplVisible) {
      let cur = tpl.groupId ? byId.get(tpl.groupId) : null
      const seen = new Set()
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        set.add(cur.id)
        cur = cur.parentId ? byId.get(cur.parentId) : null
      }
    }
    return set
  })
  let tplFilterOptions = $derived([
    { value: '', label: t('allGroups') },
    ...tplOutline.map((g) => ({
      value: g.id,
      label: '— '.repeat(g.depth) + g.name,
      meta: String(tplGroupCounts.get(g.id) ?? 0),
    })),
    {
      value: '__none__',
      label: t('noGroup'),
      meta: String(data.templates.filter((x) => !x.groupId).length),
    },
  ])
  let tplAssignOptions = $derived([
    { value: '', label: t('noGroup') },
    ...tplOutline.map((g) => ({ value: g.id, label: '— '.repeat(g.depth) + g.name })),
  ])
```

5. Add a `templateGroups` boot safety net, after the existing `syncGroups` `$effect` (line 174):

```js
  $effect(() => {
    data.templateGroups ??= []
  })
```

6. Modal guards — add `showTemplateManager` to the "close emoji/menu" effect (line 185) and to the
   keydown guard (line 211), and to both open-modal guards (lines 713 and 729). Each list becomes
   `... || showTemplateManager || ...` (keep the lists otherwise intact).

7. Handlers — after `function reparentGroup(...)` (line ~1337, next to the other group handlers) add:

```js
  function newTemplateGroup(name, parentId = null) {
    createTemplateGroup(data.templateGroups, name, parentId)
  }

  function renameTemplateGroupName(from, to) {
    renameTemplateGroup(data.templateGroups, from, to)
  }

  function removeTemplateGroup(id) {
    const moved = deleteTemplateGroup(data.templateGroups, data.templates, id)
    if (tplGroupFilter === id) tplGroupFilter = ''
    if (moved) notify(t('templatesMoved', { n: moved }))
  }

  function reparentTemplateGroup(id, parentId) {
    setTemplateGroupParent(data.templateGroups, id, parentId)
  }

  function dropTemplateOnGroup(groupId) {
    if (tplDragId) {
      const moved = assignTemplateGroup(data.templates, [tplDragId], groupId || null)
      if (moved) notify(t('templatesMoved', { n: moved }))
    }
    tplDragId = null
    tplDropGroupId = null
  }

  function moveActiveToGroup(groupId) {
    if (active) assignTemplateGroup(data.templates, [active.id], groupId || null)
  }

  function tplGroupDepth(groupId) {
    const g = tplOutline.find((x) => x.id === groupId)
    return g ? g.depth + 1 : 0
  }
```

8. `newTemplate()` (line 283) — place the new template in the filtered group. Change the `tpl`
   object to include `groupId`:

```js
    const tpl = {
      id: store.uid('tpl'),
      name: '',
      body: '',
      vars: [],
      globals: {},
      auto: {},
      groupId: tplGroupFilter && tplGroupFilter !== '__none__' ? tplGroupFilter : null,
      createdAt: now,
      updatedAt: now,
    }
```

9. `doReplace()` (line 682) — after `labelUndo = null` add:

```js
    tplQuery = ''
    tplGroupFilter = ''
    tplOpen = {}
```

10. Declare the template-row snippet at the top of the markup, immediately before
    `<div class="page" ...>` (line 748):

```svelte
{#snippet tplRow(tpl)}
  <li
    class="tpl-item"
    class:active={tpl.id === activeId}
    style="--depth:{tplGroupDepth(tpl.groupId)}"
    draggable="true"
    ondragstart={() => (tplDragId = tpl.id)}
    ondragend={() => { tplDragId = null; tplDropGroupId = null }}
  >
    {#if confirmTplId === tpl.id}
      <div class="tpl-confirm" bind:this={confirmTplEl} role="group" aria-label={t('confirmDeleteTemplatePrompt')}>
        <span class="tpl-confirm-label">{t('confirmDeleteTemplatePrompt')}</span>
        <div class="tpl-confirm-actions">
          <button class="confirm-btn" type="button" onclick={() => (confirmTplId = null)}>
            {t('cancel')}
          </button>
          <button class="confirm-btn danger" type="button" onclick={() => confirmDeleteTemplate(tpl.id)}>
            {t('delete')}
          </button>
        </div>
      </div>
    {:else}
      <button class="tpl-name" type="button" onclick={() => selectTemplate(tpl.id, true)}>
        {tpl.name || t('untitled')}
      </button>
      <button
        class="tpl-del"
        type="button"
        title={t('delete')}
        aria-label={t('deleteTemplateAria', { name: tpl.name || t('untitled') })}
        onclick={() => (confirmTplId = tpl.id)}
      >
        <Icon name="x" size={14} />
      </button>
    {/if}
  </li>
{/snippet}
```

11. Sidebar replacement — replace the whole `<aside class="panel sidebar" ...> ... </aside>` block
    (lines 1023–1072) with:

```svelte
      <aside class="panel sidebar" aria-label={t('templates')}>
        <div class="panel-head">
          <h2>{t('templates')}</h2>
          <div class="sidebar-head-actions">
            <button
              class="btn icon-btn secondary sm"
              type="button"
              title={t('manageTemplates')}
              aria-label={t('manageTemplates')}
              onclick={() => (showTemplateManager = true)}
            >
              <Icon name="folder" size={14} />
            </button>
            <button
              class="btn sm {data.templates.length === 0 ? 'primary' : 'secondary'}"
              type="button"
              onclick={newTemplate}
            >
              <Icon name="plus" size={14} />
              <span>{t('newTemplate')}</span>
            </button>
          </div>
        </div>

        {#if data.templates.length === 0}
          <p class="muted small sidebar-empty">{t('noTemplatesDesc')}</p>
        {:else}
          <div class="tpl-tools">
            <div class="search-field">
              <span class="search-icon" aria-hidden="true"><Icon name="search" size={13} /></span>
              <input
                class="input search-input"
                type="search"
                placeholder={t('templateSearchPlaceholder')}
                aria-label={t('templateSearchPlaceholder')}
                bind:value={tplQuery}
              />
            </div>
            <Select
              size="sm"
              icon="folder"
              ariaLabel={t('filterByGroup')}
              value={tplGroupFilter}
              options={tplFilterOptions}
              onChange={(id) => (tplGroupFilter = id)}
            />
          </div>

          <ul class="tpl-tree">
            {#each tplOutline as group (group.id)}
              {#if tplVisibleGroupIds.has(group.id)}
                {@const open = tplQuery.trim() ? true : tplOpen[group.id] !== false}
                {@const kids = tplVisible.filter((x) => x.groupId === group.id)}
                {@const hasKids = tplOutline.some((d) => d.parentId === group.id)}
                <li
                  class="tpl-group"
                  class:drop={tplDropGroupId === group.id}
                  style="--depth:{group.depth}"
                  ondragover={(e) => { e.preventDefault(); tplDropGroupId = group.id }}
                  ondragleave={() => { if (tplDropGroupId === group.id) tplDropGroupId = null }}
                  ondrop={(e) => { e.preventDefault(); dropTemplateOnGroup(group.id) }}
                >
                  <div class="tpl-group-row">
                    {#if hasKids || kids.length}
                      <button
                        class="tpl-caret"
                        type="button"
                        aria-expanded={open}
                        aria-label={group.name}
                        onclick={() => (tplOpen[group.id] = !open)}
                      >
                        <Icon name="chevron-right" size={12} className={open ? 'rot-open' : ''} />
                      </button>
                    {:else}
                      <span class="tpl-caret-spacer" aria-hidden="true"></span>
                    {/if}
                    <Icon name="folder" size={12} />
                    <span class="tpl-group-name">{group.name}</span>
                    <span class="badge neutral sm tabular">{tplGroupCounts.get(group.id) ?? 0}</span>
                  </div>
                  {#if open}
                    {#each kids as tpl (tpl.id)}
                      {@render tplRow(tpl)}
                    {/each}
                  {/if}
                </li>
              {/if}
            {/each}

            {#if tplVisibleUngrouped.length}
              <li
                class="tpl-group tpl-ungrouped"
                class:drop={tplDropGroupId === '__none__'}
                ondragover={(e) => { e.preventDefault(); tplDropGroupId = '__none__' }}
                ondragleave={() => { if (tplDropGroupId === '__none__') tplDropGroupId = null }}
                ondrop={(e) => { e.preventDefault(); dropTemplateOnGroup('') }}
              >
                <div class="tpl-group-row">
                  <span class="tpl-caret-spacer" aria-hidden="true"></span>
                  <Icon name="file" size={12} />
                  <span class="tpl-group-name">{t('noGroup')}</span>
                  <span class="badge neutral sm tabular">{tplVisibleUngrouped.length}</span>
                </div>
                {#each tplVisibleUngrouped as tpl (tpl.id)}
                  {@render tplRow(tpl)}
                {/each}
              </li>
            {/if}
          </ul>

          {#if tplVisible.length === 0}
            <p class="muted small sidebar-empty">{t('noMatches')}</p>
          {/if}
        {/if}
      </aside>
```

12. Editor — after the template-name `</label>` (line 1312) add the group picker:

```svelte
        <label class="field">
          <span class="field-label">{t('templateGroupField')}</span>
          <Select
            size="sm"
            icon="folder"
            ariaLabel={t('templateGroupField')}
            value={active.groupId ?? ''}
            options={tplAssignOptions}
            onChange={(id) => moveActiveToGroup(id)}
          />
        </label>
```

13. Mobile menu — after the import-contacts item (line 943) add:

```svelte
        <button
          class="mobile-menu-item"
          type="button"
          onclick={() => {
            showMobileMenu = false
            showTemplateManager = true
          }}
        >
          <Icon name="folder" size={16} />
          <span>{t('manageTemplates')}</span>
        </button>
```

14. Render the manager modal — after the `{#if showAbout}` block (line 1527) add:

```svelte
{#if showTemplateManager}
  <TemplateGroupManager
    groups={data.templateGroups}
    {t}
    onCreate={newTemplateGroup}
    onRename={renameTemplateGroupName}
    onDelete={removeTemplateGroup}
    onReparent={reparentTemplateGroup}
    onClose={() => (showTemplateManager = false)}
  />
{/if}
```

---

## Task 8 — `src/styles.css`

Add a block after the existing `.tpl-confirm` rules (after line ~800, end of the sidebar template
styles):

```css
.sidebar-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tpl-tools {
  display: grid;
  gap: 6px;
  margin-bottom: 8px;
}

.tpl-tools .search-field {
  min-width: 0;
}

.tpl-tools .search-input {
  min-height: 30px;
  padding: 4px 10px 4px 30px;
  font-size: 12px;
}

.tpl-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 3px;
}

.tpl-group {
  display: grid;
  gap: 2px;
  border-radius: var(--radius-control);
  border: 1px solid transparent;
}

.tpl-group.drop {
  border-color: color-mix(in oklab, var(--accent) 55%, var(--border));
  background: var(--accent-subtle);
}

.tpl-group-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px 3px calc(4px + var(--depth, 0) * 12px);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.tpl-group-row:hover {
  background: var(--surface-muted);
}

.tpl-caret {
  display: grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.tpl-caret:hover {
  background: var(--surface-muted);
  color: var(--foreground);
}

.tpl-caret svg.rot-open {
  transform: rotate(90deg);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.tpl-caret-spacer {
  flex: none;
  width: 18px;
}

.tpl-group-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.tpl-tree .tpl-item {
  margin-left: calc(4px + var(--depth, 0) * 12px);
}

.tpl-ungrouped .tpl-group-name {
  color: var(--text-muted);
  font-weight: 400;
}

.modal-card.modal-tgm {
  width: min(100%, 460px);
  display: flex;
  flex-direction: column;
}

.tgm-rename {
  width: 100%;
}
```

Note: `.tpl-item` already has `display:flex; padding: 1px 4px 1px 9px;`; the new
`.tpl-tree .tpl-item { margin-left }` indents leaves under their group without changing the
existing rule.

---

## Task 9 — `docs/USAGE.md`

Add a new subsection after the "Grup dan subgrup kontak" section (after line 156), before
"## 5. Badge dan status":

```md
## Grup template

Template dapat dikelompokkan per grup dan subgrup (contoh: **Usaha Roti** → **Pemberitahuan** →
**Pengingat Pembayaran**).

1. Di panel **Template** (kolom kiri desktop, tab **Template** di HP) ada kotak **cari** (nama
   template atau nama grup) dan pilihan **filter grup** (Semua grup / salah satu grup / Tanpa grup).
   Memilih sebuah grup ikut menampilkan subgrupnya.
2. Klik **Kelola** (ikon folder di samping **Template baru**, atau item **Kelola template** di menu
   HP) untuk membuat, mengganti nama, menambah subgrup, memindah, atau menghapus grup. Hapus grup
   memindahkan template di dalamnya ke grup induk (subgrupnya naik satu tingkat); tidak ada template
   yang ikut terhapus.
3. Pindahkan template antar grup dengan **menarik** barisnya ke grup tujuan, atau lewat pilihan
   **Grup** di editor template.
4. **Template baru** dibuat di dalam grup yang sedang dipilih di filter.

Grup template ikut tersimpan di backup (Ekspor/Impor JSON), termasuk susunan subgrup.
```

Also update the "## 8. Export / Import" section: change `schemaVersion: 4` to `schemaVersion: 5`
(line 197) and add `templateGroups` to the list of exported data, and mention v1–v4 upgrade (line
200) adds `templateGroups: []` and `groupId: null`.

---

## Verification checklist (run per phase)

1. `npm run test` — all green.
2. `npm run build` — no Svelte warnings about the new snippet or props.
3. `npm run dev` manual pass:
   - Create groups and subgroups in **Kelola**; rename, reparent (drag and menu), delete a group
     with templates in it → templates land in the parent.
   - Type in the search box → list narrows by template name and by group name.
   - Pick a group in the filter → its templates and subgroups show; **Semua grup** restores.
   - Drag a template onto a group → it moves; the editor **Grup** select reflects it.
   - **Template baru** lands in the filtered group.
   - Export, then Import → Merge keeps groups and assignments; Replace all restores them.
   - Mobile: the **Template** tab shows search + filter + tree; the **Menu** has **Kelola template**.
   - Toggle EN/ID — every new string switches.
4. Commit each phase separately.
