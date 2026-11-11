import test from 'node:test'
import assert from 'node:assert/strict'
import { migrate, mergeStates, emptyState, validateState } from './storage.js'

test('migrate fills missing fields and drops invalid phones', () => {
  const state = migrate({
    templates: [{ name: 'A', body: 'x' }],
    contacts: [
      { phone: '0896-9812-9722', name: 'Budi' },
      { phone: '123', name: 'Bad' },
    ],
  })
  assert.equal(state.templates.length, 1)
  assert.ok(state.templates[0].id)
  assert.deepEqual(state.templates[0].globals, {})
  assert.equal(state.contacts.length, 1)
  assert.equal(state.contacts[0].phone, '6289698129722')
  assert.deepEqual(state.contacts[0].values, {})
})

test('merge adds new templates and keeps local ones on id/name clash', () => {
  const local = emptyState()
  local.templates.push({ id: 't1', name: 'Bills', body: 'a', globals: {} })
  const incoming = emptyState()
  incoming.templates.push({ id: 't1', name: 'Bills renamed', body: 'b', globals: {} })
  incoming.templates.push({ id: 't2', name: 'Bills', body: 'c', globals: {} })
  incoming.templates.push({ id: 't3', name: 'Promo', body: 'd', globals: {} })

  mergeStates(local, incoming)

  assert.equal(local.templates.length, 2)
  assert.equal(local.templates[0].body, 'a')
  assert.equal(local.templates[1].id, 't3')
})

test('merge keeps local contact data and fills only blanks', () => {
  const local = emptyState()
  local.contacts.push({
    id: 'c1',
    phone: '628111',
    name: 'Local Name',
    values: { t1: { invoice: 'LOCAL' } },
    sentAt: { t1: '2026-01-01T00:00:00.000Z' },
  })
  const incoming = emptyState()
  incoming.contacts.push({
    id: 'c9',
    phone: '628111',
    name: 'File Name',
    values: { t1: { invoice: 'FILE', total: '10' } },
    sentAt: { t1: '2026-05-05T00:00:00.000Z' },
  })

  mergeStates(local, incoming)

  assert.equal(local.contacts.length, 1)
  assert.equal(local.contacts[0].name, 'Local Name')
  assert.equal(local.contacts[0].values.t1.invoice, 'LOCAL')
  assert.equal(local.contacts[0].values.t1.total, '10')
  assert.equal(local.contacts[0].sentAt.t1, '2026-05-05T00:00:00.000Z')
})

test('migrate upgrades v1 to v2 with labels and vars', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '{{x}}' }],
    contacts: [{ phone: '62811111', name: 'Budi' }],
  })
  assert.equal(state.schemaVersion, 2)
  assert.deepEqual(state.templates[0].vars, [])
  assert.deepEqual(state.contacts[0].labels, [])
})

test('migrate normalises labels and validates vars', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '', vars: [{ key: 'x', label: 'X' }, { key: 'x', label: 'dup' }, { key: '!' }] }],
    contacts: [{ phone: '62811111', name: '', labels: [' VIP ', 'VIP', ''] }],
  })
  assert.deepEqual(state.templates[0].vars, [{ key: 'x', label: 'X' }])
  assert.deepEqual(state.contacts[0].labels, ['VIP'])
})

test('mergeStates merges template vars and unions contact labels', () => {
  const local = emptyState()
  local.templates.push({ id: 't1', name: 'Bills', body: '', vars: [{ key: 'x', label: '' }], globals: {} })
  local.contacts.push({ id: 'c1', phone: '628111', name: 'A', labels: ['VIP'], values: {}, sentAt: {} })
  const incoming = emptyState()
  incoming.templates.push({
    id: 't1',
    name: 'Bills',
    body: '',
    vars: [{ key: 'x', label: 'Amount' }, { key: 'y', label: 'Note' }],
    globals: {},
  })
  incoming.contacts.push({ id: 'c9', phone: '628111', name: '', labels: ['VIP', 'Lama'], values: {}, sentAt: {} })

  mergeStates(local, incoming)

  assert.deepEqual(local.templates[0].vars, [{ key: 'x', label: 'Amount' }, { key: 'y', label: 'Note' }])
  assert.deepEqual(local.contacts[0].labels, ['VIP', 'Lama'])
})

test('validateState returns template, contact, and unique label counts for v1 and v2', () => {
  const v1 = validateState({
    templates: [{ id: 't1', name: 'A', body: '{{x}}' }],
    contacts: [{ phone: '0811111111', name: 'Budi' }],
  })
  assert.equal(v1.ok, true)
  assert.equal(v1.data.schemaVersion, 2)
  assert.deepEqual(v1.counts, { templates: 1, contacts: 1, labels: 0 })

  const v2 = validateState({
    schemaVersion: 2,
    templates: [{ id: 't1', name: 'A', body: '{{x}}', vars: [{ key: 'x', label: 'Amount' }], globals: { x: '10' } }],
    contacts: [
      { phone: '6281111111', name: 'A', labels: ['VIP', 'Jatuh Tempo'] },
      { phone: '6282222222', name: 'B', labels: ['VIP'] },
    ],
  })
  assert.equal(v2.ok, true)
  assert.deepEqual(v2.counts, { templates: 1, contacts: 2, labels: 2 })
})
