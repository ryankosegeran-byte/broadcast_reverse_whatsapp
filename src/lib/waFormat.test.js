import test from 'node:test'
import assert from 'node:assert/strict'
import { wrapMarker, tokenizeWaLine } from './waFormat.js'

test('wrapMarker wraps selection and places caret cleanly on empty selection', () => {
  const wrapped = wrapMarker('Halo Budi', 5, 9, '*')
  assert.equal(wrapped.text, 'Halo *Budi*')
  assert.equal(wrapped.start, 6)
  assert.equal(wrapped.end, 10)

  const unwrapped = wrapMarker('Halo *Budi*', 5, 11, '*')
  assert.equal(unwrapped.text, 'Halo Budi')
  assert.equal(unwrapped.start, 5)
  assert.equal(unwrapped.end, 9)

  const empty = wrapMarker('Halo ', 5, 5, '_')
  assert.equal(empty.text, 'Halo __')
  assert.equal(empty.start, 6)
  assert.equal(empty.end, 6)
})

test('tokenizeWaLine parses WhatsApp formatting and links safely', () => {
  const tokens = tokenizeWaLine('Halo *Budi*, _tagihan_ ~lama~ `INV-1` di https://pay.test/')
  assert.deepEqual(tokens, [
    { type: 'text', value: 'Halo ' },
    { type: 'bold', value: 'Budi' },
    { type: 'text', value: ', ' },
    { type: 'italic', value: 'tagihan' },
    { type: 'text', value: ' ' },
    { type: 'strike', value: 'lama' },
    { type: 'text', value: ' ' },
    { type: 'mono', value: 'INV-1' },
    { type: 'text', value: ' di ' },
    { type: 'link', value: 'https://pay.test/' },
  ])
})
