import { allocation, baseline, cutoff, states, threshold } from '../data/inputs.mjs'

export const modelVersion = '1.0.0'

// Log-odds adjustments are explicit judgment calls. A bill can advance this
// cycle only if the same measure clears each gate.
export const stages = {
  none: { label: 'Awaiting new filing', weight: 0 },
  closed: { label: 'Closed', weight: 0 },
  introduced: { label: 'Introduced / referred', weight: 0.42 },
  committee: { label: 'Reported from committee', weight: 0.92 },
  chamber: { label: 'Passed one chamber', weight: 1.55 },
  both: { label: 'Passed both chambers', weight: 2.65 },
  signed: { label: 'Signed / chaptered', weight: 4.10 }
}

const logit = p => Math.log(p / (1 - p))
const chance = x => 1 / (1 + Math.exp(-x))
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
const sumVotes = members => Object.keys(members).reduce((sum, name) => sum + allocation[name], 0)
const adjustmentScenarios = [
  { name: 'Lower', shift: -0.85 },
  { name: 'Central', shift: 0 },
  { name: 'Higher', shift: 0.85 }
]
const commonClimate = [
  { shift: -0.65, weight: 0.25 },
  { shift: 0, weight: 0.5 },
  { shift: 0.65, weight: 0.25 }
]

export function historicalBaseline() {
  const joined = baseline.reduce((n, cohort) => n + cohort.joined.length, 0)
  const missed = baseline.reduce((n, cohort) => n + cohort.missed.length, 0)
  // One success and one failure as a weak symmetric prior.
  const probability = (joined + 1) / (joined + missed + 2)
  const errors = baseline.flatMap(cohort => {
    const otherSuccesses = joined - cohort.joined.length
    const otherFailures = missed - cohort.missed.length
    const heldOutProbability = (otherSuccesses + 1) / (otherSuccesses + otherFailures + 2)
    return [
      ...cohort.joined.map(() => (1 - heldOutProbability) ** 2),
      ...cohort.missed.map(() => heldOutProbability ** 2)
    ]
  })
  return { joined, missed, probability, brier: mean(errors), cohorts: baseline }
}

function resolveState(state, bills, members, today, prior) {
  const isMember = Object.hasOwn(members, state.name)
  const deadline = state.windowEnd ?? cutoff
  const activeBills = bills.filter(bill => {
    const currentCycle = bill.session >= 2027 || bill.stage === 'signed'
    const open = !bill.closes || today <= bill.closes || bill.stage === 'signed'
    return currentCycle && open && bill.route !== 'amendment' && bill.stage !== 'closed'
  }).sort((a, b) => stages[b.stage].weight - stages[a.stage].weight || b.date.localeCompare(a.date))
  const active = activeBills[0] ?? null
  const days = (Date.parse(deadline) - Date.parse(today)) / 86_400_000
  const weight = stages[active?.stage ?? 'none'].weight
  const timePenalty = active?.stage === 'signed' ? 0 :
    -Math.max(0, (180 - days) / 180) * (2.4 - Math.min(2, weight * 0.7))
  const limitedWindow = days < 0 && state.windowEnd && !['both', 'signed'].includes(active?.stage)
  const score = logit(prior) + weight + state.signals.reduce((sum, signal) => sum + signal.shift, 0) + timePenalty
  return {
    ...state, bills, votes: allocation[state.name], isMember, active,
    stage: isMember ? 'Member' : (limitedWindow ? 'Regular window closed' : stages[active?.stage ?? 'none'].label),
    score, limitedWindow: Boolean(limitedWindow)
  }
}

function stateProbability(state, shift) {
  if (state.isMember) return 1
  if (state.limitedWindow) return Math.min(0.04, chance(state.score + shift))
  return chance(state.score + shift)
}

function combinations(tracked, committed, climateShift, estimateShift) {
  const open = tracked.filter(state => !state.isMember)
  return Array.from({ length: 2 ** open.length }, (_, mask) => {
    let probability = 1
    let total = committed
    const joins = []
    for (const [index, state] of open.entries()) {
      const p = stateProbability(state, climateShift + estimateShift)
      const joinsScenario = Boolean(mask & (1 << index))
      probability *= joinsScenario ? p : 1 - p
      if (joinsScenario) {
        total += state.votes
        joins.push(state.code)
      }
    }
    return { joins, total, probability }
  })
}

export function forecast({ members, bills, today }) {
  const backtest = historicalBaseline()
  const committed = sumVotes(members)
  const tracked = states.map(state => resolveState(state, bills[state.code], members, today, backtest.probability))
  const marginal = (state, shift) => commonClimate.reduce(
    (p, regime) => p + regime.weight * stateProbability(state, shift + regime.shift), 0
  )
  const estimates = adjustmentScenarios.map(({ name, shift }) => {
    const probability = commonClimate.reduce((p, regime) => p + regime.weight *
      combinations(tracked, committed, regime.shift, shift)
        .filter(item => item.total >= threshold)
        .reduce((sum, item) => sum + item.probability, 0), 0)
    return { name, probability }
  })
  const outcomes = combinations(tracked, committed, 0, 0)
  const winners = outcomes.filter(item => item.total >= threshold)
  const minimumPaths = winners.filter(
    item => !winners.some(other => other.joins.length < item.joins.length && other.joins.every(code => item.joins.includes(code)))
  ).map(({ joins, total }) => ({ joins, total })).sort((a, b) => a.total - b.total)
  const required = tracked.filter(state => !state.isMember && winners.length && winners.every(item => item.joins.includes(state.code)))
    .map(state => state.code)
  const remaining = tracked.filter(state => !state.isMember).reduce((sum, state) => sum + state.votes, 0)
  return {
    modelVersion, cutoff, threshold, members, committed, remaining, max: committed + remaining,
    estimates, minimumPaths, required, backtest,
    states: tracked.map(({ score, limitedWindow, windowEnd, ...state }) => ({
      ...state, windowEnd, limitedWindow,
      estimate: marginal({ ...state, score, limitedWindow }, 0),
      range: [-0.85, 0.85].map(shift => marginal({ ...state, score, limitedWindow }, shift))
    }))
  }
}
