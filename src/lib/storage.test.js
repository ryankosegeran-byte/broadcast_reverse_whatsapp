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

test('migrate upgrades v1 to v4 with labels, vars, auto, and groups', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '{{x}}' }],
    contacts: [{ phone: '62811111', name: 'Budi' }],
  })
  assert.equal(state.schemaVersion, 4)
  assert.deepEqual(state.templates[0].vars, [])
  assert.deepEqual(state.templates[0].auto, {})
  assert.deepEqual(state.contacts[0].labels, [])
  assert.deepEqual(state.groups, [])
})

test('migrate normalises labels and validates vars', () => {
  const state = migrate({
    templates: [{ name: 'A', body: '', vars: [{ key: 'x', label: 'X' }, { key: 'x', label: 'dup' }, { key: '!' }] }],
    contacts: [{ phone: '62811111', name: '', labels: [' VIP ', 'VIP', ''] }],
  })
  assert.deepEqual(state.templates[0].vars, [{ key: 'x', label: 'X' }])
  assert.deepEqual(state.contacts[0].labels, ['VIP'])
  assert.deepEqual(state.groups.map((g) => g.name), ['VIP'])
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
  assert.equal(v1.data.schemaVersion, 4)
  assert.deepEqual(v1.counts, { templates: 1, contacts: 1, labels: 0, groups: 0 })

  const v2 = validateState({
    schemaVersion: 2,
    templates: [{ id: 't1', name: 'A', body: '{{x}}', vars: [{ key: 'x', label: 'Amount' }], globals: { x: '10' } }],
    contacts: [
      { phone: '6281111111', name: 'A', labels: ['VIP', 'Jatuh Tempo'] },
      { phone: '6282222222', name: 'B', labels: ['VIP'] },
    ],
  })
  assert.equal(v2.ok, true)
  assert.equal(v2.data.schemaVersion, 4)
  assert.deepEqual(v2.counts, { templates: 1, contacts: 2, labels: 2, groups: 2 })
})

test('migrate keeps valid auto presets and drops invalid ones', () => {
  const state = migrate({
    templates: [
      {
        name: 'A',
        body: '{{bulan}} {{tahun}}',
        auto: { bulan: 'monthName', tahun: 'nope', 'bad key!': 'year' },
      },
    ],
    contacts: [],
  })
  assert.deepEqual(state.templates[0].auto, { bulan: 'monthName' })
})

test('mergeStates fills missing auto entries and keeps local ones', () => {
  const local = emptyState()
  local.templates.push({
    id: 't1',
    name: 'Bills',
    body: '',
    vars: [],
    globals: {},
    auto: { bulan: 'monthNum' },
  })
  const incoming = emptyState()
  incoming.templates.push({
    id: 't1',
    name: 'Bills',
    body: '',
    vars: [],
    globals: {},
    auto: { bulan: 'monthName', tahun: 'year' },
  })

  mergeStates(local, incoming)

  assert.deepEqual(local.templates[0].auto, { bulan: 'monthNum', tahun: 'year' })
})

test('migrate derives a top-level group per label', () => {
  const state = migrate({
    contacts: [
      { phone: '6281111111', name: 'A', labels: ['Kue', 'Agape'] },
      { phone: '6282222222', name: 'B', labels: ['Kue'] },
    ],
  })
  assert.deepEqual(state.groups.map((g) => g.name).sort(), ['Agape', 'Kue'])
  assert.ok(state.groups.every((g) => g.parentId === null))
})

test('mergeStates unions groups and keeps local parents', () => {
  const local = emptyState()
  local.groups.push({ id: 'k', name: 'Kue', parentId: null })
  local.contacts.push({ id: 'c1', phone: '628111', name: '', labels: ['Agape'], values: {}, sentAt: {} })
  const incoming = emptyState()
  incoming.groups.push({ id: 'a', name: 'Agape', parentId: 'k' })
  incoming.groups.push({ id: 'b', name: 'Bolu', parentId: null })

  mergeStates(local, incoming)

  const names = local.groups.map((g) => g.name)
  assert.ok(names.includes('Agape'))
  assert.ok(names.includes('Bolu'))
  assert.equal(local.groups.find((g) => g.name === 'Agape').parentId, 'k')
})

test('mergeStates remaps incoming subgroup parentId onto local group id on name clash', () => {
  const local = emptyState()
  local.groups.push({ id: 'k_local', name: 'Kue', parentId: null })
  const incoming = emptyState()
  incoming.groups.push({ id: 'a_remote', name: 'Agape', parentId: 'k_remote' })
  incoming.groups.push({ id: 'k_remote', name: 'Kue', parentId: null })

  mergeStates(local, incoming)

  assert.equal(local.groups.filter((g) => g.name === 'Kue').length, 1)
  assert.equal(local.groups.find((g) => g.name === 'Agape').parentId, 'k_local')
})
