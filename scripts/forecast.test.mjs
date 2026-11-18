import assert from 'node:assert/strict'
import test from 'node:test'
import { allocation, seedMembers, states } from '../data/inputs.mjs'
import { forecast } from './model.mjs'
import { parseOfficial, mergeStories } from './collect.mjs'

const startingBills = Object.fromEntries(states.map(state => [state.code, state.bills]))
const run = (members = seedMembers, bills = startingBills, today = '2026-11-17') => forecast({ members, bills, today })

test('reconciles electoral votes and finds all minimal winning paths', () => {
  const result = run()
  assert.equal(Object.values(allocation).reduce((n, votes) => n + votes, 0), 538)
  assert.equal(result.committed, 222)
  assert.equal(result.max, 283)
  assert.deepEqual(result.required, ['PA', 'MI'])
  assert.deepEqual(result.minimumPaths.map(path => path.total), [272, 273, 277])
  assert.ok(result.minimumPaths.every(path => path.joins.length === 4 && ['PA', 'MI'].every(code => path.joins.includes(code))))
})

test('counts members once and adjusts the required paths on outside adoption', () => {
  const result = run({ ...seedMembers, Michigan: 2027, 'New Hampshire': 2027 })
  assert.equal(result.committed, 241)
  assert.equal(result.max, 287)
  assert.equal(result.states.find(state => state.code === 'MI').estimate, 1)
  assert.ok(result.minimumPaths.every(path => !path.joins.includes('MI')))
})

test('revises the aggregate only for a viable legislative path', () => {
  const result = run(seedMembers, startingBills, '2027-03-01')
  const fresh = { id: 'HB 12', session: 2027, stage: 'chamber', date: '2027-03-01' }
  const regular = run(seedMembers, { ...startingBills, PA: [fresh] }, '2027-03-01')
  const amendment = run(seedMembers, { ...startingBills, PA: [{ ...fresh, route: 'amendment' }] }, '2027-03-01')
  assert.ok(regular.estimates[1].probability > result.estimates[1].probability)
  assert.equal(amendment.estimates[1].probability, result.estimates[1].probability)
})

test('does not mistake government support for an enacted bill', () => {
  const doc = `<title>House Bill 21 of 2027</title><h1>House Bill 21</h1>
    <p>Agreement among the States to elect the President by national popular vote.</p><table>
    <tr><td>1/20/2027</td><td>HJ 2</td><td>referred to Committee on Elections</td></tr>
    <tr><td>3/21/2027</td><td>HJ 20</td><td>passed by the House</td></tr>
    <tr><td>4/05/2027</td><td>SJ 32</td><td>referred to Committee on Elections</td></tr></table>`
  assert.equal(parseOfficial(doc, { id: 'HB 21', session: 2027, code: 'MI' }).stage, 'chamber')
})

test('keeps news deduplicated across feeds and filters future dates', () => {
  const story = { title: 'National popular vote bill introduced', source: 'Example', date: '2026-11-16' }
  const future = { ...story, title: 'National popular vote bill passes', date: '2027-01-01' }
  assert.equal(mergeStories([], [story], [story, future], '2026-11-17').length, 1)
})
