import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const source = new URL('../site/', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
const snapshot = JSON.parse(await readFile(new URL('data/snapshot.json', source), 'utf8'))
const revisions = JSON.parse(await readFile(new URL('data/revisions.json', source), 'utf8'))
assert.equal(snapshot.forecast.states.length, 5)
assert.ok(snapshot.forecast.committed > 0)
assert.equal(revisions[0].id, snapshot.revision)
await rm(dist, { recursive: true, force: true })
await cp(source, dist, { recursive: true })
const index = new URL('index.html', dist)
let page = await readFile(index, 'utf8')
for (const asset of ['assets/app.js', 'assets/style.css']) {
  const contents = await readFile(new URL(asset, dist))
  const version = createHash('sha256').update(contents).digest('hex').slice(0, 12)
  page = page.replace(`"./${asset}"`, `"./${asset}?v=${version}"`)
}
await writeFile(index, page)
