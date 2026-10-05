/**
 * Tests for the HOST half of `dsh-train-dashboard`.
 *
 * WHAT THESE ARE FOR. This half has three failure modes that a running GUI
 * cannot show you, because in all three the tab looks fine or empty rather
 * than wrong:
 *
 *   1. THE ROUTE NEVER REGISTERS. Reading the browser carrier during `apply`
 *      sees `undefined`, and Cordis resolves an absent injected service
 *      leniently, so the plugin loads, the tab opens, and every fetch 404s.
 *      The working reference plugin in this project lost its route exactly
 *      that way. The first two tests pin the deferred form.
 *   2. THE READ PATH LIES ABOUT FRESHNESS. A snapshot that is missing, stale
 *      or mid-write must be reported as one of those, not as a zero. A tab
 *      showing "0s old" over an empty chart is worse than one showing nothing.
 *   3. THE SPAWN IS UNBOUNDED. This can run beside a training job, so the
 *      regeneration must not fire when the snapshot is fresh, must not stack
 *      when several polls arrive at once, and must run exactly the command the
 *      reader configured — no more and no fewer words than they wrote.
 *
 * The fake context below is small on purpose: it implements exactly the
 * services this plugin declares, so a test cannot pass against a richer seam
 * than the plugin really gets.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ROUTE,
  SNAPSHOT_VERSION,
  apply,
  hasCommand,
  inject,
  normalizeConfig,
  snapshotArgv,
} from '../index.mjs'

/** A snapshot body shaped like a producer's, with one series. */
function snapshotBody(overrides = {}) {
  return {
    snapshot_version: SNAPSHOT_VERSION,
    generated_at: new Date().toISOString(),
    arm: 'run-a',
    break_leg: 120,
    revision: 'abc123',
    sources: 'fixture',
    counts: { points: 2 },
    series: [{ tag: 'train/loss', source: 'metrics.jsonl', points: [[1, 3.2], [2, 3.0]] }],
    annotations: [],
    ...overrides,
  }
}

/** A configured command, in the placeholder form the README documents. */
const COMMAND = ['python3', '-m', 'your_project.snapshot_tool', '--out', '{snapshot}']

/**
 * A context with only the services this plugin uses.
 *
 * `readText` is a stub the caller replaces; `spawn` records its argv so a test
 * can assert what would have run without running it.
 */
function fakeContext({ text = null, readError = null, hasSubprocess = true } = {}) {
  const routes = new Map()
  const injected = []
  const spawned = []
  const ctx = {
    fs: {
      async resolve(path) { return `/workspace/${path}` },
      async readText() {
        if (readError !== null) throw new Error(readError)
        if (text === null) throw new Error('ENOENT')
        return typeof text === 'function' ? text() : text
      },
    },
    get(name) {
      if (name === 'subprocess') {
        if (!hasSubprocess) return undefined
        return {
          spawn(spec) {
            spawned.push(spec)
            return {
              done: Promise.resolve({ exitCode: 0, signal: null }),
              collected: { stdout: { readFrom: () => '' }, stderr: { readFrom: () => '' } },
            }
          },
        }
      }
      return undefined
    },
    effect(fn) { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    inject(services, callback) { injected.push({ services, callback }); return () => {} },
    webServer: {
      register(route) { routes.set(route.path, route); return () => {} },
    },
    __routes: routes,
    __injected: injected,
    __spawned: spawned,
  }
  return ctx
}

/** Call one registered route and read the answer it produced. */
async function callRoute(ctx, path) {
  const route = ctx.__routes.get(path)
  assert.ok(route, `no route registered at ${path}`)
  const captured = { status: 200, headers: {}, body: '' }
  const res = {
    headersSent: false,
    set statusCode(value) { captured.status = value },
    get statusCode() { return captured.status },
    setHeader(name, value) { captured.headers[name] = value },
    end(body) { captured.body = body ?? ''; this.headersSent = true },
  }
  await route.handler({ method: 'GET', url: path, headers: {} }, res)
  return { status: captured.status, body: captured.body === '' ? null : JSON.parse(captured.body) }
}

// ---------------------------------------------------------------------------
// The deferred registration: the defect that silently 404s a working plugin.
// ---------------------------------------------------------------------------

test('apply does not touch the browser carrier synchronously', () => {
  const ctx = fakeContext()
  apply(ctx, { workspace: '/workspace' })

  assert.deepEqual(ctx.__routes.size, 0,
    'a route was registered during apply; the carrier is not there yet and '
    + 'reading it now sees undefined')
  const asked = ctx.__injected.map((entry) => entry.services)
  assert.deepEqual(asked, [['webServer']],
    'the carrier must be requested through ctx.inject so a profile without one '
    + 'still loads this row')
})

test('the routes register when the carrier arrives and not before', () => {
  const ctx = fakeContext()
  apply(ctx, { workspace: '/workspace' })

  ctx.__injected[0].callback(ctx)

  assert.deepEqual([...ctx.__routes.keys()].sort(), [`${ROUTE}/series`, `${ROUTE}/state`])
})

test('a profile with no webServer never runs the registration callback', () => {
  const ctx = fakeContext()
  apply(ctx, { workspace: '/workspace' })
  // Nothing calls the callback: this is the headless / SDK / ACP shape.
  assert.equal(ctx.__routes.size, 0)
  assert.deepEqual(inject, ['fs'])
})

// ---------------------------------------------------------------------------
// Config and the argv that runs beside a live training leg.
// ---------------------------------------------------------------------------

test('config defaults are filled and numbers are coerced', () => {
  const config = normalizeConfig({ workspace: '/srv/my-run', refreshSeconds: '45' })
  assert.equal(config.refreshSeconds, 45)
  assert.equal(config.snapshotPath, 'train-dashboard.snapshot.json')
  assert.equal(config.arm, '')
  assert.equal(config.timeoutSeconds, 120)
})

test('a nonsense refresh interval falls back rather than disabling refresh', () => {
  assert.equal(normalizeConfig({ refreshSeconds: 0 }).refreshSeconds, 30)
  assert.equal(normalizeConfig({ refreshSeconds: 'soon' }).refreshSeconds, 30)
  assert.equal(normalizeConfig({}).timeoutSeconds, 120)
})

test('an unconfigured plugin has no command, and says so instead of spawning one', () => {
  const config = normalizeConfig({ workspace: '/srv/my-run' })
  assert.deepEqual(snapshotArgv(config), [], 'nothing may be run by default')
  assert.equal(hasCommand(config), false)
})

test('the configured command runs word for word, with the placeholders filled', () => {
  const config = normalizeConfig({
    workspace: '/srv/my-run',
    snapshotPath: 'out/snapshot.json',
    command: COMMAND,
  })

  assert.deepEqual(snapshotArgv(config),
    ['python3', '-m', 'your_project.snapshot_tool', '--out', 'out/snapshot.json'])
  assert.equal(hasCommand(config), true)
})

test('a producer can pass its own config keys through as placeholders', () => {
  const config = normalizeConfig({
    workspace: '/srv/my-run',
    snapshotPath: 'snapshot.json',
    command: ['my-tool', '--logs', '{logsDir}', '--run-name', '{arm}', '--out', '{snapshot}'],
    logsDir: 'logs/train',
    arm: 'run-a',
  })

  assert.deepEqual(snapshotArgv(config),
    ['my-tool', '--logs', 'logs/train', '--run-name', 'run-a', '--out', 'snapshot.json'])
})

test('an unknown placeholder is left visible rather than becoming an empty word', () => {
  const argv = snapshotArgv(normalizeConfig({ command: ['my-tool', '--out', '{snapsho}'] }))
  assert.deepEqual(argv, ['my-tool', '--out', '{snapsho}'],
    'a typo must show up in the command the tab prints, not silently blank an argument')
})

test('a command that is not an array is refused, not split on whitespace', () => {
  // There is no shell here, and a hand-written splitter gets quoting wrong on
  // the first path that contains a space. The fix is in the message the tab
  // shows: `command` is an array of argv words.
  const config = normalizeConfig({ command: 'python3 -m my_tool --out {snapshot}' })
  assert.deepEqual(snapshotArgv(config), [])
  assert.equal(hasCommand(config), false)
})

// ---------------------------------------------------------------------------
// The read path: freshness must be reported, not guessed.
// ---------------------------------------------------------------------------

test('state reports a missing snapshot as missing, not as zero', async () => {
  const ctx = fakeContext({ readError: 'ENOENT' })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.status, 200)
  assert.equal(answer.body.haveSnapshot, false)
  assert.equal(answer.body.ageSeconds, null,
    'a zero age on a dashboard with no data reads as fresh')
  assert.equal(answer.body.stale, true)
  assert.match(answer.body.error, /no snapshot/)
})

test('state serves a fresh snapshot with its real age', async () => {
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody()) })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.body.haveSnapshot, true)
  assert.equal(answer.body.revision, 'abc123')
  assert.equal(answer.body.stale, false)
  assert.ok(answer.body.ageSeconds <= 2, `age was ${answer.body.ageSeconds}`)
})

test('a producer that omits a revision gets its timestamp as one', async () => {
  // The client fetches the (large) series body only when the revision moves,
  // so a snapshot with no revision at all would show KPIs over an empty chart.
  const stamp = new Date().toISOString()
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody({ revision: undefined, generated_at: stamp })) })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.body.revision, stamp)
  assert.equal(answer.body.generatedAt, stamp)
})

test('an old snapshot is reported stale and keeps its age', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody({ generated_at: old })) })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)
  assert.equal(answer.body.stale, true)
  assert.ok(answer.body.ageSeconds >= 590, `age was ${answer.body.ageSeconds}`)
})

test('a snapshot from a different contract version is refused, not misread', async () => {
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody({ snapshot_version: 99 })) })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)
  assert.equal(answer.body.haveSnapshot, false)
  assert.match(answer.body.error, /snapshot_version 99/)
  assert.equal(answer.body.reason, 'unusable',
    'a readable-but-wrong snapshot is not the same as a missing one: the client '
    + 'must not offer to rebuild what rebuilding will not fix')
})

test('a missing snapshot is labelled missing so the client can offer to build one', async () => {
  const ctx = fakeContext({ readError: 'ENOENT' })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)
  assert.equal(answer.body.reason, 'missing')
})

test('a half-written snapshot does not blank a tab that was working', async () => {
  // A torn write is normal here: the producer writes while this reads. The
  // first read works, the second is garbage, and the tab must keep the good
  // numbers with their age rather than showing an empty chart.
  let body = JSON.stringify(snapshotBody())
  const ctx = fakeContext({ text: () => body })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const first = await callRoute(ctx, `${ROUTE}/state`)
  assert.equal(first.body.haveSnapshot, true)

  body = '{"snapshot_version": 1, "series": [{"tag": "train/bp'
  const second = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(second.body.haveSnapshot, true, 'the last good snapshot was dropped')
  assert.equal(second.body.revision, 'abc123')
  assert.ok(second.body.ageSeconds !== null, 'the kept snapshot must still carry its age')
})

test('series answers 503 and says what to do when there is nothing yet', async () => {
  const ctx = fakeContext({ readError: 'ENOENT' })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/series`)

  assert.equal(answer.status, 503)
  assert.equal(answer.body.canRefresh, true)
  assert.ok(answer.body.refreshSeconds > 0)
})

test('series hands over the whole snapshot body', async () => {
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody()) })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/series`)
  assert.equal(answer.status, 200)
  assert.equal(answer.body.series[0].tag, 'train/loss')
  assert.equal(answer.body.break_leg, 120)
})

test('a non-GET request is refused with 405 rather than served', async () => {
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody()) })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const route = ctx.__routes.get(`${ROUTE}/state`)
  const captured = { status: 200, headers: {} }
  const res = {
    headersSent: false,
    set statusCode(value) { captured.status = value },
    get statusCode() { return captured.status },
    setHeader(name, value) { captured.headers[name] = value },
    end() { this.headersSent = true },
  }
  await route.handler({ method: 'POST', url: `${ROUTE}/state`, headers: {} }, res)

  assert.equal(captured.status, 405)
  assert.equal(captured.headers.allow, 'GET')
})

// ---------------------------------------------------------------------------
// The spawn: bounded, single-flight, and only when it is due.
// ---------------------------------------------------------------------------

test('a fresh snapshot does not spawn the command', async () => {
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody()) })
  apply(ctx, { workspace: '/workspace', command: COMMAND, refreshSeconds: 30 })
  ctx.__injected[0].callback(ctx)

  await callRoute(ctx, `${ROUTE}/state`)

  assert.deepEqual(ctx.__spawned, [],
    'a fresh snapshot must cost no process while a training job is running')
})

test('a stale snapshot triggers exactly one spawn even under a poll burst', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody({ generated_at: old })) })
  apply(ctx, { workspace: '/workspace', command: COMMAND, refreshSeconds: 30 })
  ctx.__injected[0].callback(ctx)

  await Promise.all([
    callRoute(ctx, `${ROUTE}/state`),
    callRoute(ctx, `${ROUTE}/state`),
    callRoute(ctx, `${ROUTE}/state`),
  ])

  assert.equal(ctx.__spawned.length, 1,
    'concurrent polls started more than one regeneration')
  assert.deepEqual(ctx.__spawned[0].argv,
    ['python3', '-m', 'your_project.snapshot_tool', '--out', 'train-dashboard.snapshot.json'],
    'the spawn must run the configured command with the placeholders resolved')
})

test('an old snapshot with no command configured is served but never refreshed', async () => {
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const ctx = fakeContext({ text: JSON.stringify(snapshotBody({ generated_at: old })) })
  apply(ctx, { workspace: '/workspace', refreshSeconds: 30 })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.deepEqual(ctx.__spawned, [], 'an empty argv must never reach the provider')
  assert.equal(answer.body.canRefresh, false)
  assert.equal(answer.body.haveSnapshot, true,
    'numbers that exist are still shown, however old, with their true age')
  assert.equal(answer.body.commandHint, null)
})

test('a host with no snapshot and no command says "unconfigured", not "missing"', async () => {
  const ctx = fakeContext({ readError: 'ENOENT' })
  apply(ctx, { workspace: '/workspace' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.body.reason, 'unconfigured',
    'the client chooses its message from this code, and "missing" would offer a '
    + 'rebuild that this host has no way to perform')
  assert.match(answer.body.error, /no command is configured/)
  assert.equal(answer.body.canRefresh, false)
  assert.deepEqual(ctx.__spawned, [])
})

test('the state route hands the client the exact command a rebuild would run', async () => {
  const ctx = fakeContext({ readError: 'ENOENT' })
  apply(ctx, { workspace: '/workspace', command: COMMAND, snapshotPath: 'out/snapshot.json' })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.body.reason, 'missing')
  assert.equal(answer.body.commandHint,
    'python3 -m your_project.snapshot_tool --out out/snapshot.json')
})

test('state says whether this profile can rebuild at all', async () => {
  const ctx = fakeContext({ readError: 'ENOENT', hasSubprocess: false })
  apply(ctx, { workspace: '/workspace', command: COMMAND })
  ctx.__injected[0].callback(ctx)

  const answer = await callRoute(ctx, `${ROUTE}/state`)

  assert.equal(answer.body.canRefresh, false,
    'the tab must be able to tell "waiting" apart from "nobody will ever build this"')
  assert.deepEqual(ctx.__spawned, [], 'no subprocess provider, so nothing may be spawned')
})
