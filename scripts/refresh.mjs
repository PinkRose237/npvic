import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { cutoff, links, seedMembers, seedNews } from '../data/inputs.mjs'
import { collect, mergeStories } from './collect.mjs'
import { forecast } from './model.mjs'
import { reviewStories } from './review.mjs'

const snapshotFile = new URL('../site/data/snapshot.json', import.meta.url)
const historyFile = new URL('../site/data/revisions.json', import.meta.url)
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12)
const roundPercent = n => Math.round(n * 100)
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}
async function writeJson(file, data) {
  const temp = new URL(file.href + '.tmp')
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n')
  await rename(temp, file)
}

const [prior, priorHistory] = await Promise.all([readJson(snapshotFile, null), readJson(historyFile, [])])
const stamp = new Date().toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(stamp))
if (today > cutoff && prior) {
  console.log('The forecast window has closed. Preserving the published archive.')
  process.exit(0)
}

const collected = await collect(prior, stamp)
const currentMembers = collected.membership?.members ?? prior?.forecast.members ?? seedMembers
const members = Object.fromEntries(Object.entries(currentMembers).sort(([a], [b]) => a.localeCompare(b)))
const news = mergeStories(seedNews, prior?.news ?? [], collected.stories, today)
const review = await reviewStories(news, process.env.REFRESH_AI === 'true' ? null : prior?.review)
const current = forecast({ members, bills: collected.bills, today })
const material = {
  modelVersion: current.modelVersion, members,
  estimates: current.estimates.map(item => roundPercent(item.probability)),
  states: current.states.map(state => ({ code: state.code, stage: state.stage, p: roundPercent(state.estimate),
    range: state.range.map(roundPercent), signals: state.signals, active: state.active?.id ?? null,
    bills: state.bills.filter(bill => bill.stage).map(({ id, session, stage, date }) => ({ id, session, stage, date })) }))
}
const fingerprint = hash(material)
const last = priorHistory[0]
const changes = []
if (!last) changes.push('Published the baseline and verified the five-state electoral paths.')
if (last?.modelVersion && last.modelVersion !== current.modelVersion) changes.push(`Forecast model updated to v${current.modelVersion}.`)
if (last?.committed != null && last.committed !== current.committed) changes.push(`Member electoral votes moved from ${last.committed} to ${current.committed}.`)
const estimate = material.estimates[1]
if (last && last.estimate !== estimate) changes.push(`Threshold estimate moved from ${last.estimate}% to ${estimate}%.`)
for (const state of material.states) {
  const old = last?.states.find(item => item.code === state.code)
  const stageChanged = old && (old.stage !== state.stage || old.active !== state.active)
  const changedBill = old && state.bills.some(bill => !old.bills?.some(item => item.id === bill.id &&
    item.session === bill.session && item.stage === bill.stage && item.date === bill.date))
  if (stageChanged) changes.push(`${state.code}: ${state.stage}${state.active ? ` · ${state.active}` : ''}.`)
  else if (changedBill) changes.push(`${state.code}: official bill record updated.`)
  if (old && old.p !== state.p) changes.push(`${state.code}: ${old.p}% to ${state.p}%.`)
}
const revision = last?.fingerprint === fingerprint ? last : {
  id: (last?.id ?? 0) + 1, fingerprint, date: stamp, modelVersion: current.modelVersion, committed: current.committed,
  estimate, states: material.states,
  changes: changes.length ? changes : ['Updated model inputs and recalculated the estimates.']
}
const history = revision === last ? priorHistory : [revision, ...priorHistory]
await writeJson(historyFile, history)
await writeJson(snapshotFile, {
  checkedAt: stamp, today, revision: revision.id, revisedAt: revision.date,
  membershipVerifiedAt: collected.membership ? stamp : prior?.membershipVerifiedAt ?? null,
  membershipSource: collected.membership?.source ?? prior?.membershipSource ?? 'Launch baseline',
  links, forecast: current, review, news, feeds: collected.feeds, wikiRevision: collected.wikiRevision,
  bills: collected.bills
})
console.log(`Revision ${revision.id}: ${current.committed} EVs pledged, ${estimate}% model estimate, ${news.length} news records, AI ${review.status}.`)
