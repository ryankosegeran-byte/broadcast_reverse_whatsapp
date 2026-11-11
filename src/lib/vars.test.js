import test from 'node:test'
import assert from 'node:assert/strict'
import { detectVariables, resolve, render } from './vars.js'

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
