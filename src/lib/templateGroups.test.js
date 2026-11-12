import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTemplateGroups,
  createTemplateGroup,
  templateGroupOutline,
  isTemplateGroupDescendant,
  setTemplateGroupParent,
  templateGroupAncestors,
  templateGroupPath,
  templateGroupDescendantIds,
  renameTemplateGroup,
  deleteTemplateGroup,
  assignTemplateGroup,
  templateGroupCounts,
  filterTemplates,
} from './templateGroups.js'

const seed = () =>
  normalizeTemplateGroups([
    { id: 'roti', name: 'Usaha Roti' },
    { id: 'pem', name: 'Pemberitahuan', parentId: 'roti' },
    { id: 'ingat', name: 'Pengingat Pembayaran', parentId: 'pem' },
    { id: 'makasih', name: 'Terima kasih sudah bayar', parentId: 'pem' },
    { id: 'promo', name: 'Promo', parentId: 'roti' },
  ])

test('normalizeTemplateGroups trims, dedupes, and matches a parent by name', () => {
  const rows = normalizeTemplateGroups([
    { name: ' Usaha Roti ' },
    { name: 'Usaha Roti' },
    { name: '' },
    { name: 'Pemberitahuan', parentId: 'Usaha Roti' },
  ])
  assert.equal(rows.length, 2)
  assert.ok(rows[0].id)
  assert.equal(rows[1].parentId, rows[0].id)
})

test('normalizeTemplateGroups drops cycles and self-parents', () => {
  const rows = normalizeTemplateGroups([
    { id: 'a', name: 'A', parentId: 'b' },
    { id: 'b', name: 'B', parentId: 'a' },
    { id: 'c', name: 'C', parentId: 'c' },
  ])
  const byId = Object.fromEntries(rows.map((g) => [g.id, g]))
  assert.equal(byId.c.parentId, null)
  assert.ok(byId.a.parentId === null || byId.b.parentId === null)
})

test('createTemplateGroup is idempotent by name and rejects blanks', () => {
  const groups = []
  const a = createTemplateGroup(groups, 'Usaha Roti')
  const b = createTemplateGroup(groups, ' Usaha Roti ')
  assert.equal(a, b)
  assert.equal(groups.length, 1)
  assert.equal(createTemplateGroup(groups, '  '), null)
})

test('templateGroupOutline lists parents A-Z then indented descendants', () => {
  const groups = normalizeTemplateGroups([
    { id: 'r', name: 'Usaha Roti' },
    { id: 'p', name: 'Pemberitahuan', parentId: 'r' },
    { id: 'i', name: 'Pengingat', parentId: 'p' },
    { id: 'b', name: 'Bolu' },
  ])
  assert.deepEqual(
    templateGroupOutline(groups).map((g) => [g.name, g.depth]),
    [
      ['Bolu', 0],
      ['Usaha Roti', 0],
      ['Pemberitahuan', 1],
      ['Pengingat', 2],
    ]
  )
})

test('ancestors, path, and descendant ids follow the chain', () => {
  const groups = seed()
  assert.deepEqual(templateGroupAncestors(groups, 'ingat'), ['Pemberitahuan', 'Usaha Roti'])
  assert.equal(templateGroupPath(groups, 'ingat'), 'Usaha Roti › Pemberitahuan › Pengingat Pembayaran')
  assert.equal(templateGroupPath(groups, null), '')
  assert.deepEqual(new Set(templateGroupDescendantIds(groups, 'pem')), new Set(['pem', 'ingat', 'makasih']))
})

test('setTemplateGroupParent rejects self and descendant parents', () => {
  const groups = seed()
  assert.equal(isTemplateGroupDescendant(groups, 'roti', 'ingat'), true)
  assert.equal(setTemplateGroupParent(groups, 'roti', 'roti'), false)
  assert.equal(setTemplateGroupParent(groups, 'roti', 'ingat'), false)
  assert.equal(setTemplateGroupParent(groups, 'pem', null), true)
  assert.equal(groups.find((g) => g.id === 'pem').parentId, null)
})

test('renameTemplateGroup renames the registry only and rejects a taken name', () => {
  const groups = seed()
  assert.equal(renameTemplateGroup(groups, 'Promo', 'Diskon'), true)
  assert.equal(groups.find((g) => g.name === 'Diskon').id, 'promo')
  assert.equal(renameTemplateGroup(groups, 'Diskon', 'Pemberitahuan'), false)
  assert.equal(renameTemplateGroup(groups, 'Missing', 'X'), false)
})

test('deleteTemplateGroup promotes subgroups and moves templates up', () => {
  const groups = normalizeTemplateGroups([
    { id: 'roti', name: 'Usaha Roti' },
    { id: 'pem', name: 'Pemberitahuan', parentId: 'roti' },
    { id: 'ingat', name: 'Pengingat', parentId: 'pem' },
  ])
  const templates = [
    { id: 't1', groupId: 'pem' },
    { id: 't2', groupId: 'ingat' },
    { id: 't3', groupId: null },
  ]
  const moved = deleteTemplateGroup(groups, templates, 'pem')
  assert.equal(moved, 1)
  assert.equal(groups.find((g) => g.id === 'ingat').parentId, 'roti')
  assert.equal(templates.find((t) => t.id === 't1').groupId, 'roti')
  assert.equal(templates.find((t) => t.id === 't2').groupId, 'ingat')
  assert.equal(templates.length, 3)
})

test('deleteTemplateGroup on a top-level group sends templates to No group', () => {
  const groups = normalizeTemplateGroups([{ id: 'r', name: 'Usaha Roti' }])
  const templates = [{ id: 't1', groupId: 'r' }]
  assert.equal(deleteTemplateGroup(groups, templates, 'r'), 1)
  assert.equal(templates[0].groupId, null)
})

test('assignTemplateGroup skips templates already in the target group', () => {
  const templates = [
    { id: 't1', groupId: 'a' },
    { id: 't2', groupId: null },
  ]
  assert.equal(assignTemplateGroup(templates, ['t1', 't2'], 'a'), 1)
  assert.equal(templates[0].groupId, 'a')
  assert.equal(templates[1].groupId, 'a')
  assert.equal(assignTemplateGroup(templates, ['t1'], 'a'), 0)
})

test('templateGroupCounts counts direct members only', () => {
  const groups = seed()
  const templates = [
    { id: 't1', groupId: 'pem' },
    { id: 't2', groupId: 'ingat' },
    { id: 't3', groupId: 'ingat' },
  ]
  const counts = templateGroupCounts(groups, templates)
  assert.equal(counts.get('pem'), 1)
  assert.equal(counts.get('ingat'), 2)
  assert.equal(counts.get('roti'), 0)
})

test('filterTemplates narrows by group, subgroup, and No group', () => {
  const groups = seed()
  const templates = [
    { id: 't1', name: 'Ingat bayar', groupId: 'ingat' },
    { id: 't2', name: 'Terima kasih', groupId: 'makasih' },
    { id: 't3', name: 'Promo lebaran', groupId: 'promo' },
    { id: 't4', name: 'Draft', groupId: null },
  ]
  const ids = (list) => list.map((t) => t.id)
  assert.deepEqual(ids(filterTemplates(templates, groups, '', '')), ['t1', 't2', 't3', 't4'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', 'pem')), ['t1', 't2'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', 'roti')), ['t1', 't2', 't3'])
  assert.deepEqual(ids(filterTemplates(templates, groups, '', '__none__')), ['t4'])
})

test('filterTemplates matches the template name or the group path', () => {
  const groups = seed()
  const templates = [
    { id: 't1', name: 'Ingat bayar', groupId: 'ingat' },
    { id: 't2', name: 'Promo lebaran', groupId: 'promo' },
  ]
  assert.deepEqual(filterTemplates(templates, groups, 'bayar', '').map((t) => t.id), ['t1'])
  assert.deepEqual(filterTemplates(templates, groups, 'roti', '').map((t) => t.id), ['t1', 't2'])
  assert.deepEqual(filterTemplates(templates, groups, 'pemberitahuan', '').map((t) => t.id), ['t1'])
  assert.deepEqual(filterTemplates(templates, groups, 'zzz', ''), [])
})
