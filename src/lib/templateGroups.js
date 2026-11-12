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
