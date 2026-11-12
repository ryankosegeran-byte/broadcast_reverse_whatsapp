import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_PRESETS, formatAutoDate, isAutoPreset } from './dates.js'

const day = new Date(2026, 10, 12) // 12 November 2026, a Thursday

test('formats every preset in Indonesian', () => {
  assert.equal(formatAutoDate('dateMonthYear', day, 'id'), '12 November 2026')
  assert.equal(formatAutoDate('monthName', day, 'id'), 'November')
  assert.equal(formatAutoDate('year', day, 'id'), '2026')
  assert.equal(formatAutoDate('monthNum', day, 'id'), '11')
  assert.equal(formatAutoDate('monthYear', day, 'id'), '11/2026')
  assert.equal(formatAutoDate('dayName', day, 'id'), 'Kamis')
  assert.equal(formatAutoDate('numericDate', day, 'id'), '12/11/2026')
})

test('formats names in English', () => {
  assert.equal(formatAutoDate('monthName', day, 'en'), 'November')
  assert.equal(formatAutoDate('dayName', day, 'en'), 'Thursday')
  assert.equal(formatAutoDate('dateMonthYear', day, 'en'), 'November 12, 2026')
})

test('numeric presets stay zero-padded and locale-independent', () => {
  const jan = new Date(2026, 0, 5)
  assert.equal(formatAutoDate('monthNum', jan, 'en'), '01')
  assert.equal(formatAutoDate('monthYear', jan, 'en'), '01/2026')
  assert.equal(formatAutoDate('numericDate', jan, 'en'), '05/01/2026')
})

test('unknown presets are rejected', () => {
  assert.equal(formatAutoDate('nope', day, 'id'), '')
  assert.equal(formatAutoDate(undefined, day, 'id'), '')
  assert.equal(isAutoPreset('monthName'), true)
  assert.equal(isAutoPreset('nope'), false)
  assert.equal(AUTO_PRESETS.length, 7)
})
