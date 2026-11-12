import test from 'node:test'
import assert from 'node:assert/strict'
import { detectVariables, resolve, render, templateVarKeys, varLabel } from './vars.js'
import { formatAutoDate } from './dates.js'

const template = { id: 'tpl_1', globals: { invoice: 'GLOBAL-INV' } }
const contact = { name: 'FENDY', values: { tpl_1: { total: '55.161' } } }

test('detects variables in order without duplicates', () => {
  assert.deepEqual(detectVariables('Hello {{nama}}, total {{ total }} and {{nama}} / {{invoice}}'), [
    'nama',
    'total',
    'invoice',
  ])
  assert.deepEqual(detectVariables('no vars here'), [])
})

test('resolves contact value first, then contact name, then globals, then empty', () => {
  assert.equal(resolve('total', contact, template), '55.161')
  assert.equal(resolve('nama', contact, template), 'FENDY')
  assert.equal(resolve('invoice', contact, template), 'GLOBAL-INV')
  assert.equal(resolve('missing', contact, template), '')
})

test('renders body with fallbacks', () => {
  assert.equal(
    render('Hi {{nama}} / {{invoice}} / {{total}} / {{missing}}', contact, template),
    'Hi FENDY / GLOBAL-INV / 55.161 / '
  )
})

test('renders without a contact using globals only', () => {
  assert.equal(render('Hi {{nama}}! {{invoice}}', null, template), 'Hi ! GLOBAL-INV')
})

test('templateVarKeys unions declared vars and body variables', () => {
  const tpl = { body: 'Hi {{nama}} {{total}}', vars: [{ key: 'invoice', label: 'No. Invoice' }] }
  assert.deepEqual(templateVarKeys(tpl), ['invoice', 'nama', 'total'])
})

test('varLabel falls back to the key', () => {
  const tpl = { body: '', vars: [{ key: 'invoice', label: 'No. Invoice' }] }
  assert.equal(varLabel(tpl, 'invoice'), 'No. Invoice')
  assert.equal(varLabel(tpl, 'other'), 'other')
})

test('resolves and lists keys safely when template is null', () => {
  assert.equal(resolve('nama', contact, null), 'FENDY')
  assert.equal(resolve('total', contact, null), '')
  assert.deepEqual(templateVarKeys(null), [])
})

test('templateVarKeys ignores malformed declared vars and keeps body order stable', () => {
  const tpl = {
    body: 'Hi {{nama}}, {{b}} then {{a}} then {{b}}',
    vars: [null, { key: 'bad key!' }, { key: '' }, { key: 'c', label: 'C' }],
  }
  assert.deepEqual(templateVarKeys(tpl), ['c', 'nama', 'b', 'a'])
})

test('auto date beats the manual template default', () => {
  const tpl = { id: 'tpl_1', auto: { bulan: 'monthName' }, globals: { bulan: 'GLOBAL' } }
  assert.equal(resolve('bulan', contact, tpl), formatAutoDate('monthName'))
})

test('per-contact value beats the auto date', () => {
  const tpl = {
    id: 'tpl_1',
    auto: { total: 'monthName' },
    globals: { total: 'GLOBAL' },
  }
  assert.equal(resolve('total', contact, tpl), '55.161')
})

test('invalid auto preset falls through to the manual default', () => {
  const tpl = { id: 'tpl_1', auto: { bulan: 'nope' }, globals: { bulan: 'GLOBAL' } }
  assert.equal(resolve('bulan', contact, tpl), 'GLOBAL')
})

test('auto date works with no contact and no globals', () => {
  const tpl = { id: 'tpl_1', auto: { tahun: 'year' }, globals: {} }
  assert.equal(resolve('tahun', null, tpl), formatAutoDate('year'))
})

test('resolve and render respect explicit lang parameter for auto dates', () => {
  const tpl = { id: 'tpl_1', auto: { hari: 'dayName' }, globals: {} }
  assert.equal(resolve('hari', contact, tpl, 'id'), formatAutoDate('dayName', new Date(), 'id'))
  assert.equal(resolve('hari', contact, tpl, 'en'), formatAutoDate('dayName', new Date(), 'en'))
  assert.equal(render('Hari {{hari}}', contact, tpl, 'en'), 'Hari ' + formatAutoDate('dayName', new Date(), 'en'))
})
