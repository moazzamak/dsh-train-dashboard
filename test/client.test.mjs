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

/** Minimal React: nothing is mounted, but elements keep their shape so a test
 * can walk the tree a component returns. `useMemo` runs its factory because a
 * component's arithmetic depends on it; effects never run. */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState: () => [null, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  Fragment: Symbol('Fragment'),
}

/**
 * Collect every element in a rendered tree whose className contains `name`.
 *
 * Function components are CALLED, because a slot registration usually hands the
 * seat a wrapper element — `() => React.createElement(TriggerButton, …)` — and
 * the component's own tree only exists once it runs. Hooks are not modelled, so
 * a component that calls one must not be walked this way.
 */
function elementsWithClass(node, name, found = []) {
  if (node === null || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    for (const child of node) elementsWithClass(child, name, found)
    return found
  }
  if (typeof node.type === 'function') {
    return elementsWithClass(node.type(node.props ?? {}), name, found)
  }
  const className = node.props?.className
  if (typeof className === 'string'
    && className.split(' ').includes(name)) found.push(node)
  for (const child of node.children ?? []) elementsWithClass(child, name, found)
  return found
}

/**
 * Every string in a rendered tree, joined — what a reader would actually read.
 *
 * Function components are called for the same reason `elementsWithClass` calls
 * them, and the components walked here render no hooks of their own.
 */
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (typeof node.type === 'function') return textOf(node.type(node.props ?? {}))
  return (node.children ?? []).map(textOf).join(' ')
}

/**
 * Minimal DOM: `apply` installs the bundle's stylesheet, which is a real side
 * effect a browser performs and this environment has to provide. It is a stub
 * and not a fake of the whole document, so a test cannot accidentally depend
 * on DOM behaviour the plugin does not have.
 *
 * `querySelector`/`querySelectorAll` answer the two selectors that matter here:
 * the bundle's own duplicate guard (`style[data-plugin-css="…"]`) and the
 * harness client loader's ownership rule (`style:not([data-plugin])`), which
 * decides which plugin owns a sheet and which plugin's teardown deletes it.
 */
function installDocumentStub() {
  const head = {
    children: [],
    append(child) { this.children.push(child) },
  }

  /** Read one element attribute, seeing `dataset` writes as the browser would. */
  function attributeOf(element, name) {
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      if (Object.prototype.hasOwnProperty.call(element.dataset, key)) return element.dataset[key]
    }
    return element.attributes?.[name] ?? null
  }

  /** Whether one element matches the single, attribute-only selectors used here. */
  function matches(element, selector) {
    if (element.tagName !== 'style') return false
    const owned = selector.match(/^style:not\(\[([\w-]+)\]\)$/)
    if (owned !== null) return attributeOf(element, owned[1]) === null
    const exact = selector.match(/^style\[([\w-]+)="([^"]*)"\]$/)
    if (exact !== null) return attributeOf(element, exact[1]) === exact[2]
    throw new Error(`the DOM stub does not implement the selector ${selector}`)
  }

  globalThis.document = {
    head,
    createElement(tagName) {
      return {
        tagName,
        dataset: {},
        attributes: {},
        textContent: '',
        setAttribute(name, value) { this.attributes[name] = value },
        getAttribute(name) { return attributeOf(this, name) },
        remove() {
          this.removed = true
          const at = head.children.indexOf(this)
          if (at >= 0) head.children.splice(at, 1)
        },
      }
    },
    querySelector(selector) { return head.children.find((child) => matches(child, selector)) ?? null },
    querySelectorAll(selector) { return head.children.filter((child) => matches(child, selector)) },
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

test('the trigger registers in the session header action row, not the overlay layer', () => {
  const ctx = fakeContext()
  client.apply(ctx)

  const trigger = ctx.__slots.find((entry) => entry.slotName === 'conversation.session.header.actions')
  assert.ok(trigger, 'the header trigger was not registered')

  // `shell.overlay` is a frame-wide floating layer for badges, toasts and status
  // pills, and it is click-through by design. A BUTTON registered there is drawn
  // in the window's top-left, beside the application menus and the sidebar's
  // reopen control, and it cannot be clicked without opting back into pointer
  // events. Reported from the running app, and this is the assertion that keeps
  // it out.
  assert.equal(ctx.__slots.find((entry) => entry.slotName === 'shell.overlay'), undefined,
    'the trigger must not sit in the click-through overlay layer')

  for (const service of ['slots', 'sidebarRight', 'sidebarRightTabs', 'layout']) {
    assert.ok(client.inject.includes(service),
      `${service} is used but not declared in inject; a slot name is never a service`)
  }
})

test('the stylesheet is tagged the way the harness loader owns plugin styles', () => {
  const head = installDocumentStub()
  client.apply(fakeContext())

  const sheet = head.children.find((child) => child.dataset.dshTrainDashboard === 'true')
  assert.ok(sheet, 'no stylesheet was installed')

  // The loader claims every sheet WITHOUT data-plugin for whichever plugin
  // materialises next, and `removeOwnedStyles(id)` deletes every sheet whose
  // data-plugin equals an id when that entry is replaced or pruned. A sheet
  // marked only with a private data-… attribute therefore looks unowned: another
  // plugin takes it, and that plugin's first refresh deletes it — which strips
  // `fill: none` from the chart's path (it fills black) and the trigger's
  // styling. Both symptoms were reported from the running app.
  assert.equal(sheet.dataset.plugin, 'dsh-train-dashboard',
    'the sheet does not name its owner, so the loader will hand it to another plugin')
  assert.equal(sheet.dataset.pluginCss, 'dsh-train-dashboard/styles',
    'the sheet has no per-sheet identity for the loader to inventory')

  const claimable = globalThis.document.querySelectorAll('style:not([data-plugin])')
  assert.equal(claimable.length, 0,
    'the sheet is still claimable by whichever plugin materialises next')
})

test('a second apply does not stack a second stylesheet', () => {
  const head = installDocumentStub()
  client.apply(fakeContext())
  client.apply(fakeContext())

  const sheets = head.children.filter((child) => child.dataset.dshTrainDashboard === 'true')
  assert.equal(sheets.length, 1, `expected one sheet, found ${sheets.length}`)
})

test('the trigger renders the wrapper its own stylesheet targets', () => {
  const ctx = fakeContext()
  client.apply(ctx)

  const trigger = ctx.__slots.find((entry) => entry.slotName === 'conversation.session.header.actions')
  assert.ok(trigger, 'the header trigger was not registered')
  const tree = trigger.component({ sidebarRight: ctx.sidebarRight, layout: ctx.layout })

  // `.dshtd-trigger` is the element the stylesheet styles; a component that
  // returns only the button leaves that rule with nothing to apply to, and the
  // button then lands in the action row as a bare browser control.
  assert.equal(elementsWithClass(tree, 'dshtd-trigger').length, 1,
    'the trigger does not render its wrapper, so its own CSS cannot lay it out')
  assert.equal(elementsWithClass(tree, 'dshtd-trigger-button').length, 1,
    'the trigger does not render its button')
  const button = elementsWithClass(tree, 'dshtd-trigger-button')[0]
  assert.equal(button.props['aria-label'], 'Training dashboard',
    'an icon-only control in a toolbar row needs a name a screen reader can read')
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

test('the tab leads with a short list and keeps every other series reachable', () => {
  const offered = t.availableSeries({
    series: [
      { tag: 'train/wall_seconds', points: [[1, 100]] },
      { tag: 'train/bpb_sealed', points: [[1, 2.1]] },
      { tag: 'train/bpb_legval', points: [[1, 2.1]] },
      { tag: 'memory/vram_peak_gib', points: [[1, 4.1]] },
      { tag: 'vram_trace/step_0001_gib', points: [[1, 4.1]] },
      { tag: 'train/bpb_sealed_post_break', points: [[1, 2.1]] },
      { tag: 'something/else', points: [[1, 1]] },
    ],
  })
  const { primary, more } = t.splitOffered(offered)
  const leads = primary.map((item) => item.tag)

  assert.deepEqual(leads, ['train/bpb_legval', 'memory/vram_peak_gib'],
    'the reading and the memory envelope are what this tab leads with when they are present')
  assert.ok(more.some((item) => item.tag === 'something/else'),
    'an unknown tag must still be reachable, behind the disclosure rather than gone')
  assert.ok(more.some((item) => item.tag === 'train/wall_seconds'),
    'a series the tab does not lead with is one click away, not dropped')
  assert.ok(!offered.some((item) => item.tag === 'vram_trace/step_0001_gib'),
    'per-step traces are one step each and would flood the chips')
  assert.ok(!offered.some((item) => item.tag === 'train/bpb_sealed_post_break'),
    'the pre/post split series are reachable through the break marker, not the chips')
})

test('the curve\'s bpb is not offered beside the leg-end reading of the same chart', () => {
  // Measured on the live snapshot: the curve carries 688 readings over legs
  // 1..689 and the leg reading 730 over 1..731, IDENTICAL on all 688 shared legs.
  // It stops at the phase boundary and the leg reading keeps going, so offering
  // both puts a truncated duplicate of one curve in the chips.
  const both = t.availableSeries({
    series: [
      { tag: 'train/bpb_sealed', points: [[1, 2.1], [689, 2.09]] },
      { tag: 'train/bpb_legval', points: [[1, 2.1], [731, 2.41]] },
    ],
  })
  assert.deepEqual(both.map((item) => item.tag), ['train/bpb_legval'],
    'the truncated copy must not be offered beside the reading that continues past it')

  // A producer that writes only the curve still gets a bpb chip.
  const alone = t.availableSeries({ series: [{ tag: 'train/bpb_sealed', points: [[1, 2.1]] }] })
  assert.deepEqual(alone.map((item) => item.tag), ['train/bpb_sealed'],
    'the curve is the only held-out reading some snapshots have, so it cannot be dropped outright')
})

test('the held-out reading comes from the best source present, and the label says which', () => {
  const payload = {
    series: [
      { tag: 'train/bpb_sealed', points: [[689, 2.093]] },
      { tag: 'train/bpb_legval', points: [[731, 2.409]] },
    ],
  }
  const reading = t.headlineReading(payload)
  assert.equal(reading.tag, 'train/bpb_legval')
  assert.deepEqual(reading.point, [731, 2.409])
  assert.equal(t.seriesLabel(reading.tag), 'leg-val bpb',
    'the header must name the series it read, so it cannot be mistaken for the other one')

  const curveOnly = t.headlineReading({ series: [{ tag: 'train/bpb_sealed', points: [[689, 2.093]] }] })
  assert.equal(curveOnly.tag, 'train/bpb_sealed', 'the curve is the fallback source, not a second reading')
  assert.equal(t.headlineReading({ series: [] }), null)
  assert.equal(t.seriesLabel(null), 'held-out bpb', 'the header still needs a name when there is no reading')
})

test('the disclosure opens itself when the charted series lives inside it', () => {
  const more = t.splitOffered(t.availableSeries({
    series: [{ tag: 'guard/factor_hold', points: [[1, 1]] }, { tag: 'train/bpb_legval', points: [[1, 2]] }],
  })).more

  assert.equal(t.disclosureForced('guard/factor_hold', more), true,
    'a chart drawing a series whose chip is off screen is a chart with no visible selection')
  assert.equal(t.disclosureForced('train/bpb_legval', more), false,
    'a lead does not force the disclosure open')
  assert.equal(t.disclosureForced(null, more), false, 'the default is a lead or the missing chip')
})

test('isTraceTag filters traces by shape, not by a list of known names', () => {
  assert.equal(t.isTraceTag('vram_trace/step_0001_gib'), true)
  assert.equal(t.isTraceTag('anything/trace/step_0001'), true)
  assert.equal(t.isTraceTag('memory/step_trace'), true)
  // The snapshot's own guard traces rotate with the leg, so a chip for one
  // vanishes on the next refresh. Observed in the live snapshot: a revision
  // dropped guard_trace/…_leg_00722_… and gained …_leg_00725_… in one refresh.
  assert.equal(t.isTraceTag('guard_trace/V29035_leg_00722_factor'), true)
  assert.equal(t.isTraceTag('train/wall_seconds'), false)
  assert.equal(t.isTraceTag('someones_own/series'), false)
  assert.equal(t.isTraceTag('train/solve_trace_bytes'), false,
    'a tag that merely contains the word trace is a series, not a trace')
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

test('a rate in the tens of thousands reads in thousands', () => {
  // A leg's units per second is the leg's own volume over its wall clock, which
  // lands between about 45k and 82k on this run. Rendered at `digits: 0` that is
  // "65538", five digits to parse; the tier is what makes it a glance.
  assert.equal(t.formatValue(65538, 1), '65.5k')
  assert.equal(t.formatValue(4917, 1), '4917.0', 'below ten thousand keeps its own scale')
  assert.equal(t.formatValue(0, 1), '0.0')
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

// ---------------------------------------------------------------------------
// The window: the timeline a reader selects, and the axis that follows it.
//
// The chart is a research instrument, so a wrong window is a wrong reading, not
// a cosmetic defect. These pin the arithmetic behind the interaction: where the
// frame edges fall, what a drag selects, what the axis covers afterwards, and
// that the controls are reachable without a mouse.
// ---------------------------------------------------------------------------

/** One early spike, then a gentle rise: the shape a windowed axis exists for. */
const SERIES = [
  [0, 1.0], [100, 40.0], [200, 1.1], [300, 1.2], [400, 1.3], [500, 1.4],
]

test('fullRange spans the series and widens a single-point one', () => {
  assert.deepEqual(t.fullRange([[3, 1], [9, 2]]), { lo: 3, hi: 9 })
  assert.deepEqual(t.fullRange([[7, 1]]), { lo: 6, hi: 8 },
    'a one-point series still needs a span to divide by')
})

test('the axis rescales to the window, so a spike outside it stops setting the scale', () => {
  const whole = t.valueRange(SERIES)
  assert.ok(whole.hi > 40, `the whole run must cover the spike, got ${whole.hi}`)

  const window = { lo: 200, hi: 500 }
  const zoomed = t.valueRange(t.pointsInRange(SERIES, window))

  assert.ok(zoomed.hi < 3,
    `the zoomed axis still covers the out-of-view spike: hi=${zoomed.hi}`)
  assert.ok(zoomed.lo < 1.1 && zoomed.lo > 0.9,
    `the axis must start just below the window minimum, got ${zoomed.lo}`)
  assert.ok(zoomed.hi > 1.4, `the axis must contain the window maximum, got ${zoomed.hi}`)

  // The bracketing sample is drawn so the line meets the frame, but it must not
  // reach the axis: that is how the spike the reader zoomed away from would come
  // back to flatten the window.
  const bracketed = t.pointsToDraw(SERIES, window)
  assert.ok(bracketed.some((point) => point[1] >= 40),
    'the sample before the window is drawn, and its value is the spike')
  assert.ok(zoomed.hi < t.valueRange(bracketed).hi,
    'the axis must be scaled to the window, not to what is merely drawn')
})

test('a window draws the samples bracketing it, so the line reaches the frame edge', () => {
  const drawn = t.pointsToDraw(SERIES, { lo: 150, hi: 350 })
  const inside = t.pointsInRange(SERIES, { lo: 150, hi: 350 })

  assert.deepEqual(drawn.map((point) => point[0]), [100, 200, 300, 400],
    'the sample before the window and the first after it are both needed, or the '
    + 'line starts in mid-air')
  assert.deepEqual(inside.map((point) => point[0]), [200, 300],
    'only the samples in the window may set the axis')
})

test('a window is clamped to the run and never narrower than the floor', () => {
  const bounds = { lo: 0, hi: 1000 }

  assert.deepEqual(t.clampRange({ lo: 200, hi: 400 }, bounds), { lo: 200, hi: 400 })
  assert.deepEqual(t.clampRange({ lo: -500, hi: 100 }, bounds), { lo: 0, hi: 600 },
    'a window dragged past an edge stops at the edge and keeps its width')
  assert.deepEqual(t.clampRange({ lo: 950, hi: 1200 }, bounds), { lo: 750, hi: 1000 })

  const floor = t.clampRange({ lo: 500, hi: 500.01 }, bounds)
  assert.equal(floor.hi - floor.lo, bounds.hi * t.MIN_WINDOW_FRACTION,
    'zoom stops at the registered floor rather than at the two points left by a '
    + 'window narrower than it')
  assert.equal(t.clampRange({ lo: 0, hi: 0 }, { lo: 5, hi: 5 }), null,
    'a run with no extent has nothing to show')
})

test('zooming keeps the anchored value where it is on the frame', () => {
  const range = { lo: 0, hi: 100 }
  const zoomed = t.zoomRange(range, 0.5, 25)

  assert.deepEqual(zoomed, { lo: 12.5, hi: 62.5 })
  assert.equal((25 - zoomed.lo) / (zoomed.hi - zoomed.lo),
    (25 - range.lo) / (range.hi - range.lo),
    'the value under the pointer must not move while zooming, or the chart '
    + 'appears to slide away from the cursor')
})

test('panning moves a window by a fraction of its own width', () => {
  assert.deepEqual(t.panRange({ lo: 100, hi: 200 }, -0.25), { lo: 75, hi: 175 })
  assert.deepEqual(t.panRange({ lo: 100, hi: 200 }, 0.5), { lo: 150, hi: 250 })
  assert.deepEqual(t.clampRange(t.panRange({ lo: 900, hi: 1000 }, 0.5), { lo: 0, hi: 1000 }),
    { lo: 900, hi: 1000 }, 'panning past the end of the run stops at the end')
})

test('a brush reads left to right whichever way it was dragged', () => {
  const plot = t.plotGeometry({ lo: 0, hi: 1000 })

  assert.deepEqual(t.brushRange(plot.left, plot.right, plot), { lo: 0, hi: 1000 },
    'the plot columns span the window exactly')
  assert.deepEqual(t.brushRange(plot.right, plot.left, plot),
    t.brushRange(plot.left, plot.right, plot),
    'dragging right to left selects the same window as dragging left to right')

  const width = plot.right - plot.left
  const middle = t.brushRange(plot.left + width / 4, plot.left + width / 2, plot)
  assert.deepEqual(middle, { lo: 250, hi: 500 })
})

test('frame pixels map to window values and clamp to the plot', () => {
  const plot = t.plotGeometry({ lo: 10, hi: 20 })

  assert.equal(t.valueAt(plot.left, plot), 10)
  assert.equal(t.valueAt(plot.right, plot), 20)
  assert.equal(t.valueAt((plot.left + plot.right) / 2, plot), 15)
  assert.equal(t.clampChartPixel(-500), t.CHART.padLeft)
  assert.equal(t.clampChartPixel(10_000), t.CHART.width - t.CHART.padRight)
})

test('the readout names the window, not just the series', () => {
  const bounds = { lo: 0, hi: 1200 }

  assert.match(t.rangeLabel(bounds, bounds), /all 1200 shown/)
  assert.match(t.rangeLabel({ lo: 120, hi: 480 }, bounds),
    /steps 120–480 · 360 of 1200 shown/)
})

test('the window controls are labelled buttons and the chart takes focus', () => {
  const tree = t.SeriesChart({
    spec: { label: 'sealed bpb', digits: 3, unit: 'bpb', series: { tag: 'train/bpb_sealed', points: SERIES } },
    payload: null,
  })

  const buttons = elementsWithClass(tree, 'dshtd-window-button')
  assert.equal(buttons.length, 3, 'zoom out, zoom in, and reset')
  for (const button of buttons) {
    assert.equal(typeof button.props['aria-label'], 'string',
      'an icon-only control without a label is unreadable to a screen reader')
  }

  const chart = elementsWithClass(tree, 'dshtd-chart')[0]
  assert.ok(chart, 'the frame must be drawn')
  assert.equal(chart.props.tabIndex, 0,
    'a range reachable only by dragging is a range a keyboard user cannot choose')
  assert.match(chart.props['aria-label'], /points in view/,
    'the label must carry the numbers the picture carries')
  assert.equal(elementsWithClass(tree, 'dshtd-overview').length, 1,
    'the reader needs the whole run to see where the window sits in it')
})

test('the numbers in the readout are the numbers on screen', () => {
  const bounds = t.fullRange(SERIES)
  const window = t.clampRange({ lo: 150, hi: 350 }, bounds)

  assert.equal(t.rangeLabel(window, bounds), 'steps 150–350 · 200 of 500 shown',
    'the readout must describe the window the axis was scaled to, not the series')
})

// ---------------------------------------------------------------------------
// The reader's selection, which belongs to the reader and not to the payload.
//
// The snapshot is rebuilt from logs on disk on every refresh, so a series can
// drop out of one revision and come back in the next. Reported from the running
// app: the panel silently switched to the default curve whenever an update
// arrived, which reads as a redraw and is actually the panel discarding a choice.
// ---------------------------------------------------------------------------

/** The chips a payload offers, as the panel builds them. */
const offeredOf = (tags) => tags.map((tag) => ({ tag, label: tag, unit: '', digits: 3, series: { tag, points: [[0, 1]] } }))

test('a chosen series stays chosen across a new payload', () => {
  const first = offeredOf(['train/bpb_sealed', 'train/wall_seconds'])
  const second = offeredOf(['train/bpb_sealed', 'train/wall_seconds', 'train/gnorm'])

  assert.equal(t.resolveSelection(first, 'train/wall_seconds').spec.tag, 'train/wall_seconds')
  assert.equal(t.resolveSelection(second, 'train/wall_seconds').spec.tag, 'train/wall_seconds',
    'the selection must survive the payload object being replaced on every poll')
})

test('a chosen series missing from a revision is reported, never replaced', () => {
  const offered = offeredOf(['train/bpb_sealed', 'train/wall_seconds'])
  const selection = t.resolveSelection(offered, 'retention/files_purged')

  assert.equal(selection.missing, true, 'the panel must know the choice is absent')
  assert.equal(selection.spec, null,
    'falling back to the first series moves the reader onto a curve they did not ask for, '
    + 'while looking exactly like a redraw')
})

test('the default is the first series only when the reader has chosen nothing', () => {
  const offered = offeredOf(['train/bpb_sealed', 'train/wall_seconds'])

  assert.equal(t.resolveSelection(offered, null).spec.tag, 'train/bpb_sealed')
  assert.deepEqual(t.resolveSelection([], 'train/wall_seconds'), { spec: null, missing: false },
    'an empty payload is not a missing series; it is nothing to draw yet')
  assert.deepEqual(t.resolveSelection([], null), { spec: null, missing: false })
})

test('the chosen series and the zoomed window are remembered outside the component', () => {
  // A tab body is unmounted and mounted again by the pane, and React state does
  // not survive that, which is what returned the reader to the default.
  assert.equal(t.rememberedSeries('session-a'), null)

  t.rememberSeries('session-a', 'train/gnorm')
  assert.equal(t.rememberedSeries('session-a'), 'train/gnorm')
  assert.equal(t.rememberedSeries('session-b'), null,
    'two sessions must not fight over one choice')

  t.rememberSeries('session-a', null)
  assert.equal(t.rememberedSeries('session-a'), null, 'clicking the default again forgets the choice')

  const bounds = { lo: 0, hi: 1000 }
  assert.equal(t.rememberedWindow('train/gnorm'), null)

  const window = t.clampRange({ lo: 900, hi: 1000 }, bounds)
  t.rememberWindow('train/gnorm', window)
  assert.deepEqual(t.rememberedWindow('train/gnorm'), window)
  assert.equal(t.rememberedWindow('train/bpb_sealed'), null,
    'a window belongs to the series it was drawn on')

  t.rememberWindow('train/gnorm', null)
  assert.equal(t.rememberedWindow('train/gnorm'), null, 'Reset forgets the window')
})

// ---------------------------------------------------------------------------
// Break markers and the frontier.
//
// The tab used to carry ONE break — the producer's `break_leg` — and it was the
// only marker a reader could see. A snapshot can now carry `breaks`: markers the
// producer derived from its own artifacts, each with a KIND, plus a `frontier`
// naming the next expected transition. Three defects motivate these tests, and
// every one of them is silent on screen:
//
//   1. A MARKER THAT IS NEVER DRAWN. The keys can arrive and the tab can go on
//      drawing the one break it always drew; nothing errors, and the reader
//      concludes the run crossed no other boundary.
//   2. A MARKER DRAWN WITHOUT ITS KIND. The kinds mean different things about
//      the curve — a corpus change explains a rise, an instrument change makes
//      the joint a level shift, an arithmetic change makes the series
//      incomparable — so a marker whose kind is invisible is worse than no
//      marker: it invites exactly the comparison it should prevent.
//   3. A FRONTIER DRAWN AS A FACT. It is where the producer's budget says the
//      current corpus runs out, and it is a direction, not a measurement.
//
// The words a marker shows are the SNAPSHOT'S OWN, and these fixtures are
// deliberately plain: what is pinned here is that this half draws what it is
// given, not that it agrees with any particular producer's wording.
// ---------------------------------------------------------------------------

/** A series an axis of 10..500 can carry, with markers placed inside it. */
const BREAK_SERIES = [[10, 1.0], [100, 2.0], [200, 3.0], [300, 4.0], [400, 5.0], [500, 6.0]]

/** The chart spec the panel builds from a snapshot, in miniature. */
function chartSpec() {
  return {
    tag: 'train/loss', label: 'loss', unit: '', digits: 3,
    series: { tag: 'train/loss', source: 'fixture', points: BREAK_SERIES },
  }
}

/** One served marker, carrying every field a producer sends. */
function servedMarker(overrides = {}) {
  return {
    leg: 40,
    kind: 'corpus',
    label: 'the data changed',
    reason: 'the data changed at this leg.',
    support: 'the legs\' own log names',
    derived: true,
    contradiction: '',
    meaning: 'the DATA changed, so a rise here is EXPECTED',
    ...overrides,
  }
}

/** One marker of each kind, at legs the whole-run axis covers. */
const ALL_KINDS = [
  servedMarker({ leg: 40, kind: 'instrument', label: 'the read changed', reason: 'the reading began differently.' }),
  servedMarker({ leg: 120, kind: 'shape', label: '2048 to 1024 steps', reason: 'the leg ran fewer steps.' }),
  servedMarker({ leg: 121, kind: 'arithmetic', label: 'float32 to bfloat16', reason: 'the numbers changed.' }),
  servedMarker({ leg: 200, kind: 'restart', label: 'restart after 2.6 hours', reason: 'the process restarted.' }),
  servedMarker({ leg: 260, kind: 'corpus', label: 'a to b', reason: 'the corpus changed.' }),
]

/** A snapshot body with whatever the case under test serves. */
function snapshotWith(overrides = {}) {
  return {
    snapshot_version: 1,
    generated_at: new Date().toISOString(),
    revision: 'r1',
    series: [{ tag: 'train/loss', points: BREAK_SERIES }],
    ...overrides,
  }
}

/** Render one series' chart the way the panel renders it. */
function renderChart(payload) {
  return t.SeriesChart({ spec: chartSpec(), payload })
}

/** The marker labels drawn on a chart, by the leg they belong to. */
function labelsByLeg(tree) {
  const labels = new Map()
  for (const label of elementsWithClass(tree, 'dshtd-breaklabel')) {
    labels.set(label.props['data-leg'], label)
  }
  return labels
}

test('a snapshot carrying breaks draws one marker per break', () => {
  const marks = elementsWithClass(renderChart(snapshotWith({ breaks: ALL_KINDS })), 'dshtd-breakmark')

  assert.equal(marks.length, ALL_KINDS.length,
    `drew ${marks.length} markers for ${ALL_KINDS.length} breaks: a break the tab does not draw `
    + 'is a joint the reader will fit straight across')
  assert.deepEqual(marks.map((mark) => mark.props['data-leg']), ['40', '120', '121', '200', '260'],
    'the markers must sit at the legs the snapshot names, oldest first')
})

/** The SVG element a kind's swatch is drawn as, from its registered shape name. */
function swatchElementFor(kind) {
  const shape = t.markerShape(kind)
  if (shape === 'circle') return 'circle'
  if (shape === 'square' || shape === 'bar') return 'rect'
  return 'polygon'
}

test('every marker carries its kind on the chart as a shape, and names it in the register', () => {
  const tree = renderChart(snapshotWith({ breaks: ALL_KINDS }))

  const marks = elementsWithClass(tree, 'dshtd-breakmark')
  assert.equal(marks.length, ALL_KINDS.length)
  const labels = labelsByLeg(tree)
  const shapesSeen = new Set()
  for (const mark of marks) {
    const kind = mark.props['data-kind']
    assert.ok(typeof kind === 'string' && kind.length > 0,
      'a marker with no kind cannot be told from any other: the kinds do different things to the curve')
    const label = labels.get(mark.props['data-leg'])
    assert.ok(label, `the marker at leg ${mark.props['data-leg']} has no label on the chart`)
    assert.equal(label.props['data-kind'], kind, 'the label and the line must be the same marker')

    // The chart says which kind WITHOUT a word. Drawing the kind's word and the
    // first words of its reason on the plot repeated what the register below says
    // in full and cost the reader the curve: six joints inside fifty legs stacked
    // into six lanes of prose. The identifier is a shape, and the colour is a
    // second channel for the same fact rather than the only one, so a reader who
    // cannot separate the hues still tells the kinds apart.
    const swatch = elementsWithClass(label, 'dshtd-marker-swatch')
    assert.equal(swatch.length, 1,
      `the marker at leg ${mark.props['data-leg']} carries no kind swatch on the chart`)
    assert.equal(swatch[0].type, swatchElementFor(kind),
      `the ${kind} swatch is not drawn as its registered shape`)
    shapesSeen.add(t.markerShape(kind))

    // The leg number is the join key to the register row, which names the kind.
    assert.equal(textOf(label).trim(), mark.props['data-leg'],
      'the chart label is the leg number and nothing else: the words are in the register')
  }
  assert.equal(shapesSeen.size, ALL_KINDS.length,
    'two kinds drawn as one shape cannot be told apart by a reader who cannot separate the colours')

  const rows = elementsWithClass(tree, 'dshtd-break-row')
  for (const row of rows) {
    assert.ok(textOf(row).includes(row.props['data-kind'].toUpperCase()),
      `the register row at leg ${row.props['data-leg']} does not name its kind`)
  }
})

test('no two kinds of break share a shape, and an unseen kind still gets one', () => {
  const kinds = [...new Set(ALL_KINDS.map((marker) => marker.kind)), t.DECLARED_KIND, t.UNKNOWN_KIND]
  const shapes = kinds.map((kind) => t.markerShape(kind))

  assert.equal(new Set(shapes).size, kinds.length,
    `two kinds share a shape: ${kinds.map((kind, at) => `${kind}=${shapes[at]}`).join(' ')}`)
  assert.equal(t.markerShape('optimizer'), t.markerShape(t.UNKNOWN_KIND),
    'a kind this tab has never seen gets the unknown shape rather than no shape at all')
})

/**
 * The declaration each registered shape must appear as in the stylesheet.
 *
 * The chart's shape is JavaScript and the register's is CSS, so one mapping is
 * written twice and the two can disagree. This is the assertion that catches it:
 * a reader decodes the chart by finding the same shape in the key.
 */
const SHAPE_CSS = {
  circle: 'border-radius: 50%',
  square: 'border-radius: 2px',
  diamond: 'clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  triangle: 'clip-path: polygon(50% 0, 100% 100%, 0 100%)',
  'triangle-down': 'clip-path: polygon(0 0, 100% 0, 50% 100%)',
  bar: 'clip-path: inset(',
  plus: 'clip-path: polygon(35% 0',
}

test('the register and its key draw the same shape as the chart, kind for kind', () => {
  const head = installDocumentStub()
  client.apply(fakeContext())
  const css = head.children.map((tag) => tag.textContent).join('\n')
  const kinds = [...new Set(ALL_KINDS.map((marker) => marker.kind)), t.DECLARED_KIND, t.UNKNOWN_KIND]

  for (const kind of kinds) {
    const shape = t.markerShape(kind)
    // Every rule that ends in this kind's swatch selector: the kind's colour and
    // its shape are set by two different rules, and only one of them is the shape.
    const bodies = [...css.matchAll(
      new RegExp(`\\.dshtd-break-swatch\\[data-kind='${kind}'\\]\\s*\\{([^}]*)\\}`, 'g'))]
      .map((match) => match[1])
    assert.ok(bodies.length > 0,
      `the register has no rule for ${kind}, so the chart's shape cannot be decoded`)
    assert.ok(bodies.some((body) => body.includes(SHAPE_CSS[shape])),
      `the register draws ${kind} as [${bodies.map((body) => body.trim()).join(' | ')}] and the chart `
      + `draws it as ${shape}: the reader cannot match the mark to the key`)
  }
})

test('a kind this tab has never seen is drawn with a shape, and named in the register', () => {
  const payload = snapshotWith({
    breaks: [servedMarker({ leg: 40, kind: 'optimizer', label: 'the schedule changed', meaning: 'the OPTIMIZER changed' })],
  })
  const tree = renderChart(payload)
  const marks = elementsWithClass(tree, 'dshtd-breakmark')

  assert.equal(marks.length, 1, 'a kind added by the producer must not make its marker disappear')
  assert.equal(marks[0].props['data-kind'], 'optimizer')
  assert.equal(elementsWithClass(labelsByLeg(tree).get('40'), 'dshtd-marker-swatch').length, 1,
    'an unseen kind still gets a shape, because a marker drawn without one is worse than no marker')
  assert.ok(textOf(elementsWithClass(tree, 'dshtd-break-row')[0]).includes('OPTIMIZER'),
    'the register names the unseen kind in the producer\'s own words')
})

test('a marker the snapshot gives no kind for says so in the register, and keeps its shape', () => {
  const marker = servedMarker({ leg: 40 })
  delete marker.kind
  const tree = renderChart(snapshotWith({ breaks: [marker] }))
  const marks = elementsWithClass(tree, 'dshtd-breakmark')

  assert.equal(marks.length, 1)
  assert.equal(marks[0].props['data-kind'], t.UNKNOWN_KIND)
  const label = labelsByLeg(tree).get('40')
  assert.equal(label.props['data-kind'], t.UNKNOWN_KIND)
  assert.equal(elementsWithClass(label, 'dshtd-marker-swatch').length, 1,
    'an unfilled kind still gets the shape that says "no kind stated"')
  assert.ok(textOf(elementsWithClass(tree, 'dshtd-break-row')[0]).includes('UNKNOWN'),
    'an unfilled kind must read as unknown, not as nothing')
})

test('the register reads out the snapshot\'s own words, not this plugin\'s', () => {
  const rows = elementsWithClass(renderChart(snapshotWith({ breaks: ALL_KINDS })), 'dshtd-break-row')

  assert.equal(rows.length, ALL_KINDS.length)
  for (const [index, marker] of ALL_KINDS.entries()) {
    const text = textOf(rows[index])
    assert.ok(text.includes(marker.label), `the label for leg ${marker.leg} is not the snapshot's own`)
    assert.ok(text.includes(marker.reason), `the reason for leg ${marker.leg} is not the snapshot's own`)
    assert.ok(text.includes(marker.meaning),
      `the meaning of the kind at leg ${marker.leg} is not the snapshot's own: a paraphrase here is a `
      + 'second statement of one fact, free to disagree with the record')
    assert.ok(text.includes(marker.support), `the evidence for leg ${marker.leg} is not shown`)
  }
})

test('a marker whose leg is a constant in the producer\'s code is flagged as one', () => {
  const payload = snapshotWith({ breaks: [servedMarker({ derived: false, leg: 40 })] })
  const derived = textOf(elementsWithClass(renderChart(payload), 'dshtd-break-row')[0])

  assert.match(derived, /CONSTANT IN THE CODE/,
    'a declared leg shown like a measured one is a guess wearing a measurement\'s clothes')
  const measured = textOf(elementsWithClass(
    renderChart(snapshotWith({ breaks: [servedMarker({ leg: 40 })] })), 'dshtd-break-row')[0])
  assert.ok(!/CONSTANT IN THE CODE/.test(measured), 'a derived marker must not carry the warning')
})

test('a contradiction the snapshot attaches is shown, not swallowed', () => {
  const payload = snapshotWith({
    breaks: [servedMarker({ leg: 40, contradiction: 'the following legs do not show this change' })],
  })
  const text = textOf(elementsWithClass(renderChart(payload), 'dshtd-break-row')[0])

  assert.match(text, /THE LEGS CONTRADICT THIS/)
  assert.ok(text.includes('the following legs do not show this change'))
})

test('a marker past the end of the series still reads in the register', () => {
  const payload = snapshotWith({ breaks: [servedMarker({ leg: 900, label: 'beyond the last point' })] })
  const tree = renderChart(payload)

  assert.equal(elementsWithClass(tree, 'dshtd-breakmark').length, 0,
    'a leg outside the axis cannot be drawn on it')
  const rows = elementsWithClass(tree, 'dshtd-break-row')
  assert.equal(rows.length, 1, 'the register carries every marker, in the window or not')
  assert.ok(textOf(rows[0]).includes('beyond the last point'))
})

test('a marker with no readable leg is counted and reported, never dropped in silence', () => {
  const payload = snapshotWith({ breaks: [servedMarker({ leg: 40 }), { kind: 'corpus', label: 'no leg' }] })
  const tree = renderChart(payload)

  const read = t.readBreakMarkers(payload)
  assert.equal(read.markers.length, 1)
  assert.equal(read.skipped, 1)
  assert.match(textOf(elementsWithClass(tree, 'dshtd-breaks')[0]), /carry no readable leg/,
    'a marker that cannot be placed is a gap in the picture, and the picture has to say so')
})

test('a producer that serves only break_leg keeps its marker, and no kind is invented for it', () => {
  const payload = snapshotWith({ break_leg: 300 })
  const tree = renderChart(payload)
  const marks = elementsWithClass(tree, 'dshtd-breakmark')

  assert.equal(marks.length, 1, 'the older single-break key must keep working on its own')
  assert.equal(marks[0].props['data-leg'], '300')
  assert.equal(marks[0].props['data-kind'], t.DECLARED_KIND)

  const row = textOf(elementsWithClass(tree, 'dshtd-break-row')[0])
  assert.ok(row.includes("snapshot's own break_leg"))
  assert.match(row, /claims none/,
    'break_leg names a leg and no kind, so the tab must say it is not claiming one')
})

test('a snapshot with neither breaks nor break_leg draws no markers and no register', () => {
  const tree = renderChart(snapshotWith())

  assert.equal(elementsWithClass(tree, 'dshtd-breakmark').length, 0)
  assert.equal(elementsWithClass(tree, 'dshtd-breaks').length, 0,
    'an empty register box under every chart is chrome')
})

test('the frontier is drawn as an expectation, with the snapshot\'s sentence and a caveat', () => {
  const sentence = 'FRONTIER: a is being trained; the next corpus transition is a to b at about leg 420.'
  const payload = snapshotWith({
    breaks: ALL_KINDS,
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 300, next_leg: 420,
      legs_in_phase: 40, legs_remaining: 3, expected_to_raise_bpb: true,
      imminent: false, sentence,
    },
  })
  const tree = renderChart(payload)
  const marks = elementsWithClass(tree, 'dshtd-frontier-mark')

  assert.equal(marks.length, 1, 'the expected transition is inside the axis, so it must be drawn')
  assert.equal(marks[0].props['data-expectation'], 'true',
    'the frontier line must be marked as an expectation for anything reading the DOM')
  const frontierLabel = elementsWithClass(tree, 'dshtd-breaklabel')
    .find((label) => label.props['data-kind'] === 'frontier')
  assert.ok(frontierLabel, 'the frontier line needs its own label, or it is a line with no meaning')
  // The label is the leg number plus the one UNFILLED swatch: the frontier is an
  // expectation and not a joint read from an artifact, and its sentence is in the
  // register under a heading that says so.
  assert.equal(textOf(frontierLabel).trim(), '420',
    'the frontier label is its leg number, not a sentence repeated from the register')
  assert.equal(elementsWithClass(frontierLabel, 'dshtd-frontier-swatch').length, 1,
    'the frontier needs the outlined swatch that distinguishes an expectation from a kind')

  const block = textOf(elementsWithClass(tree, 'dshtd-frontier')[0])
  assert.ok(block.includes(sentence), 'the snapshot\'s own frontier sentence is shown as served')
  assert.match(block, /EXPECTED, NOT OBSERVED/)
  assert.match(block, /DIRECTION and not a magnitude/,
    'the leg is a projection and the rise is a registered direction: the reader has to be told which')
  assert.match(block, /a rise in bits per byte is EXPECTED there/)
})

test('a frontier past the end of the series says where its line went', () => {
  const payload = snapshotWith({
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 300, next_leg: 900,
      legs_in_phase: 40, legs_remaining: 10, expected_to_raise_bpb: false,
      imminent: false, sentence: 'FRONTIER: a is being trained.',
    },
  })
  const tree = renderChart(payload)

  assert.equal(elementsWithClass(tree, 'dshtd-frontier-mark').length, 0,
    'a leg past the last point of the series cannot be drawn')
  const block = textOf(elementsWithClass(tree, 'dshtd-frontier')[0])
  assert.match(block, /past the last point/, 'the missing line needs its reason, or the reader hunts for it')
  assert.match(block, /leg 500/)
})

test('an imminent frontier reads AT LEG, because there is nothing left to predict', () => {
  const frontier = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'b', next_phase: 'c', boundary_leg: 300, next_leg: 300,
      legs_in_phase: 0, legs_remaining: 0, expected_to_raise_bpb: true,
      imminent: true, sentence: '',
    },
  }))

  const text = t.frontierTagText(frontier)
  assert.match(text, /AT LEG 300/)
  assert.ok(!/expected around/.test(text),
    'the next leg to train is the new corpus: there is nothing to expect, it is about to happen')
  assert.equal(t.frontierLeg(frontier), 300, 'the line belongs on the boundary leg, not a projection')
})

test('a frontier with no corpus after it says so rather than naming a leg', () => {
  const frontier = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'a', next_phase: '', boundary_leg: 300, next_leg: 300,
      legs_in_phase: 40, legs_remaining: 0, expected_to_raise_bpb: false,
      imminent: false, sentence: '',
    },
  }))

  assert.match(t.frontierTagText(frontier), /no further corpus change is scheduled ahead/)
})

test('markers close together are stacked, so no two labels write over each other', () => {
  const plot = { left: t.CHART.padLeft, right: t.CHART.width - t.CHART.padRight }
  const projectX = (leg) => plot.left + (leg / 1000) * (plot.right - plot.left)
  const markers = [40, 400, 401, 700].map((leg) => ({ leg, kind: 'corpus', label: 'the data changed' }))
  const placed = t.layoutMarkerLabels(markers, projectX, plot)

  assert.equal(placed[0].lane, placed[1].lane, 'markers far enough apart share the top lane')
  assert.notEqual(placed[1].lane, placed[2].lane, 'two markers a leg apart must not share a lane')

  for (const one of placed) {
    for (const other of placed) {
      if (one === other || one.lane !== other.lane) continue
      const [first, second] = one.x <= other.x ? [one, other] : [other, one]
      assert.ok(first.x + first.width <= second.x + 0.001,
        `two labels in lane ${one.lane} overlap: the chart would be unreadable exactly where the `
        + 'breaks cluster')
    }
  }
  assert.equal(t.markerLaneY(1) - t.markerLaneY(0), t.MARKER_LANE_HEIGHT)
})

test('a long reason reads whole in the register, and never reaches the chart', () => {
  const long = servedMarker({ leg: 40, label: 'the sealed read began scoring with the read present' })
  const payload = snapshotWith({ breaks: [long] })
  const marker = t.readBreakMarkers(payload).markers[0]

  assert.equal(t.markerTagText(marker), '40',
    'the chart label is the leg number: the kind is its shape, and the words are in the register')
  assert.ok(!/read present/.test(t.markerTagText(marker)),
    'nothing on the chart needs cutting, because the chart carries no prose')

  assert.ok(textOf(elementsWithClass(renderChart(payload), 'dshtd-break-row')[0])
    .includes('the sealed read began scoring with the read present'),
  'the register is where the whole sentence reads')
})

test('the chart\'s accessible name carries the markers, so the picture is not the only place they exist', () => {
  const tree = renderChart(snapshotWith({ breaks: ALL_KINDS }))
  const chart = elementsWithClass(tree, 'dshtd-chart')[0]

  assert.match(chart.props['aria-label'], /break marker/)
  assert.match(chart.props['aria-label'], new RegExp(`${ALL_KINDS.length} of ${ALL_KINDS.length}`))
})
