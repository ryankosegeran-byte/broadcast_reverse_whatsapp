export const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g

export function detectVariables(body) {
  const out = []
  for (const match of String(body ?? '').matchAll(VAR_RE)) {
    if (!out.includes(match[1])) out.push(match[1])
  }
  return out
}

/** First non-empty wins: per-contact value, contact name (for `nama`), template globals. */
export function resolve(key, contact, template) {
  const own = template?.id ? contact?.values?.[template.id]?.[key] : undefined
  if (own !== undefined && own !== null && own !== '') return String(own)
  if (key === 'nama' && contact?.name) return contact.name
  const global = template?.globals?.[key]
  if (global !== undefined && global !== null && global !== '') return String(global)
  return ''
}

export function render(body, contact, template) {
  return String(body ?? '').replace(VAR_RE, (_, key) => resolve(key, contact, template))
}

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
