import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeGroups, syncGroups, createGroup, groupAncestors, labelsForGroup, expandLabels,
  groupOutline, isDescendant, setGroupParent, renameLabel, deleteLabel, assignLabels,
  filterByLabels, splitBySent,
} from './groups.js'

test('normalizeGroups trims, dedupes, and assigns ids', () => {
  const rows = normalizeGroups([
    { name: ' Kue ' },
    { name: 'Kue' },
    { name: '' },
    { name: 'Agape', parentId: 'Kue' },
  ])
  assert.equal(rows.length, 2)
  assert.ok(rows[0].id)
  assert.equal(rows[1].parentId, rows[0].id) // parent matched by name
})

test('normalizeGroups drops cycles and self-parents', () => {
  const rows = normalizeGroups([
    { id: 'a', name: 'A', parentId: 'b' },
    { id: 'b', name: 'B', parentId: 'a' },
    { id: 'c', name: 'C', parentId: 'c' },
  ])
  const byId = Object.fromEntries(rows.map((g) => [g.id, g]))
  assert.equal(byId.c.parentId, null)
  assert.ok(byId.a.parentId === null || byId.b.parentId === null)
})

test('syncGroups adds a top-level row per unknown label', () => {
  const groups = normalizeGroups([{ name: 'Kue' }])
  syncGroups(groups, [{ labels: ['Kue', 'Agape'] }, { labels: ['Agape'] }])
  assert.deepEqual(groups.map((g) => g.name), ['Kue', 'Agape'])
  assert.equal(groups[1].parentId, null)
})

test('groupOutline lists parents A-Z then indented children', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'b', name: 'Bolu' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  assert.deepEqual(
    groupOutline(groups).map((g) => [g.name, g.depth]),
    [['Bolu', 0], ['Kue', 0], ['Agape', 1]]
  )
})

test('ancestors, labelsForGroup, and expandLabels follow the chain', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
    { id: 'b', name: 'Blok B', parentId: 'a' },
  ])
  assert.deepEqual(groupAncestors(groups, 'b'), ['Agape', 'Kue'])
  assert.deepEqual(labelsForGroup(groups, 'b'), ['Blok B', 'Agape', 'Kue'])
  assert.deepEqual(expandLabels(groups, ['Blok B', 'Lain']), ['Blok B', 'Agape', 'Kue', 'Lain'])
})

test('setGroupParent rejects self and descendant parents', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  assert.equal(isDescendant(groups, 'k', 'a'), true)
  assert.equal(setGroupParent(groups, 'k', 'k'), false)
  assert.equal(setGroupParent(groups, 'k', 'a'), false)
  assert.equal(setGroupParent(groups, 'a', null), true)
  assert.equal(groups.find((g) => g.id === 'a').parentId, null)
})

test('renameLabel rewrites the registry and the contacts and rejects name clashes', () => {
  const groups = normalizeGroups([{ id: 'k', name: 'Kue' }, { id: 'b', name: 'Bolu' }])
  const contacts = [{ id: 'c1', labels: ['Kue', 'Agape'] }, { id: 'c2', labels: ['Lain'] }]
  assert.equal(renameLabel(groups, contacts, 'Kue', 'Bolu'), 0)
  assert.equal(groups[0].name, 'Kue')
  assert.equal(renameLabel(groups, contacts, 'Kue', 'Kue Kering'), 1)
  assert.equal(groups[0].name, 'Kue Kering')
  assert.deepEqual(contacts[0].labels, ['Kue Kering', 'Agape'])
  assert.deepEqual(contacts[1].labels, ['Lain'])
})

test('deleteLabel strips the label and promotes children', () => {
  const groups = normalizeGroups([
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  const contacts = [{ id: 'c1', labels: ['Kue', 'Agape'] }]
  assert.equal(deleteLabel(groups, contacts, 'Kue'), 1)
  assert.deepEqual(groups.map((g) => g.name), ['Agape'])
  assert.equal(groups[0].parentId, null)
  assert.deepEqual(contacts[0].labels, ['Agape'])
})

test('assignLabels adds and removes without duplicates', () => {
  const contacts = [{ id: 'c1', labels: ['Kue'] }, { id: 'c2', labels: [] }]
  assert.equal(assignLabels(contacts, ['c1', 'c2'], ['Kue', 'Agape'], 'add'), 2)
  assert.deepEqual(contacts[0].labels, ['Kue', 'Agape'])
  assert.deepEqual(contacts[1].labels, ['Kue', 'Agape'])
  assert.equal(assignLabels(contacts, ['c1'], ['Kue'], 'remove'), 1)
  assert.deepEqual(contacts[0].labels, ['Agape'])
})

test('createGroup is idempotent by name', () => {
  const groups = []
  const a = createGroup(groups, 'Kue')
  const b = createGroup(groups, ' Kue ')
  assert.equal(a, b)
  assert.equal(groups.length, 1)
  assert.equal(createGroup(groups, '  '), null)
})

test('filterByLabels honours AND and OR', () => {
  const contacts = [
    { id: 'c1', labels: ['Kue', 'Agape'] },
    { id: 'c2', labels: ['Kue'] },
    { id: 'c3', labels: ['Bolu', 'Agape'] },
  ]
  assert.deepEqual(filterByLabels(contacts, ['Kue', 'Agape'], 'and').map((c) => c.id), ['c1'])
  assert.deepEqual(filterByLabels(contacts, ['Kue', 'Agape'], 'or').map((c) => c.id), ['c1', 'c2', 'c3'])
  assert.equal(filterByLabels(contacts, [], 'and').length, 3)
})

test('splitBySent separates by template id', () => {
  const contacts = [
    { id: 'c1', sentAt: { t1: '2026-01-01' } },
    { id: 'c2', sentAt: {} },
    { id: 'c3' },
  ]
  const { unsent, sent } = splitBySent(contacts, 't1')
  assert.deepEqual(sent.map((c) => c.id), ['c1'])
  assert.deepEqual(unsent.map((c) => c.id), ['c2', 'c3'])
  assert.equal(splitBySent(contacts, null).sent.length, 0)
})
