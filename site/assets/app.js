const root = document.querySelector('#content')
const status = document.querySelector('#checked')
const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const pct = n => `${Math.round(n * 100)}%`
const pctRange = (lo, hi) => `${pct(lo)}–${pct(hi)}`
const prettyDate = value => value ? fmt.format(new Date(value.slice(0, 10) + 'T12:00:00Z')) : '—'
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const validUrl = value => {
  try { return new URL(value).protocol === 'https:' ? html(value) : '#' } catch { return '#' }
}
const link = (url, label, className = '') => `<a class="${className}" href="${validUrl(url)}" target="_blank" rel="noopener noreferrer">${html(label)} <span aria-hidden="true">↗</span></a>`
const section = (title, text, id) => `<div class="section-head"><div><h2 id="${id}">${title}</h2><p>${text}</p></div></div>`
const billStage = { introduced: 'Introduced / referred', committee: 'Reported from committee', chamber: 'Passed one chamber', both: 'Passed both chambers', signed: 'Signed / chaptered', closed: 'Closed' }

async function json(path) {
  const response = await fetch(path, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Forecast data unavailable')
  return response.json()
}

function render(data, revisions) {
  const f = data.forecast
  const [low, central, high] = f.estimates
  const over = f.committed >= f.threshold
  const gap = Math.max(0, f.threshold - f.committed)
  const lookup = Object.fromEntries(f.states.map(state => [state.code, state]))
  const requiredNames = f.required.map(code => lookup[code].name).join(' and ')
  const thresholdCopy = f.required.length ? `${requiredNames} ${f.required.length === 1 ? 'appears' : 'appear'} in every winning combination at today’s membership.` :
    (over ? 'Current member states already meet the electoral-vote threshold.' : 'The result depends on which states join.')
  const stale = Date.now() - Date.parse(data.checkedAt) > 2.5 * 86_400_000
  status.innerHTML = `<span class="status-dot ${stale ? 'stale' : ''}"></span><span>${stale ? 'Snapshot' : 'Updated'} ${prettyDate(data.today)}</span>`
  root.innerHTML = `
    <section class="hero-grid" aria-label="Forecast overview">
      <article class="card pledge">
        <div class="panel-top"><span class="kicker">ELECTORAL VOTES PLEDGED</span><span class="chip ${over ? 'positive' : ''}">${over ? 'Threshold met' : `${gap} away`}</span></div>
        <div class="pledge-number"><strong>${f.committed}</strong><span> / ${f.threshold}</span></div>
        <div class="tally" role="img" aria-label="${f.committed} pledged of ${f.threshold} needed">
          <div style="width:${Math.min(100, f.committed / f.threshold * 100)}%"></div>
        </div>
        <div class="tally-label"><span><i></i> ${Object.keys(f.members).length} member jurisdictions</span><span>Activation threshold</span></div>
      </article>
      <article class="card forecast">
        <div class="panel-top"><span class="kicker">2028 THRESHOLD FORECAST</span><span class="chip neutral">REV ${data.revision}</span></div>
        <div class="forecast-number">${pct(central.probability)}</div>
        <p>Chance of reaching ${f.threshold} through these five states by the cutoff.</p>
        <div class="forecast-note"><span>${pctRange(low.probability, high.probability)}</span> sensitivity range · <a href="#methodology">How it works</a></div>
      </article>
    </section>

    <section id="states" class="block" aria-labelledby="states-title">
      <div class="section-head"><div><h2 id="states-title">The five states</h2><p>State-by-state odds of joining by July 20, 2028.</p></div><div class="state-key"><i></i> Required in every winning path</div></div>
      <div class="state-table card">
        <div class="state-head"><span>STATE</span><span>2027 BILL STAGE</span><span>ADOPTION ESTIMATE</span><span></span></div>
        ${f.states.map(state => {
          const decisive = f.required.includes(state.code)
          const records = state.bills.filter(bill => bill.stage || bill.discovery)
          return `<details class="state" id="state-${state.code}">
            <summary>
              <div class="state-title"><span class="state-code ${decisive ? 'key' : ''}">${state.code}</span><span><strong>${html(state.name)}</strong><small>${state.votes} electoral votes${decisive ? ' · Required' : ''}</small></span></div>
              <div class="state-stage"><strong>${html(state.stage)}</strong><small>${html(state.active?.id ?? state.label)}</small></div>
              <div class="state-p"><span class="mini-track" aria-hidden="true"><span style="width:${pct(state.estimate)}%"></span></span><strong>${pct(state.estimate)}</strong></div>
              <span class="chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="state-detail">
              <div><p>${html(state.summary)}</p><p><strong>What to watch</strong><br>${html(state.watch)}</p><p class="muted">Sensitivity range ${pctRange(...state.range)} · ${html(state.changed)} · Governor ${html(state.governor)}</p></div>
              <div><div class="kicker">LEGISLATIVE RECORD</div>
              <ul class="record">${records.map(bill => `<li>${link(bill.url, bill.id)} <span>${html(billStage[bill.stage] ?? 'Filing lead · stage unverified')}${bill.date ? ` · ${prettyDate(bill.date)}` : ''}</span></li>`).join('')}</ul>
              <div class="kicker">FORECAST SIGNALS</div><ul class="record">${state.signals.map(signal => `<li>${link(signal.url, signal.label)}</li>`).join('')}</ul></div>
            </div>
          </details>`
        }).join('')}
      </div>
    </section>

    <section class="block" id="scenarios" aria-labelledby="scenario-title">
      ${section('Build a path to 270', html(thresholdCopy), 'scenario-title')}
      <div class="scenario-grid">
        <article class="card simulator">
          <div class="panel-top"><h3>Electoral vote calculator</h3><button type="button" id="clear" class="quiet">Clear selection</button></div>
          <p class="muted">Choose which states join.</p>
          <fieldset id="choices"><legend class="sr-only">Potential new compact members</legend>
          ${f.states.map(state => `<label class="pick"><input type="checkbox" value="${state.code}" ${state.isMember ? 'checked disabled' : ''}><span>${html(state.code)}</span><small>${state.isMember ? 'Member' : `+${state.votes}`}</small></label>`).join('')}
          </fieldset>
          <div class="scenario-result" aria-live="polite"><div><strong id="scenario-total">${f.committed}</strong> <span>electoral votes</span></div><span id="scenario-label" class="chip"></span></div>
          <p id="scenario-help" class="muted"></p>
        </article>
        <article class="card paths">
          <div class="panel-top"><h3>Minimum winning paths</h3></div>
          <p class="muted">Select a path to load it into the calculator.</p>
          ${over ? '<p>The threshold is already met.</p>' : f.minimumPaths.length ?
            f.minimumPaths.map(path => `<button type="button" class="path" data-codes="${path.joins.join(',')}"><span>${path.joins.map(code => `<b class="${f.required.includes(code) ? 'path-key' : ''}">${code}</b>`).join('<i>+</i>')}</span><strong>${path.total} <small>EV</small></strong><span aria-hidden="true">↗</span></button>`).join('') :
            '<p>The five states alone cannot reach the threshold.</p>'}
        </article>
      </div>
    </section>

    <section class="block" id="evidence" aria-labelledby="evidence-title">
      ${section('Evidence & revisions', 'Source links, legislative signals and the forecast’s revision history.', 'evidence-title')}
      <div class="evidence-grid">
        <article class="card evidence-card">
          <div class="panel-top"><h3>Latest coverage</h3><span class="chip neutral">${data.review.status === 'ok' ? 'AI TRIAGE' : 'SOURCE FEED'}</span></div>
          <div id="filters" aria-label="Filter coverage">
            <button class="filter" type="button" aria-pressed="true" data-filter="all">All</button>
            ${f.states.map(state => `<button class="filter" type="button" aria-pressed="false" data-filter="${state.code}">${state.code}</button>`).join('')}
          </div>
          <div id="news" aria-live="polite"></div>
        </article>
        <article class="card evidence-card">
          <div class="panel-top"><h3>Forecast revisions</h3><a href="./data/revisions.json" class="quiet">Download JSON ↓</a></div>
          <div class="revisions">${revisions.slice(0, 12).map(rev => `
            <details class="rev" ${rev.id === data.revision ? 'open' : ''}><summary><span>Revision ${rev.id} <small> · ${prettyDate(rev.date)}</small></span><strong>${rev.estimate}%</strong></summary><ul>${rev.changes.map(change => `<li>${html(change)}</li>`).join('')}</ul></details>`).join('')}</div>
          <div class="legal"><div class="kicker">IMPLEMENTATION</div><p>The forecast measures whether membership reaches 270 by the cutoff. Congressional consent, court challenges and election administration could affect use in 2028.</p>${link(data.links.legal, 'Congressional Research Service')}</div>
        </article>
      </div>
    </section>

    <section class="block" id="methodology" aria-labelledby="method-title">
      ${section('How the forecast works', 'A historical starting point, updated with new legislative evidence.', 'method-title')}
      <div class="card method">
        <div class="method-intro">
          <div><h3>Prior and revisions</h3><p>The baseline covers ${f.backtest.joined + f.backtest.missed} previously nonmember states that gained Democratic trifectas in the 2018, 2019 and 2022 elections. ${f.backtest.joined} enacted the compact during the next two calendar years. With one prior success and one failure, the starting estimate is ${pct(f.backtest.probability)}.</p><p>Verified bill stages, sourced governor or leadership positions, and time left to act affect each state estimate. The model enumerates all combinations and averages over three shared political climates.</p></div>
          <div><h3>Uncertainty and validation</h3><p>The range shows what happens when all pending states face weaker or stronger adoption conditions. The historical baseline’s leave-one-election-out Brier score is ${f.backtest.brier.toFixed(3)} across ${f.backtest.joined + f.backtest.missed} cases. The full five-state forecast has limited validation and no resolved 2028 outcomes.</p><p>OpenCode Go triages headlines using DeepSeek V4.1 Flash. Forecast revisions use verified bill records and documented assumptions.</p></div>
        </div>
        <details><summary>Historical cohorts</summary><ul class="cohorts">${f.backtest.cohorts.map(cohort => `<li>${link(cohort.source, `${cohort.year} election`)} · Enacted: ${html(cohort.joined.join(', ') || 'none')} · No enactment: ${html(cohort.missed.join(', '))}</li>`).join('')}</ul></details>
        <details><summary>Member states · ${f.committed} electoral votes</summary><ul class="member-list">${Object.entries(f.members).sort(([a], [b]) => a.localeCompare(b)).map(([name, joined]) => `<li><span>${html(name)}</span><small>${joined}</small></li>`).join('')}</ul></details>
        <details><summary>Source checks · ${Object.values(data.feeds).filter(feed => feed.status === 'ok').length}/${Object.keys(data.feeds).length} available</summary><ul class="feeds">${Object.entries(data.feeds).map(([name, feed]) => `<li>${link(feed.url, name)}<span>${feed.status === 'ok' ? 'Checked' : 'Unavailable'} · ${prettyDate(feed.lastSuccess)}</span></li>`).join('')}</ul></details>
        <div class="source-links">${link(data.links.membership, 'Membership')}${link(data.links.allocation, 'Electoral votes')}${link(data.links.election, '2026 results')}${link(data.links.compact, 'Compact text')}${link(data.links.video, 'Video brief')}</div>
      </div>
    </section>`

  const inputs = [...document.querySelectorAll('#choices input')]
  const totalDisplay = document.querySelector('#scenario-total')
  const result = document.querySelector('#scenario-label')
  const help = document.querySelector('#scenario-help')
  const paths = [...document.querySelectorAll('.path')]
  function updateScenario() {
    const picks = inputs.filter(input => input.checked && !input.disabled).map(input => input.value)
    const total = f.committed + picks.reduce((sum, code) => sum + lookup[code].votes, 0)
    totalDisplay.textContent = total
    result.textContent = total >= f.threshold ? 'Threshold met' : `${f.threshold - total} short`
    result.classList.toggle('positive', total >= f.threshold)
    help.textContent = total >= f.threshold ? `${total - f.threshold} electoral votes above the threshold.` :
      `The selected states add ${total - f.committed} to the current ${f.committed}.`
    for (const path of paths) {
      const pathCodes = path.dataset.codes.split(',')
      path.setAttribute('aria-pressed', String(pathCodes.length === picks.length && pathCodes.every(code => picks.includes(code))))
    }
  }
  function select(codes) {
    for (const input of inputs) if (!input.disabled) input.checked = codes.includes(input.value)
    updateScenario()
  }
  document.querySelector('#choices').addEventListener('change', updateScenario)
  document.querySelector('#clear').addEventListener('click', () => select([]))
  for (const path of paths) path.addEventListener('click', () => select(path.dataset.codes.split(',')))
  updateScenario()

  const feed = document.querySelector('#news')
  const filters = [...document.querySelectorAll('.filter')]
  const reviewed = data.review.items ?? {}
  function drawNews(code) {
    const stories = data.news.map(story => ({ ...story, ...reviewed[story.id] }))
      .filter(story => (code === 'all' || story.states?.includes(code)))
      .sort((a, b) => Number(Boolean(b.tag || b.signal)) - Number(Boolean(a.tag || a.signal)) || b.date.localeCompare(a.date))
      .slice(0, 6)
    feed.innerHTML = stories.map(story => `<div class="story"><div><time datetime="${html(story.date)}">${prettyDate(story.date)}</time><span>${html(story.source)}${story.tag ? ` · ${html(story.tag)}` : ''}</span></div>${link(story.url, story.title)}</div>`).join('') ||
      '<p class="muted empty">No state-specific coverage in the current snapshot.</p>'
  }
  for (const button of filters) button.addEventListener('click', () => {
    for (const other of filters) other.setAttribute('aria-pressed', String(button === other))
    drawNews(button.dataset.filter)
  })
  drawNews('all')
  if (location.hash.startsWith('#state-')) {
    const state = document.getElementById(location.hash.slice(1))
    if (state) { state.open = true; state.scrollIntoView() }
  }
}

Promise.all([json('./data/snapshot.json'), json('./data/revisions.json')])
  .then(([data, revisions]) => render(data, revisions))
  .catch(() => {
    status.textContent = 'Forecast unavailable'
    root.innerHTML = '<p class="notice">The forecast could not load. <a href="./data/snapshot.json">Open the latest snapshot</a>.</p>'
  })
