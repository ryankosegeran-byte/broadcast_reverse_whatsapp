/**
 * Wrap selected text (or insert empty pair) with WhatsApp formatting markers:
 * *bold*, _italic_, ~strike~, `mono`.
 */
export function wrapMarker(text, start, end, marker) {
  const src = String(text ?? '')
  const s = Math.max(0, Math.min(start ?? src.length, src.length))
  const e = Math.max(s, Math.min(end ?? s, src.length))
  const selected = src.slice(s, e)

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    const inner = selected.slice(marker.length, selected.length - marker.length)
    return {
      text: src.slice(0, s) + inner + src.slice(e),
      start: s,
      end: s + inner.length,
    }
  }

  const next = src.slice(0, s) + marker + selected + marker + src.slice(e)
  if (selected.length === 0) {
    return {
      text: next,
      start: s + marker.length,
      end: s + marker.length,
    }
  }
  return {
    text: next,
    start: s + marker.length,
    end: e + marker.length,
  }
}

const TOKEN_RE = /(https?:\/\/[^\s<]+)|(\*[^\n*]+\*)|(_[^\n_]+_)|(~[^\n~]+~)|(`[^\n`]+`)/g

/**
 * Parse a single line of WhatsApp text into safe renderable segments without HTML injection.
 * @returns {Array<{ type: 'text'|'link'|'bold'|'italic'|'strike'|'mono', value: string }>}
 */
export function tokenizeWaLine(line) {
  const src = String(line ?? '')
  const out = []
  let cursor = 0

  for (const match of src.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0
    if (idx > cursor) {
      out.push({ type: 'text', value: src.slice(cursor, idx) })
    }
    if (match[1]) {
      out.push({ type: 'link', value: match[1] })
    } else if (match[2]) {
      out.push({ type: 'bold', value: match[2].slice(1, -1) })
    } else if (match[3]) {
      out.push({ type: 'italic', value: match[3].slice(1, -1) })
    } else if (match[4]) {
      out.push({ type: 'strike', value: match[4].slice(1, -1) })
    } else if (match[5]) {
      out.push({ type: 'mono', value: match[5].slice(1, -1) })
    }
    cursor = idx + match[0].length
  }

  if (cursor < src.length) {
    out.push({ type: 'text', value: src.slice(cursor) })
  }
  return out
}
