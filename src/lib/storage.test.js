import test from 'node:test'
import assert from 'node:assert/strict'
import { migrate, mergeStates, emptyState } from './storage.js'

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
