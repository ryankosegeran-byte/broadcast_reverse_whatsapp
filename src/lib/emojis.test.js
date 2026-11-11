import test from 'node:test'
import assert from 'node:assert/strict'
import { filterEmojis, pushRecentEmoji } from './emojis.js'

test('filterEmojis finds emojis by English and Indonesian keywords', () => {
  const idHits = filterEmojis('tagihan').map((e) => e.char)
  assert.ok(idHits.includes('🧾'))
  assert.ok(idHits.includes('💰'))

  const enHits = filterEmojis('alarm').map((e) => e.char)
  assert.ok(enHits.includes('⏰'))
})

test('pushRecentEmoji moves chosen emoji to front without duplicates', () => {
  const next = pushRecentEmoji(['👋', '🙏', '⏰'], '⏰')
  assert.deepEqual(next, ['⏰', '👋', '🙏'])

  const added = pushRecentEmoji(next, '🔥')
  assert.equal(added[0], '🔥')
  assert.equal(added.length, 4)
})
