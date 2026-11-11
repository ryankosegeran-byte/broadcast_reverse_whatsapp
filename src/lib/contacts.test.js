import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCsv, parseDelimited, parseVcf, guessMapping, mapRows, mergeContacts, uniqueLabels,
} from './contacts.js'

test('parseDelimited handles quotes, escaped quotes, and newlines', () => {
  const rows = parseDelimited('a,b\n"x,1","y""2"\n', ',')
  assert.deepEqual(rows, [['a', 'b'], ['x,1', 'y"2']])
})

test('parseCsv auto-detects semicolon', () => {
  assert.deepEqual(parseCsv('nomor;nama\n62811111;Budi\n'), [['nomor', 'nama'], ['62811111', 'Budi']])
})

test('parseVcf reads TEL and FN, including folded lines', () => {
  const vcf = 'BEGIN:VCARD\nVERSION:3.0\nN:Santoso;Budi;;;\nFN:Budi \n Santoso\nTEL;TYPE=CELL:+62 811-1111\nEND:VCARD\n'
  assert.deepEqual(parseVcf(vcf), [{ phone: '+62 811-1111', name: 'Budi Santoso' }])
})

test('guessMapping finds aliases and variable keys', () => {
  const map = guessMapping(['Nomor WA', 'Nama', 'Tag', 'invoice'], ['invoice'])
  assert.equal(map.phone, 0)
  assert.equal(map.name, 1)
  assert.equal(map.label, 2)
  assert.equal(map.vars.invoice, 3)
})

test('mapRows normalises phone, splits labels, fills values', () => {
  const [row] = mapRows(
    [['0896-9812-9722', 'Budi', 'VIP;Pelanggan', 'INV-1']],
    { phone: 0, name: 1, label: 2, vars: { invoice: 3 } },
    ['invoice'],
  )
  assert.equal(row.phone, '6289698129722')
  assert.deepEqual(row.labels, ['VIP', 'Pelanggan'])
  assert.deepEqual(row.values, { invoice: 'INV-1' })
  assert.equal(row.valid, true)
})

test('mergeContacts adds new and unions labels on duplicates', () => {
  const local = [{ id: 'c1', phone: '62811111', name: 'A', labels: ['VIP'], values: { t1: { x: 'L' } }, sentAt: {} }]
  const { added, merged } = mergeContacts(local, [
    { phone: '62811111', name: 'B', labels: ['Pelanggan'], values: { t1: { x: 'F', y: '10' } } },
    { phone: '62822222', name: 'C', labels: [], values: {} },
  ])
  assert.equal(added, 1)
  assert.equal(merged, 1)
  assert.equal(local.length, 2)
  assert.equal(local[0].name, 'A')
  assert.deepEqual(local[0].labels, ['VIP', 'Pelanggan'])
  assert.equal(local[0].values.t1.x, 'L')
  assert.equal(local[0].values.t1.y, '10')
})

test('uniqueLabels is sorted and unique', () => {
  assert.deepEqual(uniqueLabels([{ labels: ['b', 'a'] }, { labels: ['a', 'c'] }]), ['a', 'b', 'c'])
})
