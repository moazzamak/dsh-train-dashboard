/**
 * Host half of `dsh-train-dashboard`: the two browser routes the client half
 * reads, over a JSON snapshot of a training run.
 *
 * WHAT THIS PLUGIN IS, AND WHAT IT IS NOT. It does not read your training
 * logs, and it does not know what a leg, a loss or a learning rate is. Your
 * numbers live wherever your run puts them — a metrics JSONL, one log per
 * step, a console transcript, an evaluation report — and getting them out
 * needs whatever parsing your project needs. So this half runs a command YOU
 * configure; that command writes one JSON file in the documented shape (see
 * README.md, "The snapshot contract"); this half reads the file and serves
 * it. One producer, two views: a parser re-implemented here would be free to
 * disagree with yours, and then the tab and your record would tell different
 * stories about one run with nothing on screen saying which is wrong.
 *
 * FOUR RULES, EACH LEARNED FROM A DEFECT A PLUGIN IN THIS HARNESS HAS
 * ALREADY PAID FOR (`dsh-knowledge-dag`, a sibling plugin, records the first
 * three in its own header):
 *
 * - ONE row in the patch. The boot audit fails on any entry left pending, so a
 *   second row that waits for the browser carrier breaks the headless, SDK and
 *   ACP profiles, which never have one.
 * - NO `ctx.shell`. This desktop profile mounts no shell-executor row, and
 *   Cordis resolves an absent injected service LENIENTLY, so a shell call
 *   registers fine and fails only on first use. Everything here uses `ctx.fs`
 *   to read and `ctx.subprocess` to spawn, and the spawn is guarded.
 * - DO NOT read the browser carrier during `apply`. Reading it there sees
 *   `undefined`; that is the bug that made a sibling plugin's route silently
 *   never register. The deferred form is `ctx.inject(['webServer'], cb)`.
 * - DO NOT export a `Config` class. Cordis's `resolveConfig` reads an exported
 *   `Config` as a schema and calls `Config['~standard'].validate` on it
 *   unconditionally, so the fiber dies at boot with no routes and the browser
 *   gets 404s that look like a missing snapshot. `normalizeConfig` below is a
 *   plain function for that reason, and the name is deliberately not `Config`.
 *
 * Route handlers speak RAW Node req/res — the carrier's only contract
 * (`req.method`, `req.url`, `res.statusCode`, `res.setHeader`, `res.end`).
 * Express-style `request.query` / `response.status().json()` do not exist here
 * and throw on first call.
 *
 * READ-ONLY WITH RESPECT TO YOUR RUN. This half never writes into your run
 * directory, and the only file it causes to be written is the snapshot itself,
 * by your command. What that command does to your run's files is yours to
 * decide: if it must not rewrite something a running tool is serving, give it
 * a read-only flag (the example in README.md does exactly that).
 *
 * Plain JavaScript, no build step, so a direct install works.
 *
 * @module dsh-train-dashboard
 */

export const name = 'train-dashboard'

/** `fs` is the read seam. `webServer` and `subprocess` are deferred: see apply. */
export const inject = ['fs']

/** The route prefix. Must match client.cjs. */
export const ROUTE = '/dsh-train-dashboard'

/** The snapshot contract version this half understands. */
export const SNAPSHOT_VERSION = 1

/** Hard ceiling on a snapshot we will parse, so a runaway file cannot wedge us. */
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024

/**
 * Defaults for the row's config.
 *
 * They are placeholders and not a working setup: no plugin can guess the
 * command that produces YOUR snapshot, so `command` starts empty and the tab
 * says a command has to be configured rather than spawning something that is
 * not there.
 *
 * The patch beside this file restates them, because a row's `config` is
 * REPLACED wholesale by a higher patch layer and never deep-merged: a profile
 * that overrides this row must restate every key it cares about.
 */
const DEFAULTS = {
  workspace: '',
  command: [],
  snapshotPath: 'train-dashboard.snapshot.json',
  arm: '',
  refreshSeconds: 30,
  timeoutSeconds: 120,
}

/** Shown when nothing can be built because no command was configured. */
const NO_COMMAND_MESSAGE = 'no command is configured, so this host cannot build a snapshot; '
  + 'set `command` in this plugin\'s row config to the argv of a program that writes one '
  + '(see README.md, "The snapshot contract")'

/**
 * Normalize a row's config into the shape this half uses.
 *
 * Deliberately NOT named `Config`: see the module header. An exported `Config`
 * class is read by Cordis as a schema and kills the fiber at boot.
 *
 * Keys this function does not know are KEPT, not dropped: `command` refers to
 * them by name (`{logsDir}`, `{arm}`, anything), which is how one generic
 * plugin drives an arbitrary producer.
 *
 * @param raw - the row's config object, already validated by Cordis.
 * @returns a plain settings object with numbers coerced and defaults filled.
 */
export function normalizeConfig(raw) {
  const config = { ...DEFAULTS, ...(raw ?? {}) }
  const refresh = Number(config.refreshSeconds)
  const timeout = Number(config.timeoutSeconds)
  return {
    ...config,
    workspace: String(config.workspace ?? ''),
    // An ARRAY of argv words, never a shell string: there is no shell in this
    // process, and a hand-written splitter gets quoting wrong on the first
    // path that contains a space.
    command: Array.isArray(config.command) ? config.command.map((word) => String(word)) : [],
    snapshotPath: String(config.snapshotPath ?? DEFAULTS.snapshotPath),
    arm: String(config.arm ?? DEFAULTS.arm),
    refreshSeconds: Number.isFinite(refresh) && refresh > 0 ? refresh : DEFAULTS.refreshSeconds,
    timeoutSeconds: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULTS.timeoutSeconds,
  }
}

/**
 * Fill in the `{placeholders}` of one argv word.
 *
 * `{snapshot}` is the configured snapshot path and `{workspace}` the
 * workspace; any other `{name}` resolves to a config key of that name, so a
 * producer that needs its own arguments declares them as config keys and
 * refers to them here.
 *
 * An unknown placeholder is left AS WRITTEN rather than blanked, so a typo
 * shows up in the command the tab prints instead of quietly becoming an empty
 * argument that the producer reads as "no value".
 *
 * @returns the word with every known placeholder substituted.
 */
function substitutePlaceholders(word, config) {
  return word.replace(/\{([A-Za-z0-9_.-]+)\}/g, (whole, key) => {
    if (key === 'snapshot') return String(config.snapshotPath)
    if (key === 'workspace') return String(config.workspace)
    if (Object.prototype.hasOwnProperty.call(config, key)) return String(config[key])
    return whole
  })
}

/** The argv one regeneration runs, with placeholders resolved. Exported so a test can assert it exactly. */
export function snapshotArgv(config) {
  const template = Array.isArray(config.command) ? config.command : []
  return template.map((word) => substitutePlaceholders(String(word), config))
}

/**
 * Whether a command is configured at all.
 *
 * The tab must be able to tell "waiting for the next tick" apart from "nobody
 * will ever produce this", and an unconfigured plugin is the second case: it
 * says so instead of spawning an empty argv.
 *
 * @returns true when `snapshotArgv` would run at least one word.
 */
export function hasCommand(config) {
  return snapshotArgv(config).length > 0
}

/** The GET-only guard every route shares. */
function getOnly(req, res) {
  if (req.method === 'GET') return false
  res.statusCode = 405
  res.setHeader('allow', 'GET')
  res.end()
  return true
}

/** Send one JSON body with the headers a browser poll needs. */
function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(text)
}

/** A route handler threw: answer, log, and never take the host down with it. */
function sendFailure(res, error) {
  const message = error instanceof Error ? error.message : String(error)
  if (!res.headersSent) sendJson(res, 500, { ok: false, error: message })
  else res.end()
}

/**
 * Per-snapshot state this host keeps in memory.
 *
 * `lastGood` is the part that makes the tab robust: the run directory is being
 * written continuously while this reads it, so a torn or momentarily invalid
 * snapshot is NORMAL rather than exceptional. Keeping the last snapshot that
 * parsed means a bad read shows a slightly older number with its age attached,
 * instead of an empty chart that sends someone hunting for a fault that is not
 * there.
 */
function createState() {
  return { lastGood: null, refreshing: null, lastAttemptMs: 0, lastError: null }
}

/**
 * Read and parse the snapshot through the filesystem seam.
 *
 * `reason` is a CODE and not a phrase, because the client has to choose
 * between different offers: "there is nothing here, let me build one",
 * "something is here but I cannot read it, and rebuilding may not help" and
 * (added by the route) "no command is configured, so nothing will build one".
 * A client that had to pattern-match the message would get that wrong the
 * first time the wording changed.
 *
 * @returns `{ payload, bytes, error, reason }` where `reason` is one of
 *   `'ok'`, `'missing'` (nothing usable; building one should fix it) or
 *   `'unusable'` (something is there and this plugin cannot read it).
 */
async function readSnapshot(ctx, config) {
  let resolved
  try {
    resolved = await ctx.fs.resolve(config.snapshotPath, { cwd: config.workspace })
  } catch (error) {
    return { payload: null, bytes: 0, reason: 'missing', error: `cannot resolve ${config.snapshotPath}` }
  }
  let text
  try {
    text = await ctx.fs.readText(resolved)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { payload: null, bytes: 0, reason: 'missing', error: `no snapshot at ${resolved} (${message})` }
  }
  if (typeof text !== 'string' || text.length === 0) {
    return { payload: null, bytes: 0, reason: 'missing', error: `snapshot at ${resolved} is empty` }
  }
  if (text.length > MAX_SNAPSHOT_BYTES) {
    return { payload: null, bytes: text.length, reason: 'unusable', error: 'snapshot is implausibly large' }
  }
  try {
    const payload = JSON.parse(text)
    if (payload === null || typeof payload !== 'object') {
      return { payload: null, bytes: text.length, reason: 'unusable', error: 'snapshot is not an object' }
    }
    if (payload.snapshot_version !== SNAPSHOT_VERSION) {
      return {
        payload: null,
        bytes: text.length,
        reason: 'unusable',
        error: `snapshot_version ${payload.snapshot_version} is not ${SNAPSHOT_VERSION}; `
          + 'update the plugin or the producer so both speak the same contract',
      }
    }
    return { payload, bytes: text.length, reason: 'ok', error: null }
  } catch (error) {
    // A snapshot caught mid-replace, or one truncated by a full disk. A
    // producer that writes temp-file-plus-rename makes this rare; it is
    // handled anyway because "should be rare" is how the exception gets
    // promoted to the only case anyone sees.
    return {
      payload: null,
      bytes: text.length,
      reason: 'unusable',
      error: 'snapshot is present but not valid JSON',
    }
  }
}

/** Age of a snapshot in seconds, from its own `generated_at`, else Infinity. */
function ageSecondsOf(payload) {
  const stamp = payload?.generated_at
  if (typeof stamp !== 'string') return Number.POSITIVE_INFINITY
  const parsed = Date.parse(stamp)
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, (Date.now() - parsed) / 1000)
}

/** Whatever text a collected reader holds, defensively; '' when unavailable. */
function collectedText(handle, stream) {
  try {
    const reader = handle?.collected?.[stream]
    if (reader === undefined) return ''
    const result = reader.readFrom(0)
    if (typeof result === 'string') return result
    if (result !== null && typeof result === 'object') {
      if (typeof result.text === 'string') return result.text
      if (typeof result.value === 'string') return result.value
    }
    return ''
  } catch (error) {
    return ''
  }
}

/**
 * Run one regeneration of the snapshot, out of process.
 *
 * Success is judged by the SNAPSHOT, not by the exit code: the tab's question
 * is "are there fresh numbers", and a tool that exited zero while writing a
 * file the reader cannot parse has not answered it. The exit facts are still
 * reported, because they are what tells a reader whether the tool ran at all.
 *
 * @returns `{ ok, error, exitCode }`.
 */
async function regenerate(ctx, config, state) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) {
    return { ok: false, error: 'no subprocess provider in this profile', exitCode: null }
  }
  if (!hasCommand(config)) {
    return { ok: false, error: NO_COMMAND_MESSAGE, exitCode: null }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000)
  try {
    const handle = subprocess.spawn({
      argv: snapshotArgv(config),
      cwd: config.workspace,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 256 * 1024 },
        stderr: { maxBytes: 256 * 1024 },
      },
      graceMs: 5000,
      signal: controller.signal,
    })
    const outcome = await handle.done
    const exitCode = outcome === null || outcome === undefined ? null : outcome.exitCode
    if (exitCode !== 0) {
      const complaint = collectedText(handle, 'stderr').trim().split('\n').slice(-4).join(' ')
      return {
        ok: false,
        exitCode,
        error: `the snapshot command exited ${exitCode}${complaint ? `: ${complaint}` : ''}`,
      }
    }
    const after = await readSnapshot(ctx, config)
    if (after.payload === null) {
      return { ok: false, exitCode, error: after.error ?? 'the command wrote no readable snapshot' }
    }
    return { ok: true, exitCode, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, exitCode: null, error: `could not run the snapshot command: ${message}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Register the two routes on the browser carrier.
 *
 * `/state` is deliberately small and is what the tab polls: it carries the
 * revision, the age, whether a regeneration is in flight and the command a
 * rebuild would run. `/series` is the whole snapshot and is fetched only when
 * the revision moves, so a tab sitting open costs one small read every few
 * seconds and no process at all.
 */
function registerRoutes(ctx, config) {
  const state = createState()

  /** Refresh if the snapshot is older than the interval, at most one at a time. */
  const refreshIfDue = (payload) => {
    const age = ageSecondsOf(payload)
    const now = Date.now()
    // Nothing to run: the tab reports "no command configured" instead, which
    // is a state a reader can act on and a spawn of an empty argv is not.
    if (!hasCommand(config)) return
    if (state.refreshing !== null) return
    if (age !== Number.POSITIVE_INFINITY && age < config.refreshSeconds) return
    if (now - state.lastAttemptMs < config.refreshSeconds * 1000) return
    state.lastAttemptMs = now
    state.refreshing = regenerate(ctx, config, state)
      .then((result) => {
        state.lastError = result.ok ? null : result.error
        return result
      })
      .finally(() => {
        state.refreshing = null
      })
  }

  // The small polled route: metadata, never the series.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/state`,
    handler: async (req, res) => {
      if (getOnly(req, res)) return
      try {
        const read = await readSnapshot(ctx, config)
        if (read.payload !== null) state.lastGood = read.payload
        if (read.payload === null && read.error !== null && state.lastError === null) {
          // Remember the reason the snapshot is unusable, but only when nothing
          // more recent explains it: a successful refresh clears this.
          const age = ageSecondsOf(state.lastGood)
          if (state.lastGood === null || age > config.refreshSeconds * 2) state.lastError = read.error
        }
        refreshIfDue(read.payload ?? state.lastGood)
        const payload = read.payload ?? state.lastGood
        const age = payload === null ? null : ageSecondsOf(payload)
        // Whether this host CAN refresh at all, so the tab can tell "waiting
        // for the next tick" apart from "nobody will ever produce this". No
        // provider, or no configured command, are both "never".
        const commandReady = hasCommand(config)
        const canRefresh = ctx.get('subprocess') !== undefined && commandReady
        let error = read.error !== null && payload === null ? read.error : state.lastError
        if (payload === null && !commandReady) error = NO_COMMAND_MESSAGE
        sendJson(res, 200, {
          ok: true,
          service: 'train-dashboard',
          workspace: config.workspace,
          snapshotPath: config.snapshotPath,
          haveSnapshot: payload !== null,
          // A CODE, not a phrase: the client chooses between "let me build
          // one", "I cannot read what is there" and "nobody configured a
          // command" from this field alone.
          reason: payload !== null ? 'ok' : (commandReady ? read.reason : 'unconfigured'),
          // `null` and not a number when there is no snapshot at all: a zero
          // age would read as "fresh" for a dashboard showing nothing.
          ageSeconds: age === null || age === Number.POSITIVE_INFINITY ? null : Math.round(age),
          stale: age === null || age === Number.POSITIVE_INFINITY
            ? true : age > config.refreshSeconds * 2,
          refreshing: state.refreshing !== null,
          canRefresh,
          refreshSeconds: config.refreshSeconds,
          // The exact argv a rebuild would run, for the tab to show when there
          // is nothing to chart yet. `null` when there is no command.
          commandHint: commandReady ? snapshotArgv(config).join(' ') : null,
          arm: payload?.arm ?? config.arm,
          breakLeg: payload?.break_leg ?? null,
          // The client re-fetches the whole series body only when this string
          // changes. A producer that omits it gets `generated_at` as its
          // revision, which is correct: new numbers mean a new timestamp.
          revision: payload?.revision ?? payload?.generated_at ?? null,
          generatedAt: payload?.generated_at ?? null,
          counts: payload?.counts ?? null,
          error,
          snapshotSources: payload?.sources ?? null,
        })
      } catch (error) {
        sendFailure(res, error)
      }
    },
  }), 'train-dashboard.state')

  // The body route: the series and the annotations, fetched on revision change.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/series`,
    handler: async (req, res) => {
      if (getOnly(req, res)) return
      try {
        const read = await readSnapshot(ctx, config)
        const payload = read.payload ?? state.lastGood
        if (payload === null) {
          sendJson(res, 503, {
            ok: false,
            error: read.error ?? 'no snapshot has been read yet',
            canRefresh: ctx.get('subprocess') !== undefined && hasCommand(config),
            refreshSeconds: config.refreshSeconds,
          })
          return
        }
        sendJson(res, 200, { ok: true, ...payload })
      } catch (error) {
        sendFailure(res, error)
      }
    },
  }), 'train-dashboard.series')
}

/**
 * Activate the host half.
 *
 * The routes are registered when the browser carrier appears and never in a
 * profile that has none, which is what keeps the headless, SDK and ACP
 * profiles loading this row cleanly.
 */
export function apply(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  ctx.inject(['webServer'], (routeCtx) => registerRoutes(routeCtx, config))
}
