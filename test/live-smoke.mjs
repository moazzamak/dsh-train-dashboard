/**
 * LIVE smoke test: the whole chain, against a real run and a real command.
 *
 * NOT part of `npm test`. It reads your project directory, spawns your
 * snapshot command and fetches both routes, so it is a deliberate, opt-in
 * check run when the machine can afford it.
 *
 * WHAT IT PROVES THAT THE UNIT TESTS CANNOT. The unit tests use a fake context
 * and never run anything, so they cannot tell you that the argv you configured
 * is one your command accepts, that the command writes a snapshot this host can
 * parse, or that real numbers arrive over the real routes. This script wires
 * the plugin to the REAL filesystem, the REAL subprocess (through the same
 * request shape the harness uses) and the REAL snapshot, then fetches both
 * routes and checks the answers.
 *
 * It is read-only with respect to your run: the only file it causes to be
 * written is the snapshot, by your own command.
 *
 * HOW TO RUN IT. Point it at a project and give it the same command the plugin
 * would run, as a JSON array of argv words:
 *
 *   DSH_TRAIN_DASHBOARD_WORKSPACE=/srv/your-project \
 *   DSH_TRAIN_DASHBOARD_COMMAND='["python3","-m","your_project.snapshot_tool","--out","{snapshot}"]' \
 *   node test/live-smoke.mjs
 *
 * Optional: DSH_TRAIN_DASHBOARD_SNAPSHOT (defaults to the plugin's default).
 *
 * With no workspace set it prints what is missing and exits 0, so a fresh
 * clone never carries a red test nobody can satisfy.
 */

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ROUTE, apply } from '../index.mjs'

/** The project directory whose snapshot is charted. Required to actually run. */
const WORKSPACE = process.env.DSH_TRAIN_DASHBOARD_WORKSPACE ?? ''

/** The argv of the snapshot producer, as a JSON array. */
const COMMAND = parseCommand(process.env.DSH_TRAIN_DASHBOARD_COMMAND)

/** Where the producer writes the snapshot, relative to the workspace. */
const SNAPSHOT = process.env.DSH_TRAIN_DASHBOARD_SNAPSHOT ?? 'train-dashboard.snapshot.json'

/** How long to wait for the first snapshot to appear, in milliseconds. */
const SETTLE_MS = 30000

/**
 * Read the command out of the environment.
 *
 * @returns the parsed argv array, or an empty array when it is absent or is
 *   not a JSON array of strings (the plugin refuses those too, and this script
 *   reports it rather than guessing).
 */
function parseCommand(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((word) => String(word)) : []
  } catch (error) {
    return []
  }
}

/** Print a line and stop with a failure when a claim is not met. */
function check(claim, condition, detail = '') {
  if (!condition) {
    console.error(`FAIL  ${claim}${detail ? `\n      ${detail}` : ''}`)
    process.exitCode = 1
    return false
  }
  console.log(`ok    ${claim}${detail ? `\n      ${detail}` : ''}`)
  return true
}

/**
 * A context backed by the real machine.
 *
 * The subprocess shim implements the same request contract the harness's
 * provider does — `{ argv, cwd, stdio }` returning a handle whose `done`
 * resolves with `{ exitCode, signal }` — and deliberately ignores the child's
 * output, because the plugin judges success by the SNAPSHOT rather than by
 * what the command printed.
 */
function liveContext(workspace) {
  const routes = new Map()
  const injections = []
  return {
    fs: {
      async resolve(target, base) {
        const root = base !== undefined && typeof base.cwd === 'string' ? base.cwd : workspace
        return path.isAbsolute(target) ? target : path.resolve(root, target)
      },
      async readText(target) {
        return await readFile(target, 'utf8')
      },
    },
    get(name) {
      if (name !== 'subprocess') return undefined
      return {
        spawn(spec) {
          console.log(`      spawn: ${spec.argv.slice(0, 3).join(' ')} …`)
          const child = spawn(spec.argv[0], spec.argv.slice(1), {
            cwd: spec.cwd,
            // The child's output is not read: the snapshot is the contract.
            stdio: ['ignore', 'ignore', 'ignore'],
          })
          const done = new Promise((resolve) => {
            child.on('error', (error) => resolve({ exitCode: null, signal: null, error }))
            child.on('close', (exitCode, signal) => resolve({ exitCode, signal }))
          })
          return { done, collected: {} }
        },
      }
    },
    effect(fn) { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    inject(services, callback) { injections.push({ services, callback }); return () => {} },
    webServer: { register(route) { routes.set(route.path, route); return () => {} } },
    __routes: routes,
    __injections: injections,
  }
}

/** Call one route and return `{ status, body }`. */
async function fetchRoute(ctx, routePath) {
  const route = ctx.__routes.get(routePath)
  if (route === undefined) throw new Error(`no route at ${routePath}`)
  const captured = { status: 200, body: '' }
  const res = {
    headersSent: false,
    set statusCode(value) { captured.status = value },
    get statusCode() { return captured.status },
    setHeader() {},
    end(body) { captured.body = body ?? ''; this.headersSent = true },
  }
  await route.handler({ method: 'GET', url: routePath, headers: {} }, res)
  return { status: captured.status, body: captured.body === '' ? null : JSON.parse(captured.body) }
}

/** Say what is missing and stop without failing the build. */
function skip(reason) {
  console.log(`SKIPPED live smoke: ${reason}`)
  console.log('Set DSH_TRAIN_DASHBOARD_WORKSPACE (and DSH_TRAIN_DASHBOARD_COMMAND when your')
  console.log('producer is not the default one) to run it; see the header of this file.')
}

async function main() {
  if (WORKSPACE === '') return skip('DSH_TRAIN_DASHBOARD_WORKSPACE is not set')
  if (COMMAND.length === 0) return skip('DSH_TRAIN_DASHBOARD_COMMAND is not a JSON array of argv words')

  const config = {
    workspace: WORKSPACE,
    command: COMMAND,
    snapshotPath: SNAPSHOT,
    refreshSeconds: 1, // force the first poll to be "due", so the spawn is exercised
    timeoutSeconds: 120,
  }

  console.log(`workspace: ${WORKSPACE}`)
  console.log(`command:   ${COMMAND.join(' ')}`)
  const ctx = liveContext(WORKSPACE)
  apply(ctx, config)

  check('the route registration was deferred, not run during apply',
    ctx.__routes.size === 0 && ctx.__injections.length === 1)

  ctx.__injections[0].callback(ctx)
  check('both routes registered once the carrier arrived', ctx.__routes.size === 2,
    [...ctx.__routes.keys()].join(', '))

  // The first poll finds a stale or absent snapshot and so STARTS the real
  // command. It must say so honestly rather than pretend to have data: on a
  // cold start the correct answer is "nothing yet, and I am building one".
  const started = Date.now()
  const cold = await fetchRoute(ctx, `${ROUTE}/state`)
  check('the state route answers 200', cold.status === 200)
  check('this host can rebuild: a command is configured and a provider exists',
    cold.body.canRefresh === true,
    `canRefresh=${cold.body.canRefresh}, reason=${cold.body.reason}`)
  check('a cold first poll reports missing data rather than inventing some',
    cold.body.haveSnapshot === true
      || (cold.body.reason === 'missing' && cold.body.ageSeconds === null),
    `haveSnapshot=${cold.body.haveSnapshot}, reason=${cold.body.reason}, `
    + `refreshing=${cold.body.refreshing}`)
  check('the command the host would run is the one that was configured',
    typeof cold.body.commandHint === 'string' && cold.body.commandHint.includes(COMMAND[0]),
    `commandHint=${cold.body.commandHint}`)

  // Now let it settle: poll until the snapshot the first call started exists.
  let state = cold
  const deadline = Date.now() + SETTLE_MS
  while (state.body.haveSnapshot !== true && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    state = await fetchRoute(ctx, `${ROUTE}/state`)
  }
  check('the snapshot appears once the command has run',
    state.body.haveSnapshot === true && typeof state.body.revision === 'string',
    `revision ${state.body.revision}, age ${state.body.ageSeconds}s, reason ${state.body.reason}`)

  const series = await fetchRoute(ctx, `${ROUTE}/series`)
  check('the series route serves the whole snapshot body', series.status === 200)

  // Every published series must carry at least one usable point: a series of
  // nothing would show as a chip that draws nothing.
  const published = series.body?.series ?? []
  const usable = published.filter((item) => Array.isArray(item.points) && item.points.length > 0)
  check('every published series carries at least one point',
    published.length > 0 && usable.length === published.length,
    `${usable.length}/${published.length} series carry points`)

  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\nwhole chain: ${elapsed}s wall, ${published.length} series, `
    + `${series.body?.counts?.points ?? 'unknown'} points, revision ${series.body?.revision}`)
  console.log(process.exitCode === 1 ? 'LIVE SMOKE FAILED' : 'LIVE SMOKE PASSED')
}

await main()
