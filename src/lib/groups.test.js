import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeGroups, syncGroups, createGroup, groupAncestors, labelsForGroup, expandLabels,
  groupOutline, isDescendant, setGroupParent, renameLabel, deleteLabel, assignLabels,
  filterByLabels, splitBySent, backfillHierarchy, labelHue, buildLabelOptions,
  filterLabelOptions, highlightText,
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

test('backfillHierarchy adds ancestor labels after a reparent, idempotently', () => {
  const groups = normalizeGroups([{ id: 'k', name: 'Kue' }, { id: 'a', name: 'Agape' }])
  const contacts = [{ id: 'c1', labels: ['Agape'] }, { id: 'c2', labels: ['Kue'] }]
  setGroupParent(groups, 'a', 'k')
  assert.equal(backfillHierarchy(groups, contacts), 1)
  assert.deepEqual(contacts[0].labels, ['Agape', 'Kue'])
  assert.deepEqual(contacts[1].labels, ['Kue'])
  assert.deepEqual(filterByLabels(contacts, ['Kue'], 'and').map((c) => c.id), ['c1', 'c2'])
  assert.equal(backfillHierarchy(groups, contacts), 0)
})

test('backfillHierarchy covers a whole subtree moved under a new parent', () => {
  const groups = normalizeGroups([
    { id: 'b', name: 'Bolu' },
    { id: 'k', name: 'Kue' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  const contacts = [{ id: 'c1', labels: ['Agape', 'Kue'] }]
  setGroupParent(groups, 'k', 'b')
  backfillHierarchy(groups, contacts)
  assert.deepEqual(contacts[0].labels, ['Agape', 'Kue', 'Bolu'])
})

test('buildLabelOptions attaches counts, deterministic hue, and outermost-first parentPath', () => {
  const groups = normalizeGroups([
    { id: 'b', name: 'Bolu' },
    { id: 'k', name: 'Kue', parentId: 'b' },
    { id: 'a', name: 'Agape', parentId: 'k' },
  ])
  const contacts = [
    { id: 'c1', labels: ['Agape', 'Kue', 'Bolu'] },
    { id: 'c2', labels: ['Kue', 'Bolu', 'VIP'] },
  ]
  const opts = buildLabelOptions(['Agape', 'Bolu', 'Kue', 'VIP'], contacts, groups)
  assert.equal(opts.length, 4)
  assert.deepEqual(opts[0], { name: 'Agape', count: 1, hue: labelHue('Agape'), parentPath: 'Bolu › Kue' })
  assert.deepEqual(opts[1], { name: 'Bolu', count: 2, hue: labelHue('Bolu'), parentPath: '' })
  assert.deepEqual(opts[2], { name: 'Kue', count: 2, hue: labelHue('Kue'), parentPath: 'Bolu' })
  assert.deepEqual(opts[3], { name: 'VIP', count: 1, hue: labelHue('VIP'), parentPath: '' })
})

test('filterLabelOptions ranks prefix name matches before mid-name and parent-path matches', () => {
  const options = [
    { name: 'Agape', count: 1, hue: 10, parentPath: 'Kue' },
    { name: 'Kue Kering', count: 2, hue: 20, parentPath: '' },
    { name: 'Snack Kue', count: 3, hue: 30, parentPath: '' },
    { name: 'VIP', count: 4, hue: 40, parentPath: '' },
  ]
  assert.deepEqual(filterLabelOptions(options, '').map((o) => o.name), ['Agape', 'Kue Kering', 'Snack Kue', 'VIP'])
  assert.deepEqual(filterLabelOptions(options, 'kue').map((o) => o.name), ['Kue Kering', 'Snack Kue', 'Agape'])
  assert.deepEqual(filterLabelOptions(options, 'nope'), [])
})

test('highlightText splits case-insensitive substring matches safely', () => {
  assert.deepEqual(highlightText('Agape VIP', 'vip'), [
    { text: 'Agape ', match: false },
    { text: 'VIP', match: true },
  ])
  assert.deepEqual(highlightText('Kue Kering', 'k'), [
    { text: 'K', match: true },
    { text: 'ue ', match: false },
    { text: 'K', match: true },
    { text: 'ering', match: false },
  ])
  assert.deepEqual(highlightText('Agape', '  '), [{ text: 'Agape', match: false }])
})
