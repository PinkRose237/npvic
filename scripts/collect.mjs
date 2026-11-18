import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { allocation, links, states } from '../data/inputs.mjs'

const wiki = 'https://en.wikipedia.org/w/api.php?action=parse&page=National_Popular_Vote_Interstate_Compact&prop=text%7Crevid&formatversion=2&format=json'
const topic = /national popular vote|popular vote (?:interstate )?compact|npvic/i
const clean = value => value.replace(/\s+/g, ' ').trim()
const comparable = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const hostname = {
  AZ: 'apps.azleg.gov', MI: 'legislature.mi.gov', NV: 'leg.state.nv.us',
  PA: 'palegis.us', WI: 'docs.legis.wisconsin.gov'
}
const billNumber = /\b((?:A[JR]{1,2}|S[JR]{1,2}|AB|HB|SB)\s*0*\d{1,5})\b/i

export function dateOnly(value) {
  const stamp = Date.parse(value)
  return Number.isFinite(stamp) ? new Date(stamp).toISOString().slice(0, 10) : null
}

export function safeUrl(value, base) {
  try {
    const url = new URL(value, base)
    return url.protocol === 'https:' && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

async function get(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CompactWatch/1.0 (https://github.com/PinkRose237/npvic)' },
    signal: AbortSignal.timeout(12_000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

export function parseMembership(html) {
  const $ = load(html)
  const table = $('table').filter((_, el) => /Current Status of the National Popular Vote Compact/i.test($(el).find('caption').text())).first()
  const members = {}
  let total
  for (const row of table.find('tr').toArray()) {
    const [first, value] = $(row).children('td').map((_, el) => clean($(el).text())).get()
    if (first === 'TOTAL') total = Number(value)
    const match = first?.match(/^(.+) \((\d{4})\)$/)
    if (!match) continue
    const [, name, year] = match
    if (Number(value) !== allocation[name] || !Object.hasOwn(allocation, name) || name in members) {
      throw new Error('Unrecognized member row or allocation')
    }
    members[name] = Number(year)
  }
  const sum = Object.keys(members).reduce((n, name) => n + allocation[name], 0)
  if (Object.keys(members).length < 10 || sum !== total) throw new Error('Membership table did not reconcile')
  // The NCSL table lists 2007 for NJ. P.L.2007, c.334 was approved January 13, 2008.
  if (members['New Jersey'] === 2007) members['New Jersey'] = 2008
  return { members, total }
}

function isOfficial(url, state) {
  if (!url || url.port) return false
  return url.hostname === hostname[state] || url.hostname === `www.${hostname[state]}`
}

function sessionFrom(url, fallback) {
  const match = (url.pathname + url.search).match(/20(?:2[5-9]|3\d)/)
  return match ? Number(match[0]) : fallback
}

function normalizeId(id) {
  return id.toUpperCase().replace(/\s/g, '').replace(/^([A-Z]+)0*(\d+)$/, '$1 $2')
}

function discoveryFromWiki(body) {
  const { text, revid } = JSON.parse(body).parse
  const $ = load(text)
  const table = $('table').filter((_, el) => /Latest action/.test($(el).find('tr').first().text())).first()
  if (!table.length || !revid) throw new Error('Bill table missing')
  const bills = []
  let active
  let session
  for (const row of table.find('tr').toArray()) {
    const first = clean($(row).children('td').first().text())
    if (Object.hasOwn(allocation, first)) {
      active = states.find(state => state.name === first)
      session = Number(clean($(row).children('td').eq(2).text()).slice(0, 4))
    }
    const id = clean($(row).children('th[scope="row"]').first().text()).match(billNumber)?.[1]
    if (!active || !id || session < 2027) continue
    const cite = $(row).find('a[href^="#cite_note-"]').first().attr('href')
    const note = cite && $('[id]').filter((_, el) => $(el).attr('id') === cite.slice(1)).first()
    const url = note && note.find('a[href]').map((_, el) => safeUrl($(el).attr('href')))
      .get().find(item => isOfficial(item, active.code))
    if (url) bills.push({ code: active.code, id: normalizeId(id), session, url: url.href })
  }
  return { revision: revid, bills }
}

function advocacyCandidates(html, state) {
  const $ = load(html)
  return $('main a[href], article a[href], .field-name-body a[href]').map((_, el) => {
    const url = safeUrl($(el).attr('href'), `https://www.nationalpopularvote.com/state/${state.code.toLowerCase()}`)
    const id = clean($(el).text()).match(billNumber)?.[1]
    const session = url && sessionFrom(url)
    if (!isOfficial(url, state.code) || !id || !session || session < 2027) return null
    return { code: state.code, id: normalizeId(id), session, url: url.href }
  }).get()
}

function stageFromActions(actions) {
  const latest = actions[0]
  const text = latest.text
  if (/vetoed|failed to pass|died in committee|withdrawn|laid on the table|indefinitely postponed|not concurred|returned without approval/i.test(text)) return 'closed'
  if (/signed (?:by|into law)|became (?:a )?law|(?:approved by|chaptered by) (?:the )?governor|public act no\.|chapter \d+.*(?:202[7-8]|laws)|act no\. \d+/i.test(text)) return 'signed'
  if (/presented to (?:the )?governor|sent to (?:the )?governor|transmitted to (?:the )?governor|both (?:houses|chambers) passed/i.test(text)) return 'both'
  if (actions.some(row => /reconsideration.*(?:passed|adopted)|rescinded/i.test(row.text))) return 'introduced'
  const passed = actions.filter(row => /(?:read (?:a )?third time and )?passed|(?:^|\b)final passage|(?:^|\b)concurred in/i.test(row.text) &&
    !/failed|not |resolution|motion|committee|referred|schedule|ordered|before final/i.test(row.text))
  const chambers = new Set(passed.map(row => row.chamber).filter(Boolean))
  if (chambers.size === 2) return 'both'
  if (passed.length) return 'chamber'
  if (actions.some(row => /reported favorably|reported with recommendation (?:that )?the bill (?:be|do) pass|recommended for passage|report.*do pass|committee.*approved/i.test(row.text))) return 'committee'
  if (actions.some(row => /referred|introduced|first read|prefiled|read first|read a first/i.test(row.text))) return 'introduced'
  return null
}

export function parseOfficial(html, bill) {
  const $ = load(html)
  const header = clean($('title, h1, h2').text())
  const full = clean($('body').text())
  const expanded = bill.id.replace(/^HB /, 'House Bill ').replace(/^SB /, 'Senate Bill ').replace(/^AB /, 'Assembly Bill ')
  const subject = comparable(header + full.slice(0, 1700))
  if (!topic.test(full) || ![bill.id, expanded].some(id => subject.includes(comparable(id)))) return null
  if (/\b(?:repeal|withdraw(?:al)? from)\b.{0,75}(?:national popular vote|compact)/i.test(header) ||
      /presidential electors[^;]{0,120}clarify/i.test(full.slice(0, 1100))) return null
  const route = bill.id.startsWith('AJR') || bill.id.startsWith('SJR') || /amend.*constitution/i.test(header) ? 'amendment' : 'bill'
  const actions = $('tr').map((_, row) => {
    const cells = $(row).children('td').map((__, el) => clean($(el).text())).get()
    const date = cells[0]?.match(/\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+ \d{1,2}, \d{4}/)?.[0]
    if (cells.length < 3 || !date) return null
    if (bill.code === 'WI' && $(row).find('.entry').length) {
      return { date: dateOnly(date), text: clean($(row).find('.entry').text()), chamber: $(row).find('abbr').attr('title') }
    }
    if (bill.code === 'MI' && /^(?:H|S)J\b/.test(cells[1])) {
      return { date: dateOnly(date), text: cells[2], chamber: cells[1][0] === 'H' ? 'House' : 'Senate' }
    }
    return null
  }).get()
  if (bill.code === 'PA') {
    const dates = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?) \d{1,2},\s*\d{4}/i
    for (const el of $('strong').filter((_, el) => clean($(el).text()) === 'Last Action:').toArray()) {
      const detail = clean($(el).parent().text()).replace(/^Last Action:\s*/, '')
      const match = detail.match(dates)
      if (match) actions.push({ date: dateOnly(match[0]), text: detail.slice(0, match.index).replace(/,\s*$/, '') })
    }
    const milestones = $('.timeline-completed[data-tooltip]').map((_, el) => load($(el).attr('data-tooltip')).text()).get().join(' ')
    if (actions[0] && /passed the (?:House|Senate)/i.test(milestones)) {
      for (const chamber of ['House', 'Senate']) {
        if (new RegExp(`passed the ${chamber}`, 'i').test(milestones)) {
          actions.push({ date: actions[0].date, text: 'Passed', chamber })
        }
      }
    }
  }
  actions.sort((a, b) => b.date.localeCompare(a.date))
  if (!actions.length) return null
  const stage = stageFromActions(actions)
  if (!stage) return null
  return { ...bill, route, stage, date: actions[0].date, action: actions[0].text.slice(0, 200) }
}

export function parseArizona(body, bill) {
  const info = JSON.parse(body)
  if (!info?.BillId || normalizeId(info.Number ?? '') !== bill.id || !topic.test(info.NOWTitle || info.ShortTitle || '')) return null
  if (/repeal|withdrawal/i.test(info.NOWTitle || info.ShortTitle)) return null
  const records = info.BillStatusAction ?? []
  const passed = new Set(records.filter(entry => entry.Action === 'PASSED' && entry.Committee?.CommitteeShortName === 'THIRD')
    .map(entry => entry.Committee.LegislativeBody).filter(code => code === 'H' || code === 'S'))
  const events = records.flatMap(entry => [entry.ReportDate, entry.AssignedDate, entry.ActionDatetime])
  const dates = [info.GovernorActionDate, info.House2ndRead, info.Senate2ndRead, info.House1stRead, info.Senate1stRead,
    info.DateIntroduced, info.PreFileDate, ...events].filter(Boolean).map(dateOnly).filter(Boolean).sort()
  if (!dates.length) return null
  const disposition = info.FinalDisposition ?? ''
  const closed = /held in|vetoed|failed|withdrawn/i.test(disposition + ' ' + info.GovernorAction)
  const committee = records.some(entry => /^DP(?:A)?$/.test(entry.Action) && entry.ReportDate && entry.Committee?.TypeName === 'Standing')
  let stage = 'introduced'
  if (committee) stage = 'committee'
  if (passed.size) stage = passed.size === 2 ? 'both' : 'chamber'
  if (closed) stage = 'closed'
  if (info.ChapterNumber && !/vetoed/i.test(info.GovernorAction)) stage = 'signed'
  return { ...bill, route: 'bill', stage, date: dates.at(-1), action: clean(info.GovernorAction || disposition || 'Bill history recorded') }
}

async function officialBill(row, state, poll) {
  const label = `Official bill · ${state.code} ${row.session} ${row.id}`
  const bill = { ...row, code: state.code }
  if (state.code === 'AZ') {
    const config = await poll(label + ' · source', row.url, html => {
      const match = html.match(/new BillOverviewViewModel\((\d+),\s*'([A-Z]+\d+)'/)
      if (!match || normalizeId(match[2]) !== row.id) throw new Error('Arizona session identifier unavailable')
      return { number: match[2], sessionId: match[1] }
    })
    if (!config) return null
    const url = new URL('https://apps.azleg.gov/api/Bill/')
    url.search = new URLSearchParams({ billNumber: config.number, sessionId: config.sessionId, legislativeBody: '0' })
    return poll(label, url.href, body => {
      const parsed = parseArizona(body, bill)
      if (!parsed) throw new Error('No verified Arizona bill')
      return parsed
    })
  }
  return poll(label, row.url, body => {
    const parsed = parseOfficial(body, bill)
    if (!parsed) throw new Error('No verified action could be parsed')
    return parsed
  })
}

function searchCandidates(body, code, year, base) {
  const $ = load(body)
  const results = $('a[href]').map((_, el) => {
    const url = safeUrl($(el).attr('href'), base)
    const id = $(el).text().match(billNumber)?.[1]
    if (!isOfficial(url, code) || !id) return null
    if (code === 'PA' && !new RegExp(`^/legislation/bills/${year}/[hs]b0?\\d+$`, 'i').test(url.pathname)) return null
    if (code === 'MI') {
      const objectName = url.searchParams.get('objectName')
      if (!objectName || !new RegExp(`^(?:${year}|${year + 1})-[HS]B-\\d+$`).test(objectName)) return null
      url.pathname = '/Bills/Bill'
      url.searchParams.set('printerFriendly', 'true')
    }
    if (code === 'NV') {
      if (!url.pathname.includes('/Bill/') || !topic.test($(el).parent().parent().text())) return null
      return { code, id: normalizeId(id), session: year, url: url.href, discovery: 'Official bill listing' }
    }
    return { code, id: normalizeId(id), session: year, url: url.href }
  }).get()
  return Array.from(new Map(results.map(row => [row.id, row])).values()).slice(0, 12)
}

function parseRss(body) {
  const $ = load(body, { xml: true })
  if (!$('rss channel').length) throw new Error('RSS payload missing')
  return $('item').map((_, el) => {
    const item = $(el)
    const title = clean(item.find('title').text())
    const source = clean(item.find('source').text())
    const url = safeUrl(item.find('link').text())
    const date = dateOnly(item.find('pubDate').text())
    if (!title || !url || !date) return null
    return { title: source ? title.replace(new RegExp(' - ' + source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '') : title, source, url: url.href, date }
  }).get()
}

const identity = news => `news-${createHash('sha256').update(comparable(news.title) + '\n' + comparable(news.source)).digest('hex').slice(0, 14)}`

export function mergeStories(seed, previous, sources, today) {
  const oldest = Date.parse(today) - 45 * 86_400_000
  const byId = new Map()
  for (const story of [...seed, ...previous, ...sources]) {
    if (story.date > today || (!seed.includes(story) && Date.parse(story.date) < oldest)) continue
    if (!topic.test(story.title) && !seed.includes(story) && !story.tag && !story.signal) continue
    const id = identity(story)
    if (!byId.has(id)) byId.set(id, { ...story, id })
  }
  // Collapse publisher feed duplicates of the manually verified launch sources.
  const stories = [...byId.values()].filter(item => {
    if (item.tag || item.signal) return true
    return !seed.some(verified => comparable(verified.source) === comparable(item.source) &&
      Math.abs(Date.parse(verified.date) - Date.parse(item.date)) <= 86_400_000)
  })
  return stories.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 65)
}

export async function collect(previous, stamp) {
  const metrics = { ...(previous?.feeds ?? {}) }
  async function poll(id, url, parse) {
    try {
      const value = parse(await get(url))
      metrics[id] = { url, status: 'ok', lastSuccess: stamp }
      return value
    } catch (error) {
      metrics[id] = { url, status: 'unavailable', lastSuccess: metrics[id]?.lastSuccess ?? null }
      console.warn(`${id}: ${error.message}`)
      return null
    }
  }
  const rssSearch = term => `https://news.google.com/rss/search?q=${encodeURIComponent(`${term} when:30d`)}&hl=en-US&gl=US&ceid=US:en`
  const newsQuery = '"national popular vote" (compact OR interstate)'
  const nextPa = 'https://www.palegis.us/legislation/bills/bill-keyword-search?searchBy=keyword&sessYr=2027&sessInd=0&keyword=national+popular+vote&searchType=text&billType=B'
  const nextMi = 'https://www.legislature.mi.gov/Search/ExecuteSearch?contentFullText=%22national+popular+vote%22&docTypes=Bills&sessions=2027-2028'
  const nextNv = 'https://www.leg.state.nv.us/App/NELIS/REL/84th2027/HomeBill/BillsTab?PageSize=2147483647&Filters.DisplayTitles=true'
  const [membership, index, headlineFeeds, changeFeeds, advocate, officialLeads] = await Promise.all([
    poll('Compact membership · NCSL', links.membership, parseMembership),
    poll('Bill discovery · MediaWiki API', wiki, discoveryFromWiki),
    Promise.all([['National', newsQuery], ...states.map(({ name }) => [name, `"national popular vote" "${name}"`])]
      .map(([name, query]) => poll(`News · ${name}`, rssSearch(query), parseRss))),
    Promise.all(states.map(state => poll(`Change feed · ${state.code}`, `https://api.statescan.org/v1/states/${state.code}/changes.rss`, body =>
      parseRss(body).filter(item => topic.test(item.title)).map(item => ({ ...item, states: [state.code], source: 'StateScan', signal: true }))))),
    Promise.all(states.map(state => poll(`Bill leads · ${state.code}`, `https://www.nationalpopularvote.com/state/${state.code.toLowerCase()}`, body => advocacyCandidates(body, state)))),
    Promise.all([['MI', nextMi], ['PA', nextPa], ['NV', nextNv]].map(([code, url]) =>
      poll(`Official bill search · ${code}`, url, body => searchCandidates(body, code, 2027, url))))
  ])
  const bills = {}
  await Promise.all(states.map(async state => {
    const prior = previous?.bills?.[state.code] ?? state.bills
    const candidates = new Map(prior.map(row => [`${row.session}:${row.id}`, row]))
    const leads = [...(index?.bills ?? []), ...advocate.flat().filter(Boolean), ...officialLeads.flat().filter(Boolean)]
    for (const row of leads.filter(row => row.code === state.code)) {
      const key = `${row.session}:${row.id}`
      if (!candidates.has(key)) candidates.set(key, row)
    }
    bills[state.code] = (await Promise.all([...candidates.values()].map(async row => {
      // Closed seed bills are archival. Existing bills remain monitored across
      // discovery outages, including temporarily inaccessible official pages.
      if (row.stage === 'closed' && row.session < 2027) return row
      const found = await officialBill(row, state, poll)
      if (found && (!row.date || found.date >= row.date)) return found
      return row
    }))).sort((a, b) => b.session - a.session || (b.date ?? '').localeCompare(a.date ?? ''))
  }))
  const stories = [
    ...headlineFeeds.flat().filter(Boolean).map(story => ({
      ...story, states: states.filter(state => new RegExp(`\\b${state.name}\\b`, 'i').test(story.title)).map(state => state.code)
    })),
    ...changeFeeds.flat().filter(Boolean)
  ]
  return { membership, bills, stories, feeds: metrics, wikiRevision: index?.revision ?? previous?.wikiRevision ?? null }
}
