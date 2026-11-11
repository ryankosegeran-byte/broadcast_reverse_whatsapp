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
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Auto-detect the delimiter from the first line. */
export function parseCsv(text) {
  const first = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return parseDelimited(text, counts[0][1] > 0 ? counts[0][0] : ',')
}

/** Parse a vCard file: one entry per vCard, first TEL + FN (fallback N). */
export function parseVcf(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const unfolded = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1)
    else unfolded.push(line)
  }
  const out = []
  let cur = null
  for (const raw of unfolded) {
    const line = raw.trim()
    if (/^BEGIN:VCARD$/i.test(line)) {
      cur = { phone: '', fn: '', n: '' }
      continue
    }
    if (/^END:VCARD$/i.test(line)) {
      if (cur?.phone) out.push({ phone: cur.phone, name: cur.fn || cur.n })
      cur = null
      continue
    }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).split(';')[0].split('.').pop().toUpperCase()
    const value = line.slice(idx + 1).trim()
    if (!value) continue
    if (key === 'TEL' && !cur.phone) cur.phone = value
    else if (key === 'FN' && !cur.fn) cur.fn = value.replace(/;/g, ' ').trim()
    else if (key === 'N' && !cur.n) cur.n = value.replace(/;/g, ' ').replace(/\s+/g, ' ').trim()
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
    const at = cells.findIndex(
      (c, i) =>
        c === norm(key) &&
        i !== map.phone &&
        i !== map.name &&
        i !== map.label &&
        !Object.values(map.vars).includes(i)
    )
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
    existing.values ??= {}
    for (const [tid, values] of Object.entries(c.values ?? {})) {
      if (!values || typeof values !== 'object') continue
      existing.values[tid] ??= {}
      for (const [k, v] of Object.entries(values)) {
        if (!existing.values[tid][k]) existing.values[tid][k] = v
      }
    }
    existing.sentAt ??= {}
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
