import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, isValidPhone, buildWaUrl } from './wa.js'

test('normalizes local 08 numbers to 62', () => {
  assert.equal(normalizePhone('0896-9812-9722'), '6289698129722')
  assert.equal(normalizePhone('08 96 9812 9722'), '6289698129722')
})

test('normalizes +62 and 62 numbers', () => {
  assert.equal(normalizePhone('+62 896-9812-9722'), '6289698129722')
  assert.equal(normalizePhone('6289698129722'), '6289698129722')
})

test('rejects numbers that are not 62-prefixed or too short', () => {
  assert.equal(isValidPhone(normalizePhone('089698129722')), true)
  assert.equal(isValidPhone(normalizePhone('12345')), false)
  assert.equal(isValidPhone(normalizePhone('1234567890123456789')), false)
  assert.equal(isValidPhone(normalizePhone('')), false)
})

test('builds a WhatsApp link with encoded text', () => {
  assert.equal(
    buildWaUrl('6289698129722', '⏰ *Hi*\nline 2'),
    'https://api.whatsapp.com/send?phone=6289698129722&text=%E2%8F%B0%20*Hi*%0Aline%202'
  )
})
