/**
 * Tests for the BROWSER half of `dsh-train-dashboard`.
 *
 * WHAT THESE ARE FOR. The client half is plain JavaScript with no build step,
 * so nothing type-checks it and nothing catches a wiring mistake until the
 * page boots — and a wrong registration does not throw a visible error, it
 * renders an EMPTY TAB over a working plugin. Three specific traps are pinned
 * here, and the first one already cost this project a plugin:
 *
 *   1. THE BODY REGISTERS UNDER THE DEFINITION'S ID, NOT THE KIND. The pane
 *      dispatches a tab body with `entryKey: definition.id ?? tab.kind`, so a
 *      body registered under `kind` draws the pane's own "Nothing here can
 *      view this kind of content yet." over a chip that titles itself.
 *   2. A SLOT REGISTRATION WITHOUT `name` THROWS while `apply` runs, and the
 *      desktop application treats a throwing fiber as a failed startup.
 *   3. A STRUCTURAL ERROR IN A PURE HELPER SHOWS AS A WRONG CHART, not as an
 *      error: a series silently dropped, a break marker drawn where the break
 *      is not, or an age that reads "fresh" for a dashboard showing nothing.
 *
 * The file is loaded the way the harness loads it: through
 * `window.__ModuleLoader__.load`, with a `require` that answers `react`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Minimal React: nothing here renders, so only the shape has to exist. */
const reactStub = {
  createElement: () => null,
  useState: () => [null, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: () => null,
  useCallback: (fn) => fn,
  Fragment: Symbol('Fragment'),
}

/**
 * Minimal DOM: `apply` installs the bundle's stylesheet, which is a real side
 * effect a browser performs and this environment has to provide. It is a stub
 * and not a fake of the whole document, so a test cannot accidentally depend
 * on DOM behaviour the plugin does not have.
 */
function installDocumentStub() {
  const head = { children: [], append(child) { this.children.push(child) } }
  globalThis.document = {
    head,
    createElement() {
      return { dataset: {}, textContent: '', remove() { this.removed = true } }
    },
  }
  return head
}

/** Load the shipped client bundle and return its exports. */
function loadClient() {
  installDocumentStub()
  let definition = null
  globalThis.window = {
    __ModuleLoader__: {
      load(candidate) { definition = candidate },
    },
  }
  const path = require.resolve('../client.cjs')
  delete require.cache[path]
  require('../client.cjs')
  assert.ok(definition !== null, 'the bundle did not register itself with the module loader')
  assert.equal(definition.id, 'dsh-train-dashboard')
  return definition.factory((name) => {
    if (name === 'react') return reactStub
    throw new Error(`the client bundle required an undeclared module: ${name}`)
  })
}

const client = loadClient()
const t = client.__test

/**
 * A context capturing what the client half registers.
 *
 * `slots.inject` INVOKES its callback, because that is what the harness does
 * once the owning declaration is present, and the callback is where the
 * registration happens. A fake that only recorded the request would let a
 * broken registration pass.
 */
function fakeContext() {
  const tabs = []
  const slots = []
  const effects = []
  return {
    sidebarRightTabs: { register(definition) { tabs.push(definition); return () => {} } },
    sidebarRight: { openTab() {}, isOpen: () => false, activeTab: () => null },
    layout: { openRightbar() {}, closeRightbar() {} },
    slots: {
      inject(slotName, callback) {
        const entry = { slotName }
        slots.push(entry)
        entry.disposer = callback()
        return () => {}
      },
      register(registration, component) {
        const entry = slots[slots.length - 1]
        assert.ok(entry, 'a slot was registered outside any slots.inject callback')
        entry.registration = registration
        entry.component = component
        return () => {}
      },
    },
    effect(fn, label) { effects.push(label); const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    __tabs: tabs,
    __slots: slots,
    __effects: effects,
  }
}

// ---------------------------------------------------------------------------
// The wiring traps.
// ---------------------------------------------------------------------------

test('the tab body registers under the definition id, not the kind', () => {
  const ctx = fakeContext()
  client.apply(ctx)

  const definition = ctx.__tabs[0]
  assert.ok(definition, 'no tab type was registered')

  const body = ctx.__slots.find((entry) => entry.slotName === 'sidebar.right.pane.tab')
  assert.ok(body, 'no tab body was registered')
  assert.equal(body.registration.key, definition.id,
    'the pane dispatches with entryKey: definition.id ?? kind, so a body keyed '
    + 'by kind renders the pane\'s own "nothing can view this" over the tab')
  assert.notEqual(definition.id, definition.kind,
    'id and kind must differ; the kind is what openTab names and the id is '
    + 'what the body is dispatched with')
})

test('every slot registration names its slot', () => {
  const ctx = fakeContext()
  client.apply(ctx)

  const registrations = ctx.__slots.map((entry) => entry.registration)
  assert.ok(registrations.length >= 3, `only ${registrations.length} slot registrations`)
  for (const registration of registrations) {
    assert.equal(typeof registration.name, 'string',
      'a registration without `name` throws while apply runs, which the '
      + 'desktop application treats as a failed startup')
    assert.ok(registration.name.length > 0)
  }
})

test('the trigger lives in the frame overlay and the services it uses are declared', () => {
  const ctx = fakeContext()
  client.apply(ctx)

  const trigger = ctx.__slots.find((entry) => entry.slotName === 'shell.overlay')
  assert.ok(trigger, 'the frame trigger was not registered')

  for (const service of ['slots', 'sidebarRight', 'sidebarRightTabs', 'layout']) {
    assert.ok(client.inject.includes(service),
      `${service} is used but not declared in inject; a slot name is never a service`)
  }
})

test('the client and host halves agree on the route', () => {
  assert.equal(t.ROUTE, '/dsh-train-dashboard')
  assert.match(t.ROUTE, /^\//, 'the route must be absolute so it resolves on the app origin')
})

// ---------------------------------------------------------------------------
// The pure helpers: a structural error here shows as a wrong chart.
// ---------------------------------------------------------------------------

test('seriesIndex drops points that are not numbers', () => {
  const index = t.seriesIndex({
    series: [
      { tag: 'a', points: [[1, 1.0], [2, null], [3, 3.0], 'nonsense', [4, 'x']] },
      { tag: 'b', points: [] },
      { points: [[1, 1.0]] },
    ],
  })

  assert.deepEqual([...index.keys()], ['a'], 'empty and untagged series must not be offered')
  assert.deepEqual(index.get('a').points, [[1, 1.0], [3, 3.0]])
})

test('availableSeries leads with the registered reading order', () => {
  const offered = t.availableSeries({
    series: [
      { tag: 'train/wall_seconds', points: [[1, 100]] },
      { tag: 'train/bpb_sealed', points: [[1, 2.1]] },
      { tag: 'vram_trace/step_0001_gib', points: [[1, 4.1]] },
      { tag: 'train/bpb_sealed_post_break', points: [[1, 2.1]] },
      { tag: 'something/else', points: [[1, 1]] },
    ],
  })

  const tags = offered.map((item) => item.tag)
  assert.equal(tags[0], 'train/bpb_sealed', 'the headline series comes first')
  assert.ok(tags.includes('train/wall_seconds'))
  assert.ok(tags.includes('something/else'), 'an unknown tag must still be reachable')
  assert.ok(!tags.includes('vram_trace/step_0001_gib'),
    'per-step traces are one step each and would flood the chips')
  assert.ok(!tags.includes('train/bpb_sealed_post_break'),
    'the pre/post split series are reachable through the break marker, not the chips')
})

test('isTraceTag filters traces by shape, not by a list of known names', () => {
  assert.equal(t.isTraceTag('vram_trace/step_0001_gib'), true)
  assert.equal(t.isTraceTag('anything/trace/step_0001'), true)
  assert.equal(t.isTraceTag('memory/step_trace'), true)
  assert.equal(t.isTraceTag('train/wall_seconds'), false)
  assert.equal(t.isTraceTag('someones_own/series'), false)
})

test('lastPoint reports the newest reading or null, never undefined', () => {
  const payload = { series: [{ tag: 'a', points: [[1, 1.0], [9, 9.0]] }] }
  assert.deepEqual(t.lastPoint(payload, 'a'), [9, 9.0])
  assert.equal(t.lastPoint(payload, 'missing'), null)
  assert.equal(t.lastPoint(null, 'a'), null)
})

test('niceTicks covers the range with round steps', () => {
  const ticks = t.niceTicks(2.09, 2.11, 4)
  assert.ok(ticks.length >= 2, `only ${ticks.length} ticks`)
  for (const tick of ticks) {
    assert.ok(tick >= 2.09 - 1e-9 && tick <= 2.11 + 1e-9, `tick ${tick} is outside the range`)
  }
  assert.deepEqual(t.niceTicks(5, 5, 4), [5], 'a flat series must not divide by zero')
  assert.deepEqual(t.niceTicks(NaN, 1, 4), [])
})

test('formatValue shortens millions and never renders NaN', () => {
  assert.equal(t.formatValue(45674308.3, 0), '45.7M')
  assert.equal(t.formatValue(2.0941, 4), '2.0941')
  assert.equal(t.formatValue(NaN, 2), '—')
  assert.equal(t.formatValue(Infinity, 2), '—')
})

test('polylinePath is a path and handles the single-point case', () => {
  const project = (value) => value * 2
  assert.equal(t.polylinePath([[1, 2], [3, 4]], project, project), 'M2.00,4.00 L6.00,8.00')
  assert.equal(t.polylinePath([[1, 2]], project, project), 'M2.00,4.00')
  assert.equal(t.polylinePath([], project, project), '')
  assert.equal(t.polylinePath(null, project, project), '')
})

// ---------------------------------------------------------------------------
// Freshness: the tab must not look broken while it is merely waiting.
// ---------------------------------------------------------------------------

test('describeAge calls a fresh snapshot fresh and an old one stale', () => {
  assert.equal(t.describeAge({ haveSnapshot: true, ageSeconds: 5, stale: false }).tone, 'fresh')
  assert.equal(t.describeAge({ haveSnapshot: true, ageSeconds: 600, stale: true }).tone, 'stale')
  assert.equal(t.describeAge({ haveSnapshot: true, ageSeconds: 600, stale: true }).text, '10 min old · stale')
})

test('describeAge says "no snapshot" rather than "0s old" when there is none', () => {
  const absent = t.describeAge({ haveSnapshot: false, ageSeconds: null, stale: true })
  assert.equal(absent.tone, 'none')
  assert.ok(!absent.text.includes('0s'), `age text was ${absent.text}`)
  assert.equal(t.describeAge(null).tone, 'none')
})

test('describeAge tells "age unknown" apart from "no snapshot"', () => {
  // A producer that omits generated_at still gets its numbers charted, so the
  // badge must not claim there is no snapshot over a populated chart.
  const unknown = t.describeAge({ haveSnapshot: true, ageSeconds: null, stale: true })

  assert.equal(unknown.tone, 'stale')
  assert.equal(unknown.text, 'age unknown')
  assert.ok(!unknown.text.includes('no snapshot'), `age text was ${unknown.text}`)
})

test('ageSentence explains an unreadable timestamp rather than inventing an age', () => {
  assert.match(t.ageSentence({ haveSnapshot: true, ageSeconds: null, stale: true }),
    /no readable timestamp/)
  assert.equal(t.ageSentence({ haveSnapshot: true, ageSeconds: 600, stale: true }),
    'The snapshot is 10 min old · stale.')
})

test('emptyReason shows the exact command the host said it would run', () => {
  const reason = t.emptyReason({
    haveSnapshot: false,
    canRefresh: true,
    snapshotPath: 'train-dashboard.snapshot.json',
    commandHint: 'python3 -m your_project.snapshot_tool --out train-dashboard.snapshot.json',
  })

  assert.match(reason.body, /Refresh/, 'the tab can rebuild, so it should say so')
  assert.equal(reason.command,
    'python3 -m your_project.snapshot_tool --out train-dashboard.snapshot.json',
    'the command shown must be the host\'s own argv, not one this file guessed')
})

test('emptyReason offers no command when the host has none to offer', () => {
  const reason = t.emptyReason({ haveSnapshot: false, canRefresh: false, commandHint: null })
  assert.equal(reason.command, null)
})

test('emptyReason tells an unconfigured host apart from a merely missing snapshot', () => {
  const reason = t.emptyReason({ haveSnapshot: false, reason: 'unconfigured', canRefresh: false })

  assert.match(reason.title, /no snapshot command is configured/i)
  assert.match(reason.body, /command/, 'it must name the key to set, so the reader can fix it')
  assert.ok(!/press Refresh/i.test(reason.body),
    'pressing Refresh cannot help when no command exists, so the tab must not say it can')
})

test('emptyReason distinguishes "cannot build one here" from "waiting"', () => {
  const reason = t.emptyReason({ haveSnapshot: false, canRefresh: false, reason: 'missing' })
  assert.match(reason.title, /cannot build one/)
  assert.match(reason.body, /subprocess/, 'it must name why, so nobody hunts for a fault')
})

test('emptyReason surfaces the host\'s own error when the snapshot cannot be read', () => {
  const reason = t.emptyReason({
    haveSnapshot: false,
    canRefresh: true,
    reason: 'unusable',
    error: 'snapshot_version 99 is not 1',
  })
  assert.match(reason.body, /snapshot_version 99 is not 1/)
  assert.match(reason.body, /Rebuilding will not change this/,
    'a version mismatch is not fixed by pressing Refresh, so the tab must not say it is')
})

test('emptyReason still offers to build one when the snapshot is merely missing', () => {
  const reason = t.emptyReason({
    haveSnapshot: false,
    canRefresh: true,
    reason: 'missing',
    error: 'no snapshot at /srv/my-run/train-dashboard.snapshot.json (ENOENT)',
  })
  assert.match(reason.body, /press Refresh/)
})

test('the poll interval is long enough not to hammer the host', () => {
  assert.ok(t.POLL_MS >= 2000, `the poll interval is ${t.POLL_MS} ms`)
})
