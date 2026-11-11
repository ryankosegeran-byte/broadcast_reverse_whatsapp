import { normalizePhone, isValidPhone } from './wa.js'

export const SCHEMA_VERSION = 1
export const DATA_KEY = 'wa-broadcast:v1'
export const LANG_KEY = 'wa-broadcast:lang'
export const CORRUPT_KEY = 'wa-broadcast:v1:corrupt'

export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString(), templates: [], contacts: [] }
}

export function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10)
}

/** Fill in fields added by later versions so old backups and old storage stay usable. */
export function migrate(raw) {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    contacts: Array.isArray(raw?.contacts) ? raw.contacts : [],
  }

  state.templates = state.templates
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      id: typeof t.id === 'string' && t.id ? t.id : uid('tpl'),
      name: String(t.name ?? ''),
      body: String(t.body ?? ''),
      globals: t.globals && typeof t.globals === 'object' ? { ...t.globals } : {},
      createdAt: t.createdAt ?? new Date().toISOString(),
      updatedAt: t.updatedAt ?? new Date().toISOString(),
    }))

  state.contacts = state.contacts
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      id: typeof c.id === 'string' && c.id ? c.id : uid('c'),
      phone: normalizePhone(c.phone),
      name: String(c.name ?? ''),
      values: c.values && typeof c.values === 'object' ? c.values : {},
      sentAt: c.sentAt && typeof c.sentAt === 'object' ? c.sentAt : {},
    }))
    .filter((c) => isValidPhone(c.phone))

  return state
}

let saveTimer
let onSaveError = null

/** Register the UI callback for quota / write failures. */
export function setSaveErrorHandler(fn) {
  onSaveError = fn
}

export function loadState() {
  let raw = null
  try {
    raw = localStorage.getItem(DATA_KEY)
  } catch {
    return { state: emptyState(), warning: 'storage' }
  }
  if (!raw) return { state: emptyState(), warning: null }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('bad shape')
    if (!Array.isArray(parsed.templates) || !Array.isArray(parsed.contacts)) throw new Error('bad shape')
    if (Number(parsed.schemaVersion ?? 1) > SCHEMA_VERSION) {
      return { state: emptyState(), warning: 'newer' }
    }
    return { state: migrate(parsed), warning: null }
  } catch {
    try {
      localStorage.setItem(CORRUPT_KEY, raw)
    } catch {
      /* best effort */
    }
    return { state: emptyState(), warning: 'corrupt' }
  }
}

export function scheduleSave(state) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveNow(state), 200)
}

export function saveNow(state) {
  clearTimeout(saveTimer)
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }))
  } catch {
    onSaveError?.()
  }
}

/** Validate a whole state object. Returns { ok, error, data, counts }. */
export function validateState(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'shape' }
  if (!Array.isArray(raw.templates) || !Array.isArray(raw.contacts)) return { ok: false, error: 'shape' }
  if (Number(raw.schemaVersion ?? 1) > SCHEMA_VERSION) return { ok: false, error: 'newer' }
  for (const c of raw.contacts) {
    if (!isValidPhone(normalizePhone(c?.phone))) return { ok: false, error: 'phone' }
  }
  const data = migrate(raw)
  return { ok: true, data, counts: { templates: data.templates.length, contacts: data.contacts.length } }
}

export function mergeStates(local, incoming) {
  const byId = new Map(local.templates.map((t) => [t.id, t]))
  const byName = new Map(local.templates.map((t) => [t.name.trim().toLowerCase(), t]))
  for (const t of incoming.templates) {
    const nameKey = t.name.trim().toLowerCase()
    if (byId.has(t.id) || (nameKey && byName.has(nameKey))) continue
    local.templates.push(t)
    byId.set(t.id, t)
    if (nameKey) byName.set(nameKey, t)
  }

  for (const t of local.templates) {
    const source = incoming.templates.find((x) => x.id === t.id)
    if (!source) continue
    for (const [key, value] of Object.entries(source.globals ?? {})) {
      if (!t.globals[key]) t.globals[key] = value
    }
  }

  const byPhone = new Map(local.contacts.map((c) => [c.phone, c]))
  for (const c of incoming.contacts) {
    const existing = byPhone.get(c.phone)
    if (!existing) {
      local.contacts.push(c)
      byPhone.set(c.phone, c)
      continue
    }
    if (!existing.name && c.name) existing.name = c.name
    for (const [templateId, values] of Object.entries(c.values ?? {})) {
      existing.values[templateId] ??= {}
      for (const [key, value] of Object.entries(values ?? {})) {
        if (!existing.values[templateId][key]) existing.values[templateId][key] = value
      }
    }
    for (const [templateId, when] of Object.entries(c.sentAt ?? {})) {
      if (!existing.sentAt[templateId] || existing.sentAt[templateId] < when) {
        existing.sentAt[templateId] = when
      }
    }
  }

  local.updatedAt = new Date().toISOString()
  return local
}

export function downloadExport(state) {
  const json = JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wa-broadcast-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
