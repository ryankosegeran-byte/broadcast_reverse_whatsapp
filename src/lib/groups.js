/** Contact-group registry helpers. Pure: no DOM, no storage import. */

const clean = (s) => String(s ?? '').trim()

function gid() {
  return 'grp_' + Math.random().toString(36).slice(2, 10)
}

/** Normalise raw registry rows: string names, unique, valid parent, no cycles. */
export function normalizeGroups(raw) {
  const rows = []
  const seen = new Set()
  const seenIds = new Set()
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!g || typeof g !== 'object') continue
    const name = clean(g.name)
    if (!name || seen.has(name)) continue
    seen.add(name)
    let id = typeof g.id === 'string' && g.id ? g.id : gid()
    while (seenIds.has(id)) id = gid()
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

/** Ensure every label used by a contact has a registry row (top-level). Returns `groups`. */
export function syncGroups(groups, contacts) {
  const known = new Set(groups.map((g) => g.name))
  const ids = new Set(groups.map((g) => g.id))
  for (const c of contacts ?? []) {
    for (const label of c.labels ?? []) {
      const name = clean(label)
      if (!name || known.has(name)) continue
      known.add(name)
      let id = gid()
      while (ids.has(id)) id = gid()
      ids.add(id)
      groups.push({ id, name, parentId: null })
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
  const validParent = parentId && groups.some((g) => g.id === parentId) ? parentId : null
  let id = gid()
  const ids = new Set(groups.map((g) => g.id))
  while (ids.has(id)) id = gid()
  const row = { id, name: cleanName, parentId: validParent }
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

/**
 * Restore the parent-implies-child invariant: every contact in a group also carries that group's
 * ancestor names. Call after a hierarchy change (reparent) so filtering/counting by a parent still
 * finds subgroup members. Additive only: never strips labels, so it cannot lose user data.
 * ponytail: does not remove now-stale ancestor labels on un-nest; add if un-nesting should prune.
 */
export function backfillHierarchy(groups, contacts) {
  const byName = new Map(groups.map((g) => [g.name, g]))
  let changed = 0
  for (const c of contacts ?? []) {
    const own = c.labels ?? []
    const next = [...own]
    for (const label of own) {
      const g = byName.get(label)
      if (!g) continue
      for (const ancestor of groupAncestors(groups, g.id)) {
        if (!next.includes(ancestor)) next.push(ancestor)
      }
    }
    if (next.length !== own.length) {
      c.labels = next
      changed++
    }
  }
  return changed
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
  if (groups.some((x) => x.name === newName)) return 0
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

/** Deterministic 0..359 HSL hue for a label name. */
export function labelHue(name) {
  const s = String(name ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

/** Build label filter items with contact counts, hue, and parent breadcrumb path. */
export function buildLabelOptions(labelPool, contacts = [], groups = []) {
  const counts = new Map()
  for (const c of contacts ?? []) {
    for (const raw of new Set(c.labels ?? [])) {
      const name = clean(raw)
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  const byName = new Map((groups ?? []).map((g) => [g.name, g]))
  return (labelPool ?? []).map((name) => {
    const g = byName.get(name)
    const parentPath = g ? groupAncestors(groups, g.id).reverse().join(' › ') : ''
    return {
      name,
      count: counts.get(name) ?? 0,
      hue: labelHue(name),
      parentPath,
    }
  })
}

/** Filter and rank label options by name (prefix first, then substring) or parent path. */
export function filterLabelOptions(options, query) {
  const q = clean(query).toLowerCase()
  if (!q) return options ?? []
  const hits = []
  for (const opt of options ?? []) {
    const nameLower = opt.name.toLowerCase()
    const idx = nameLower.indexOf(q)
    if (idx === 0) hits.push({ opt, rank: 0 })
    else if (idx > 0) hits.push({ opt, rank: 1 })
    else if (opt.parentPath && opt.parentPath.toLowerCase().includes(q)) hits.push({ opt, rank: 2 })
  }
  hits.sort((a, b) => a.rank - b.rank)
  return hits.map((h) => h.opt)
}

/** Split `text` into matched / unmatched segments for safe highlight rendering. */
export function highlightText(text, query) {
  const src = String(text ?? '')
  if (!src) return []
  const q = clean(query).toLowerCase()
  if (!q) return [{ text: src, match: false }]
  const lower = src.toLowerCase()
  const out = []
  let pos = 0
  while (pos < src.length) {
    const idx = lower.indexOf(q, pos)
    if (idx < 0) {
      out.push({ text: src.slice(pos), match: false })
      break
    }
    if (idx > pos) out.push({ text: src.slice(pos, idx), match: false })
    out.push({ text: src.slice(idx, idx + q.length), match: true })
    pos = idx + q.length
  }
  return out
}
