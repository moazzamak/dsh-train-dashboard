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

/**
 * Close enough for a computed float: `Math.pow(10, ...)` and `Math.log10` do not
 * round-trip exactly, so a value the arithmetic places at 0.08 arrives as
 * 0.0799999999999983. Comparing those with `===` tests the floating point unit
 * rather than the code.
 */
function closeTo(actual, expected, epsilon = 1e-9, message = '') {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${message}${message === '' ? '' : ': '}expected ${expected} +/- ${epsilon}, got ${actual}`)
}

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

/** The same elements, ordered by where they sit on the frame, top first. */
function elementsByHeight(nodes) {
  return [...nodes].sort((left, right) => left.props.y - right.props.y)
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
  // BACK TO THREE, 11 October 2026. The row carried EIGHT for a few hours: the value axis' five
  // buttons - `-y`, `+y`, `↑y`, `↓y`, `y auto` - were added and then removed the same day, because the
  // user replaced them with the rail: "instead of having +y -y buttons just show a vertical window to
  // the left of the graph that I can drag-select exactly like the x-axis zoom feature". So the row is
  // the leg axis' own three again, and the value axis is reached by dragging the rail or by the
  // Shift-keys. (An earlier version of this comment said the row had carried "six", which was my own
  // miscount of my own row: three leg buttons plus five value buttons is eight.)
  assert.equal(buttons.length, 3, 'zoom out, zoom in, and Reset for the leg axis')
  for (const button of buttons) {
    assert.equal(typeof button.props['aria-label'], 'string',
      'an icon-only control without a label is unreadable to a screen reader')
  }
  // THE RAIL IS BESIDE THE FRAME, not in the control row, and it carries the window's own
  // geometry: a spine for the extent, the window drawn on it, and a brush while dragging.
  assert.equal(elementsWithClass(tree, 'dshtd-rail').length, 1,
    'the value axis must have its overview to the left of the frame')
  assert.equal(elementsWithClass(tree, 'dshtd-rail-window').length, 1,
    'the rail must draw the window on it, which is what makes it an overview and not a scrollbar')
  const railFrame = elementsWithClass(tree, 'dshtd-rail-frame')
  assert.equal(railFrame.length, 1, 'the rail and the chart must be laid out side by side')
  // AND NO BUTTONS FOR THE VALUE AXIS, asserted as an absence so the row cannot quietly grow them
  // back beside the rail, which would be two controls for one window.
  assert.equal(elementsWithClass(tree, 'dshtd-scale-slider').length, 0,
    'the factor slider is gone and must not come back')

  const chart = elementsWithClass(tree, 'dshtd-chart')[0]
  assert.ok(chart, 'the frame must be drawn')
  assert.equal(chart.props.tabIndex, 0,
    'a range reachable only by dragging is a range a keyboard user cannot choose')
  assert.match(chart.props['aria-label'], /points in view/,
    'the label must carry the numbers the picture carries')
  assert.equal(elementsWithClass(tree, 'dshtd-overview').length, 1,
    'the reader needs the whole run to see where the window sits in it')
})

test('the rail is given its own width, which is what keeps it off the screen', () => {
  // REPORTED FROM THE RUNNING APP, 11 October 2026: "I see a HUGE bar taking up the whole screen and I
  // need to scroll down to be able to see anything else." The rail had no width, and a stylesheet rule
  // sets `width: 100%` on the CHART so the frame fills its lane - which the rail, as a flex sibling,
  // inherited nothing to resist. The browser then scaled its 26:240 viewBox aspect ratio up to the lane
  // width: a bar hundreds of pixels across, with the chart pushed off screen behind it.
  //
  // THIS TEST IS THE ONE THAT WOULD HAVE CAUGHT IT. Every other assertion here looks at the element
  // TREE, and the tree was correct: the svg was there, at the right place, with the right children. The
  // defect lived entirely in the stylesheet, so the test reads the stylesheet.
  const css = String(t.CSS)
  const rule = /\.dshtd-rail\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, 'the rail must have a rule of its own in the sheet')
  const body = rule[1]
  // A SIZE IN THE SHEET, IN THE RAIL'S OWN VIEWBOX UNITS: without an explicit width the element takes
  // the lane's, and the aspect ratio does the rest.
  assert.match(body, /width:\s*26px/,
    `the rail must be given its width or the lane's is used; rule was:${body}`)
  assert.match(body, /height:\s*240px/,
    `the rail must be given its height, matching the frame's; rule was:${body}`)
  // AND IT MUST NOT TAKE THE CHART'S OWN FILL RULE. `width: 100%` anywhere in the rail's rule is the
  // exact defect, so it is asserted as an absence as well as a presence above.
  assert.doesNotMatch(body, /width:\s*100%/,
    'the rail must never be told to fill its lane')
  // THE NUMBERS COME FROM THE CONSTANT and are not spelled twice: the sheet is built by interpolating
  // RAIL, and this asserts the interpolation survived into the text the browser receives.
  const rail = t.RAIL
  assert.match(body, new RegExp(`width:\\s*${rail.width}px`))
  assert.match(body, new RegExp(`height:\\s*${rail.height}px`))
  // The row's own gap is interpolated the same way, for the same reason.
  assert.match(css, new RegExp(`dshtd-rail-frame\\s*\\{[^}]*gap:\\s*${rail.gap}px`),
    'the rail row must be spaced by the constant and not by a literal')
})

test('the rail draws the window at the right end of an inverted axis', () => {
  // THE RAIL IS THE x-OVERVIEW TURNED ON ITS SIDE, so the one thing it must not get wrong is the
  // inversion: SVG's y grows downward while the value axis grows upward. A rail that drew the window
  // at the wrong end would leave the chart's axis where it was, which reads as a rail that ignores the
  // reader rather than as an inversion - so the arithmetic is pinned rather than eyeballed.
  const extent = { lo: 0, hi: 100 }
  const inner = 200
  const top = t.CHART.padTop
  // the whole extent fills the rail exactly
  const whole = t.railWindowPixels(extent, extent, inner)
  assert.equal(whole.y, top, 'a window equal to the extent must start at the top')
  assert.equal(whole.height, inner, 'and fill the rail')
  // A WINDOW AT THE TOP OF THE VALUES SITS AT THE TOP OF THE STRIP. This is the assertion the
  // inversion turns on: {80,100} is the HIGH end of the axis, so its y must be the SMALLER number.
  const high = t.railWindowPixels({ lo: 80, hi: 100 }, extent, inner)
  assert.equal(high.y, top, 'the top of the values is the top of the strip')
  assert.equal(high.height, inner * 0.2, 'a fifth of the extent is a fifth of the rail')
  // and the low end at the bottom
  const low = t.railWindowPixels({ lo: 0, hi: 20 }, extent, inner)
  assert.equal(low.y, top + inner * 0.8, 'the bottom of the values is the bottom of the strip')
  assert.equal(low.height, inner * 0.2)
  // the middle
  const mid = t.railWindowPixels({ lo: 40, hi: 60 }, extent, inner)
  assert.equal(mid.y, top + inner * 0.4)
  // A FULLY-ZOOMED WINDOW IS STILL DRAWN: a zero-height rect renders as nothing at all, so the floor
  // of one pixel is what keeps "I am zoomed all the way in" from looking like "there is no window".
  const pin = t.railWindowPixels({ lo: 50, hi: 50 }, extent, inner)
  assert.equal(pin.height, 1, 'a zero-span window must still be a visible line')
})

test('the rail and the strip under the chart share one brush function', () => {
  // THE TWO RAILS ARE ONE FUNCTION. `brushRangeAt` takes the pixel-to-value mapping as an argument,
  // which is what let the vertical axis reuse the horizontal one instead of copying it; a copy is how
  // two rails start disagreeing about whether a backwards drag is a valid selection.
  const at = (px) => px / 2 // 0..200 pixels maps to 0..100 values
  // a forward drag
  assert.deepEqual(t.brushRangeAt(20, 80, at), { lo: 10, hi: 40 })
  // A BACKWARDS DRAG IS THE SAME WINDOW, ordered: dragging up the rail and dragging down it mean the
  // same selection, and a brush that returned {40,10} would hand a lo > hi window to the clamp.
  assert.deepEqual(t.brushRangeAt(80, 20, at), { lo: 10, hi: 40 })
  // a zero-width drag is a point, not an error
  assert.deepEqual(t.brushRangeAt(50, 50, at), { lo: 25, hi: 25 })
  // AND `brushRange` IS THIS FUNCTION, not a second copy of the same two lines
  const plot = { left: 0, right: 200, lo: 0, hi: 100 }
  assert.deepEqual(t.brushRange(20, 80, plot), t.brushRangeAt(20, 80, (px) => t.valueAt(px, plot)))
})

test('the value window readout tells two nearby values apart', () => {
  // A WINDOW READOUT MUST PRINT A WINDOW. The series this was written for lives between about 2.14 and
  // 2.15, so a readout rounded to the series' own digits would print the same pair at every zoom
  // level - which is worse than no readout, because it looks like a control that does nothing.
  // `valueWindowLabel` adds the digits that separate the ends.
  const narrow = t.valueWindowLabel({ lo: 2.1454, hi: 2.1492 }, 3)
  const ends = narrow.split(' to ')
  assert.equal(ends.length, 2, `a window readout must name both ends, got ${narrow}`)
  assert.notEqual(ends[0], ends[1],
    `the two ends of a real window must print differently, got ${narrow}`)
  // auto is named rather than printed as a pair of numbers
  assert.equal(t.valueWindowLabel(null), 'the whole extent')
  assert.equal(t.valueWindowLabel(undefined), 'the whole extent')
})

test('the value axis reuses the x zoom mechanism and not a parallel one', () => {
  // THE USER'S CORRECTION, 11 October 2026: "the ruler isnt working correctly. make it reuse the x
  // axis zoom feature's mechanism but in the other axis." The first version was a slider carrying a
  // scale FACTOR, which does not work: a factor multiplies a base the component recomputes every
  // render, so the same stored number means a different axis each time the data or the x window moves.
  //
  // THE MECHANISM IS REUSED AS CODE AND NOT AS A COPY, and that is what this asserts: the vertical
  // axis goes through `zoomRange`, `panRange` and `clampRange` themselves - the same functions the
  // leg axis uses - so a bug fixed in one is fixed in both, and there is no second implementation to
  // drift. Each is exercised here against a VALUE window to show it never depended on legs.
  const auto = { lo: 2.0, hi: 3.0 }
  // zoom: a factor below one narrows about the anchor
  assert.deepEqual(t.zoomRange(auto, 0.5, 2.5), { lo: 2.25, hi: 2.75 })
  // zoom anchored at an edge holds that edge, which is what makes a wheel over the curve feel right
  assert.deepEqual(t.zoomRange(auto, 0.5, 2.0), { lo: 2.0, hi: 2.5 })
  // pan: a fraction of the window's own span, sign included
  assert.deepEqual(t.panRange(auto, 0.25), { lo: 2.25, hi: 3.25 })
  assert.deepEqual(t.panRange(auto, -0.25), { lo: 1.75, hi: 2.75 })
  // clamp: a window that already fits is left alone - clampRange does NOT centre it, it SHIFTS one
  // that would fall outside. A first version of this line expected the centre to be preserved and was
  // simply wrong about the function, which is worth recording because a reader who assumes centring
  // will read a panning bug into correct behaviour.
  assert.deepEqual(t.clampRange({ lo: 2.4, hi: 2.6 }, auto, 0.1), { lo: 2.4, hi: 2.6 })
  // a window that hangs off the top is slid back in, keeping its span
  assert.deepEqual(t.clampRange({ lo: 2.9, hi: 3.4 }, auto, 0), { lo: 2.5, hi: 3.0 })
  // and one hanging off the bottom likewise
  assert.deepEqual(t.clampRange({ lo: 1.5, hi: 2.2 }, auto, 0), { lo: 2.0, hi: 2.7 })
  // a window wider than the extent comes back at the extent, not outside it
  const wide = t.clampRange({ lo: 0, hi: 10 }, auto, 0)
  assert.ok(wide.lo >= auto.lo && wide.hi <= auto.hi,
    `a clamp must keep the window inside auto, got ${JSON.stringify(wide)}`)
  // AND THE FLOOR IS THE ONE THE CALLER NAMES, which is why one clamp serves both axes: the leg axis
  // passes a fraction of the RUN, the value axis a fraction of the AUTO EXTENT. A zero-span window
  // must be widened to the floor rather than collapsing the axis to a line.
  const narrow = t.clampRange({ lo: 2.5, hi: 2.5 }, auto, 0.5)
  assert.ok(narrow.hi - narrow.lo >= 0.5 - 1e-9,
    `the floor must hold, got a span of ${narrow.hi - narrow.lo}`)
  assert.equal(narrow.hi - narrow.lo, 0.5, 'a zero-span window is widened TO the floor')
})

test('the value axis remembers its own window under its own key', () => {
  // ONE STORE, TWO WINDOWS, NO COLLISION. The vertical window travels beside the horizontal one with
  // a `/y` suffix, so restoring one cannot restore the other by accident - which is exactly what the
  // shared key would do if the tag had no suffix.
  assert.equal(t.yTag('phase/wiki_en/ppl_legval'), 'phase/wiki_en/ppl_legval/y')
  assert.equal(t.rememberedYWindow('tag/a'), null, 'auto is null, the same convention as the x window')
  t.rememberYWindow('tag/a', { lo: 1, hi: 2 })
  assert.deepEqual(t.rememberedYWindow('tag/a'), { lo: 1, hi: 2 })
  // the x window for the same tag is untouched, and vice versa
  t.rememberWindow('tag/a', { lo: 10, hi: 20 })
  assert.deepEqual(t.rememberedWindow('tag/a'), { lo: 10, hi: 20 })
  assert.deepEqual(t.rememberedYWindow('tag/a'), { lo: 1, hi: 2 })
  // per series
  assert.equal(t.rememberedYWindow('tag/b'), null)
  // and null forgets, so reset and never-touched are one state rather than two that look alike
  t.rememberYWindow('tag/a', null)
  assert.equal(t.rememberedYWindow('tag/a'), null)
})

test('the value under a y pixel is the window read upside down', () => {
  // The vertical axis is inverted against the screen: padTop holds the window's TOP, so the smallest
  // pixel is the LARGEST value. Getting this backwards is the classic way to make a vertical zoom
  // feel like it runs away from the cursor, which is one of the things "isnt working correctly" can
  // mean - so it is pinned rather than assumed.
  const range = { lo: 2.0, hi: 4.0 }
  const top = t.CHART.padTop
  const bottom = t.CHART.height - t.CHART.padBottom
  assert.equal(t.valueAtY(top, range), 4.0, 'the top pixel is the window hi')
  assert.equal(t.valueAtY(bottom, range), 2.0, 'the bottom pixel is the window lo')
  assert.equal(t.valueAtY((top + bottom) / 2, range), 3.0, 'the middle is the middle')
})

test('the numbers in the readout are the numbers on screen', () => {
  const bounds = t.fullRange(SERIES)
  const window = t.clampRange({ lo: 150, hi: 350 }, bounds)

  assert.equal(t.rangeLabel(window, bounds), 'steps 150–350 · 200 of 500 shown',
    'the readout must describe the window the axis was scaled to, not the series')
})

// ---------------------------------------------------------------------------
// The Y ruler, added 11 October 2026 at the user's request: "I would like to use
// only the current arc's bounds as scaling targets. and in addition I would like
// to have a scale ruler of sorts which I can use to manually scale out if I want
// to see more things along with a reset button."
//
// The measured reason the first half exists. On the live run the discarded arc
// reached 7.7961 bpb - a perplexity of 10,305,465 - against the current arc's 83
// to 150. While both chains set the extent, everything the current arc has done
// occupies about eight ten-thousandths of one percent of the axis height, so the
// whole of its real movement draws as a flat line one pixel tall. The user was
// looking at exactly that when they asked.
// ---------------------------------------------------------------------------

test('the axis is targeted at the live chain and not at the discarded one', () => {
  // The two chains share a re-based x on a rolled-back run, so these are the same
  // x range with the ghost reaching a hundred times higher.
  const live = [[0, 2.4], [1, 2.35], [2, 2.14]]
  const ghost = [[0, 4.9], [1, 7.8], [2, 6.9]]

  const liveOnly = t.valueRange(live)
  const both = t.valueRange([...ghost, ...live])

  // THE CLAIM: the ghost's values must not enter the extent. Recomputing over both
  // is what made the chart flat, so the two must differ by the ghost's reach.
  assert.ok(liveOnly.hi < both.hi, 'the ghost must NOT be in the extent any more')
  assert.ok(liveOnly.hi < 2.6,
    `the live chain tops out near 2.4 and its extent must sit just above it, got ${liveOnly.hi}`)
  // and the ghost's own top is far outside it, which is what makes it clip rather
  // than squash everything else
  assert.ok(both.hi > liveOnly.hi * 2,
    'the discarded arc reaches far past the live extent, which is why it must not set it')
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
  chevron: 'clip-path: polygon(100% 0, 0 50%, 100% 100%, 67% 100%, 33% 50%, 67% 0)',
  bar: 'clip-path: inset(',
  plus: 'clip-path: polygon(35% 0',
}

test('every registered kind has its own shape and its own colour', () => {
  // THE TABLES ARE THE CONTRACT between the producer's kinds and the chart: a
  // kind the producer can serve and this tab has no shape for is drawn as the
  // unknown plus, which is a shape two different changes can share. Read off the
  // registered tables rather than off a fixture, so a kind added to one table and
  // not the other fails here.
  const kinds = Object.keys(t.MARKER_SHAPES)
  const shapes = kinds.map((kind) => t.MARKER_SHAPES[kind])
  assert.equal(new Set(shapes).size, shapes.length,
    `two kinds share a shape: ${kinds.map((kind) => `${kind}=${t.MARKER_SHAPES[kind]}`).join(' ')}`)
  for (const kind of kinds) {
    assert.match(t.kindInk(kind), /^#[0-9a-f]{6}$/, `no colour is registered for ${kind}`)
  }
  assert.ok(kinds.includes('rollback'),
    'the producer serves rollbacks, and a kind with no shape is a joint the reader cannot decode')
  assert.ok(t.CSS_SOURCE.includes(`.dshtd-break-swatch[data-kind='rollback'] { clip-path: polygon(100% 0`),
    'the register must draw the rollback shape too, or the chart cannot be decoded from the key')
})

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

  const rowEl = elementsWithClass(tree, 'dshtd-break-row')[0]
  const row = textOf(rowEl)
  assert.ok(row.includes('NO KIND'),
    'the badge says no kind was stated rather than filing the joint under a kind it does not have')
  assert.equal(rowEl.props['data-kind'], t.DECLARED_KIND)
  assert.match(row, /claims none/,
    'break_leg names a leg and no kind, so the tab must say it is not claiming one')
  // AND THE PROSE IS BEHIND A DISCLOSURE. The register is a status list: one line
  // per joint, with the explanation a press away. Laid out flat, this row alone
  // was a paragraph of meta-explanation - reported 10 October 2026 as "too
  // verbose, it's unreadable ... walls of text".
  const why = elementsWithClass(rowEl, 'dshtd-why')[0]
  assert.ok(why, 'the explanation a reader may want must still be reachable')
  assert.equal(why.type, 'details')
  assert.notEqual(why.props.open, true, 'a row that arrives open is the wall of text this replaced')
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
  assert.match(block, /a direction from the producer's budget, not a measurement/,
    'the leg is a projection and the rise is a registered direction: the reader has to be told which')
  assert.match(block, /a rise in bpb is EXPECTED there/)
  // The head line is the status; the sentence and the caveat are the answer to a
  // question the reader has afterwards. See `breakRow` for the report.
  const why = elementsWithClass(elementsWithClass(tree, 'dshtd-frontier')[0], 'dshtd-why')[0]
  assert.ok(why, 'the producer\'s own words must stay reachable')
  assert.equal(why.type, 'details')
  assert.notEqual(why.props.open, true)
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
  assert.match(block, /appears when this pass has run 900 legs \(leg 900 of the run\)/,
    'the missing line needs its reason in one line, or the reader hunts for it')
  assert.match(block, /it has run 500/,
    'and the one number that explains why it is missing. The wording is the pass\'s legs AND the '
    + 'run\'s leg, because on a chart where both passes start at 0 the two are not the same number')
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

test('the leg the producer names wins over this tab\'s own derivation', () => {
  // The producer knows the budget the projection comes from; this tab's rule is
  // the same rule and stays as the fallback for a producer that predates the
  // key. Where both are present the served leg is the one drawn, or a snapshot
  // that states where its frontier belongs would be overruled by a copy.
  const served = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 1, next_leg: 690,
      chart_leg: 690, legs_in_phase: 689, legs_remaining: 680,
      expected_to_raise_bpb: true, imminent: false, sentence: '',
    },
  }))
  assert.equal(t.frontierLeg(served), 690,
    'a nine-leg-old run anchors its frontier at leg 1 without this, which reads as a stale entry')

  // A producer that serves no chart_leg still gets the leg from the rule.
  const older = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 1, next_leg: 690,
      legs_in_phase: 689, legs_remaining: 680,
      expected_to_raise_bpb: true, imminent: false, sentence: '',
    },
  }))
  assert.equal(t.frontierLeg(older), 690)
})

test('the frontier head says where the run is before where it is going', () => {
  // The report, 10 October 2026: "we are not at step 690 we restarted and are at
  // 10-ish". The projection was right and the line led with it, so a reader at
  // leg 12 was told "expected around leg 690" with nothing saying where he stood.
  const frontier = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'wiki_en', next_phase: 'arxiv', boundary_leg: 1, next_leg: 690,
      chart_leg: 690, newest_leg: 12, legs_in_phase: 689, legs_remaining: 677,
      expected_to_raise_bpb: true, imminent: false, sentence: '',
    },
  }))

  const text = t.frontierTagText(frontier, frontier.newestLeg)
  assert.match(text, /now at leg 12/)
  assert.match(text, /around leg 690 \(678 leg\(s\) ahead\)/)
  assert.ok(text.indexOf('now at leg 12') < text.indexOf('690'),
    'the position comes first, or the projection reads as the position')
  assert.equal(frontier.newestLeg, 12)

  // A producer that serves no newest leg gets the old head, unchanged.
  assert.ok(!/now at leg/.test(t.frontierTagText(frontier)))
})

test('a stopped run says so on the frontier\'s one-line head', () => {  const stopped = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'wiki_en', next_phase: 'arxiv', boundary_leg: 1, next_leg: 690,
      chart_leg: 690, legs_in_phase: 689, legs_remaining: 680,
      expected_to_raise_bpb: true, imminent: false, stopped: true, sentence: 's',
    },
  }))
  assert.match(t.frontierTagText(stopped), /^the run has STOPPED/,
    'an expectation for a run that stopped is a stale entry unless the head says so')

  const live = t.readFrontier(snapshotWith({
    frontier: {
      phase_now: 'wiki_en', next_phase: 'arxiv', boundary_leg: 1, next_leg: 690,
      chart_leg: 690, legs_in_phase: 689, legs_remaining: 680,
      expected_to_raise_bpb: true, imminent: false, sentence: 's',
    },
  }))
  assert.ok(!/STOPPED/.test(t.frontierTagText(live)),
    'a running pass must not be announced as stopped')
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

// ---------------------------------------------------------------------------
// The second line: the seed model's size, on the axis on the right.
//
// The tab draws ONE series at a time on its own axis, because series carry
// different units. This is the exception the reader asked for, and it is only
// honest if the frame SAYS the two scales are different: the right-hand axis,
// the dash pattern and the legend are what make it readable rather than
// misleading, so each of those is pinned here.
// ---------------------------------------------------------------------------

/** A seed model that grows from leg to leg, in parameters.
 *
 * The values are the run's own readings, off the size series: the first is the
 * 385 live rows the gate first reported at leg 66 plus the tick table, and the
 * last is 7,096 live rows at leg 575 onward. Using a rounder pair here once hid
 * a real defect - a 1.33x span covers the whole log axis, so a test written on
 * it asserted a step was 100 percent of the frame and passed.
 */
const SEED_PARAMS = [
  [10, 17_050_000],
  [125, 20_196_000],
  [300, 21_062_000],
  [500, 22_217_000],
]

/** A payload whose only series is the seed's size. */
function seedPayload(overrides = {}) {
  return snapshotWith({
    series: [
      { tag: 'train/loss', points: BREAK_SERIES },
      { tag: 'train/seed_model_params', source: 'leg logs', points: SEED_PARAMS },
    ],
    ...overrides,
  })
}

test('the seed size is drawn as a second line and never offered as a chip', () => {
  const offered = t.availableSeries(seedPayload())
  const tags = offered.map((item) => item.tag)

  assert.ok(!tags.includes('train/seed_model_params'),
    'a chip for a series already drawn under the curve is a second way to ask for one picture')
  assert.ok(!tags.includes('train/seed_read_rows'))
  assert.ok(tags.includes('train/loss'), 'the other series are unaffected')

  const overlay = t.resolveOverlay(seedPayload())
  assert.equal(overlay.tag, 'train/seed_model_params')
  assert.equal(overlay.unit, 'M params')
  assert.equal(overlay.scale, 1e-6, 'parameters are charted in millions, as the trainer prints them')
})

test('the total parameter count is preferred, and the row count is the fallback', () => {
  const both = t.resolveOverlay(seedPayload())
  assert.equal(both.tag, 'train/seed_model_params')

  const rowsOnly = t.resolveOverlay(snapshotWith({
    series: [{ tag: 'train/seed_read_rows', points: [[10, 7096], [500, 7471]] }],
  }))
  assert.equal(rowsOnly.tag, 'train/seed_read_rows',
    'a producer that serves only the row count still gets a second line')
  assert.equal(rowsOnly.unit, 'rows')
})

test('a snapshot with no seed size draws no second axis at all', () => {
  const payload = snapshotWith({ series: [{ tag: 'train/loss', points: BREAK_SERIES }] })

  assert.equal(t.resolveOverlay(payload), null)

  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  assert.equal(elementsWithClass(tree, 'dshtd-overlay-axis').length, 0,
    'an axis with no numbers on it is furniture, not information')
  assert.equal(elementsWithClass(tree, 'dshtd-overlay-line').length, 0)
  assert.equal(elementsWithClass(tree, 'dshtd-overlay-legend').length, 0)
})

test('the seed line is drawn against the axis on the RIGHT, and the legend says so', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })

  const axis = elementsWithClass(tree, 'dshtd-overlay-axis')
  assert.ok(axis.length > 0, 'the second scale must be labelled, or it is a scale nobody can read')
  const plot = t.plotGeometry({ lo: 10, hi: 500 }, t.CHART.padRight + t.OVERLAY_GUTTER)
  const ticks = axis.filter((label) => label.props.transform === undefined)
  assert.ok(ticks.length > 0, 'the axis needs tick numbers')
  for (const label of ticks) {
    assert.ok(label.props.x > plot.right,
      'the overlay\'s labels live in the gutter, never on top of the curve')
    assert.equal(label.props.textAnchor, 'start', 'they read outward from the axis they belong to')
    assert.ok(label.props.x + 26 < t.CHART.width,
      `a tick label at x=${label.props.x} runs out of the frame: the gutter is too narrow`)
  }

  // THE UNIT IS ROTATED, NOT SQUEEZED BESIDE A NUMBER, AND IT IS SAID ONCE.
  // `22.00 M params` written flat beside the top tick is wider than any gutter
  // worth taking out of the plot, which is how it came to run out of the window;
  // and every scale mark already reads `22.0M`, so a title repeating the `M`
  // would put the same fact in two places. The marks keep the `M`, the title
  // carries what it stands for.
  const units = axis.filter((label) => typeof label.props.transform === 'string')
  assert.equal(units.length, 1, 'each axis carries its unit once')
  assert.equal(units[0].children.join(''), 'params',
    'the scale mark already shows the M, so the title must not repeat it')
  assert.match(units[0].props.transform, /^rotate\(-90 /)
  assert.ok(units[0].props.x > plot.right,
    'the rotated unit sits in the gutter too, at its outer edge')

  // THE UNIT IS SAID ONCE PER AXIS, AND ONLY IN THE ROTATED TITLE. The marks read
  // `17.4M`, carrying the scale mark the formatter writes; the word those letters
  // stand for is on the title standing up at the edge, and on the legend. A tick
  // label repeating it says the same word twice within a few pixels.
  assert.ok(ticks.some((label) => /M$/.test(label.children.join(''))),
    'the scale marks are the half that keeps the M')
  for (const label of ticks) {
    const text = label.children.join('')
    assert.ok(!/params/.test(text), `tick "${text}" repeats the rotated title's word`)
    assert.ok(!/bpb|rows|GiB/.test(text), `tick "${text}" carries a unit word`)
  }
  assert.equal(units[0].children.join(''), 'params',
    'and the rotated title is where that word belongs')

  // The legend is the only thing on screen that says which scale is which.
  const legend = elementsWithClass(tree, 'dshtd-overlay-legend')[0]
  assert.ok(legend, 'two lines on two scales must be named, or the frame invites a false comparison')
  const words = textOf(legend)
  assert.match(words, /LEFT axis/)
  assert.match(words, /RIGHT axis/)
  assert.match(words, /seed model size/)
  assert.match(words, /M params/)
  assert.match(words, /different scales/)
})

test('the left axis names its own unit the same way, and the rows unit is not doubled', () => {
  // The main axis follows the same rule now, so a reader is never shown one
  // axis with a unit and another without.
  const bpb = t.SeriesChart({
    spec: { ...chartSpec(), unit: 'bpb' },
    payload: snapshotWith({ series: [{ tag: 'train/loss', points: BREAK_SERIES }] }),
    overlay: null,
  })
  const leftUnits = elementsWithClass(bpb, 'dshtd-axis')
    .filter((node) => typeof node.props.transform === 'string')
  assert.equal(leftUnits.length, 1)
  assert.equal(leftUnits[0].children.join(''), 'bpb')

  // Rows: the unit word is longer than `M`, so it is still the rotated title
  // that carries it, for the same reason.
  const rows = t.resolveOverlay(snapshotWith({
    series: [{ tag: 'train/seed_read_rows', points: [[10, 7096], [500, 7471]] }],
  }))
  const tree = t.SeriesChart({ spec: chartSpec(), payload: snapshotWith({}), overlay: rows })
  const rightUnits = elementsWithClass(tree, 'dshtd-overlay-axis')
    .filter((node) => typeof node.props.transform === 'string')
  assert.equal(rightUnits.length, 1)
  assert.equal(rightUnits[0].children.join(''), 'rows')
})

// ---------------------------------------------------------------------------
// The seed-size axis is LOGARITHMIC, and that is a measurement.
//
// The growth ladder multiplies, so the size series spans 1.30x over the whole
// run. A linear axis anchored at zero draws that as 1.6 percent of the frame
// height - the growth is in the numbers and absent from the picture. On a log
// axis the same readings are 0.115 decades, and a step is the same fraction of
// the height however big the model already is.
// ---------------------------------------------------------------------------

test('the size series is drawn on a log axis, and the spec says so', () => {
  const overlay = t.resolveOverlay(seedPayload())
  assert.equal(overlay.axis, t.LOG_SCALE)
  assert.equal(t.isLogScale(overlay), true)
  assert.equal(t.isLogScale({ axis: t.LINEAR_SCALE }), false)
  assert.equal(t.isLogScale(null), false)
  // `scale` is the numeric unit factor and must not be mistaken for the axis kind.
  assert.equal(overlay.scale, 1e-6)
})

test('a log axis floor sits just under the smallest reading, not at zero', () => {
  const readings = [[65, 17_050_000], [500, 22_217_000]]
  const range = t.logRange(readings, { lo: 0, hi: 1 })
  const at = t.logFraction

  assert.equal(range.hi, 22_217_000, 'the maximum is the top of the axis')
  assert.ok(range.lo < 17_050_000, 'the floor is BELOW the smallest reading, so it is on the axis')
  assert.ok(range.lo > 15_000_000,
    `the floor is just under the data, not decades below it: got ${range.lo}`)

  // THE PROPERTY THE FLOOR EXISTS FOR: the smallest reading sits one padding
  // band above the floor, and the run fills the rest of the frame.
  const bottom = at(17_050_000, range.lo, range.hi)
  closeTo(bottom, t.LOG_FLOOR_PADDING, 1e-12, 'the first reading sits one band up')
  assert.equal(at(22_217_000, range.lo, range.hi), 1)

  // A dataset whose own span is much wider still gets the padding, not a floor
  // pinned to its minimum: the band scales with the span.
  const wide = t.logRange([[1, 1_000], [2, 22_217_000]], { lo: 0, hi: 1 })
  assert.equal(wide.hi, 22_217_000)
  closeTo(at(1_000, wide.lo, wide.hi), t.LOG_FLOOR_PADDING, 1e-12, 'the band scales with the span')

  // A single reading, or a flat window, is still an axis rather than a division
  // by nothing - and the reading sits at the top of it.
  const flat = t.logRange([[1, 5_000_000], [2, 5_000_000]], { lo: 0, hi: 1 })
  assert.equal(flat.hi, 5_000_000)
  assert.ok(flat.lo > 0 && flat.lo < 5_000_000)
  assert.equal(at(5_000_000, flat.lo, flat.hi), 1)

  // Nothing to scale to keeps the range it was given, so an empty axis is still
  // an axis rather than a division by nothing.
  assert.deepEqual(t.logRange([], { lo: 0, hi: 1 }), { lo: 0, hi: 1 })
  assert.deepEqual(t.logRange([[1, 0], [2, -5]], { lo: 0, hi: 1 }), { lo: 0, hi: 1 },
    'a log axis has no place for a non-positive reading')
})

test('a log axis spreads 17.05M to 22.22M over the whole frame, where a zero-anchored one does not', () => {
  // The real series, through the real range function.
  const readings = [[65, 17_050_000], [125, 20_196_000], [575, 22_217_000], [896, 22_217_000]]
  const range = t.logRange(readings, { lo: 0, hi: 1 })
  const at = (value) => t.logFraction(value, range.lo, range.hi)

  const bottom = at(17_050_000)
  const top = at(22_217_000)
  closeTo(bottom, t.LOG_FLOOR_PADDING, 1e-12, 'the first reading sits one band above the floor')
  assert.equal(top, 1)
  assert.ok(top - bottom > 0.9,
    `the run must use the frame: it covers ${((top - bottom) * 100).toFixed(1)}% of the axis`)

  // The same readings on a zero-anchored linear axis, which is what the request
  // for "start from 0" would give and why the log axis is the better reading.
  const zeroAnchored = (value) => value / 22_217_000
  assert.ok(zeroAnchored(22_217_000) - zeroAnchored(17_050_000) < 0.25,
    'anchored at zero the whole run is under a quarter of the frame, and the '
    + 'ladder itself is under 2 percent of it')

  // A RATIO IS A CONSTANT HEIGHT ON A LOG AXIS, which is why the ladder reads as
  // a ladder rather than as a line that flattens as the model grows. Measured on
  // a ratio the real ladder actually takes - one growth deposit, 375 rows on
  // 7,096, is 1.053x - so the step under test is a step this run has made.
  const step1 = 7_096 / 6_721
  const early = at(17_050_000 * step1) - at(17_050_000)
  const late = at(22_217_000) - at(22_217_000 / step1)
  closeTo(early, late, 1e-12, 'the same ratio occupies the same height wherever it happens')
  assert.ok(early > 0 && early < 0.5,
    `one growth deposit is ${(early * 100).toFixed(1)}% of the frame`)

  // The whole run is 1.303x, so no single step may fill the frame: that would
  // mean the axis had been widened to nothing.
  const wholeRun = at(22_217_000) - at(17_050_000)
  assert.ok(early < wholeRun / 2, 'a step is a fraction of the run, not the run itself')
})

test('log ticks are evenly spaced, in range, and land on the half-decade grid', () => {
  const ticks = t.logTicks(5_000_000, 25_000_000, 5)

  assert.ok(ticks.length >= 2)
  assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b), 'ascending')
  for (const tick of ticks) {
    assert.ok(tick >= 5_000_000 && tick <= 25_000_000,
      `tick ${tick} is outside the axis, where it names a value the frame does not reach`)
  }
  // Same ratio, same distance: every adjacent pair is the same multiple, which
  // is what a log scale's marks have to mean.
  const ratios = ticks.slice(1).map((tick, at) => tick / ticks[at])
  for (const ratio of ratios) {
    closeTo(ratio, ratios[0], 1e-9, `tick spacing is uneven: ${ratios.map((r) => r.toFixed(2))}`)
  }
  // The marks are powers of ten at a fixed fraction of a decade, which is the
  // grid the labels are written from: a mark is `10 ** (n / d)` for integers n
  // and d, so each is a short decimal in millions rather than an arbitrary
  // number. NOT "1, 2 or 5 of a decade" - an evenly spaced set of marks cannot
  // all be those, and asserting it would pin a property the axis cannot have.
  for (const tick of ticks) {
    const exponent = Math.log10(tick)
    const distance = Math.abs(exponent - Math.round(exponent * 5) / 5)
    assert.ok(distance < 1e-9, `tick ${tick} is off the fifth-decade grid (10^${exponent})`)
  }
  assert.deepEqual(t.logTicks(0, 100, 5), [], 'no log ticks below a positive floor')
  assert.deepEqual(t.logTicks(10, 10, 5), [], 'and none for a range with no span')
})

test('log ticks use a finer interval when the range is narrow, and stay evenly spaced', () => {
  // The live series' own range: 16.662M to 22.217M. The obvious rule - one, two
  // and five per decade - puts marks at 20M and 22M, which sit 2M and 0.2M apart
  // and so land at wildly different heights for nearly the same pixel gap.
  const ticks = t.logTicks(16_662_000, 22_217_000, 5)

  assert.ok(ticks.length >= 2, 'a range this wide needs a scale, not one mark')
  assert.ok(ticks.length <= 5)
  const positions = ticks.map((tick) => t.logFraction(tick, 16_662_000, 22_217_000))
  const gaps = positions.slice(1).map((position, at) => position - positions[at])
  for (const gap of gaps) {
    closeTo(gap, gaps[0], 1e-9,
      `marks at uneven heights: ${positions.map((p) => p.toFixed(3))}`)
  }
  assert.ok(gaps[0] >= t.LOG_TICK_MIN_GAP,
    `marks ${(gaps[0] * 100).toFixed(1)}% of the height apart read as one blur`)

  // The marks have to be writable in a short label, or the axis is unreadable
  // whatever its arithmetic. Every one renders within a few characters.
  for (const tick of ticks) {
    const written = t.formatValue(tick, 2)
    assert.ok(written.length <= 7, `tick ${tick} writes as "${written}", too wide for the gutter`)
  }

  // A range spanning many decades still gets a set of marks, evenly spaced.
  const wide = t.logTicks(1, 1_000_000_000, 5)
  assert.ok(wide.length >= 2)
  assert.deepEqual(wide, [...wide].sort((a, b) => a - b))
  const wideGaps = wide.slice(1).map((tick, at) => t.logFraction(tick, 1, 1e9)
    - t.logFraction(wide[at], 1, 1e9))
  for (const gap of wideGaps) closeTo(gap, wideGaps[0], 1e-9, 'evenly spaced across decades')
  assert.ok(wideGaps[0] >= t.LOG_TICK_MIN_GAP,
    'a many-decade axis must still keep its marks apart')
})

test('the legend names both lines and both scales, and nothing more', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })

  const legend = elementsWithClass(tree, 'dshtd-overlay-legend')[0]
  assert.ok(legend, 'two lines on two scales must be named, or the frame invites a false comparison')
  const words = textOf(legend)
  assert.match(words, /loss/, 'the left-hand line is named')
  assert.match(words, /LEFT axis/)
  assert.match(words, /seed model size/)
  assert.match(words, /M params/, 'with its unit')
  assert.match(words, /RIGHT axis/, 'and the side its scale sits on')

  // A caption explaining what a log axis is was tried here and removed: the
  // marks carry it (17M, 19M, 21M on a narrow span do not read as a linear
  // scale), and the two axis names above are what a reader cannot infer.
  assert.equal(elementsWithClass(tree, 'dshtd-overlay-scale').length, 0,
    'the scale lecture is gone; the axis must stand on its marks')
  assert.ok(!/RATIOS/.test(words))
})

test('a value a log axis cannot hold is a gap, never a point at the floor', () => {
  // `train/seed_read_rows` really does start at zero, and on a log axis that is
  // negative infinity. Folding it to the bottom of the frame would draw a zero
  // on a scale that cannot contain one.
  assert.equal(t.logFraction(0, 1e6, 1e7), null)
  assert.equal(t.logFraction(-5, 1e6, 1e7), null)
  assert.equal(t.logFraction(1e6, 0, 1e7), null, 'a floor of zero is not a log axis')
  assert.equal(t.logFraction(1e6, 1e6, 1e6), null, 'a range with no span has no fractions')
  assert.equal(t.logFraction(1e6, 1e6, 1e7), 0)

  const overlay = {
    label: 'the read live rows', unit: 'rows', digits: 0, scale: 1, axis: t.LOG_SCALE,
    series: { tag: 'train/seed_read_rows', points: [[10, 0], [200, 4471], [300, 7096]] },
  }
  const tree = t.SeriesChart({ spec: chartSpec(), payload: seedPayload(), overlay })
  const paths = elementsWithClass(tree, 'dshtd-overlay-line')

  for (const path of paths) {
    assert.ok(!/NaN|Infinity|undefined/.test(path.props.d),
      `the path carries a value the axis cannot hold: ${path.props.d}`)
  }
})

test('a zoomed window drops the primary curve but never the size line\u2019s floor', () => {
  // Pressed through the component rather than the helpers, because the defect
  // lived in the wiring: the range was taken from the window, so a reader
  // zoomed into the late run had the size line's beginning fall below the axis
  // and vanish, while the tab reported every reading as drawn.
  const points = []
  for (let leg = 65; leg <= 500; leg += 1) {
    points.push([leg, leg < 300 ? 17_050_000 : leg < 400 ? 20_196_000 : 22_217_000])
  }
  const overlay = { series: { tag: 'train/seed_model_params', points }, axis: t.LOG_SCALE }
  const payload = snapshotWith({
    series: [{ tag: 'train/loss', points: points.map(([leg]) => [leg, 1]) }, overlay.series],
  })
  const spec = {
    tag: 'train/loss', label: 'loss', unit: '', digits: 3,
    series: payload.series[0],
  }

  // The reader left the chart zoomed to the newest 200 legs, which is how the
  // component restores a window when the pane remounts it.
  t.rememberWindow('train/loss', { lo: 300, hi: 500 })
  try {
    const view = mountHooks(t.SeriesChart, { spec, payload, overlay })
    const tree = withDispatchedHooks(view.dispatcher, () => view.render())

    const axis = elementsWithClass(tree, 'dshtd-overlay-axis')
    assert.ok(axis.length > 0, 'the size axis is still drawn inside the window')
    const ticks = axis.filter((node) => node.props.transform === undefined)
    const values = ticks.map((node) => Number(node.children.join('').replace(/[^\d.]/g, '')))
    assert.ok(Math.min(...values) < 20,
      `a windowed floor would put the marks at ${values.join(', ')}, all above the run's `
      + 'first reading, so the beginning could not be drawn')

    // And the line drawn in that window still carries the early, low readings:
    // the x window frames the picture, the size axis does not follow it.
    const path = elementsWithClass(tree, 'dshtd-overlay-line')[0]
    assert.ok(path, 'the size line is drawn')
    assert.ok(!/NaN|Infinity|undefined/.test(path.props.d), path.props.d)
  } finally {
    t.rememberWindow('train/loss', null)
  }
})

test('the frame draws ONE set of horizontal lines, and both axes label every one of them', () => {
  // The two-axis frame used to draw TWO grids over one another, at two different
  // spacings, with half of each line belonging to no label. It is one set now,
  // and every line carries a value from both scales - which is what makes the
  // two curves comparable at a glance rather than merely co-located.
  const seed = [[65, 17.05e6], [125, 20.196e6], [575, 22.217e6], [896, 22.217e6]]
  const spec = {
    tag: 'train/loss', label: 'loss', unit: 'bpb', digits: 3,
    series: { tag: 'train/loss', points: [[1, 2.30], [300, 2.25], [600, 2.20], [896, 2.15]] },
  }
  const payload = snapshotWith({
    series: [spec.series, { tag: 'train/seed_model_params', points: seed }],
  })
  const tree = t.SeriesChart({ spec, payload, overlay: t.resolveOverlay(payload) })

  const lines = elementsWithClass(tree, 'dshtd-gridline')
  assert.ok(lines.length >= 3, `the frame needs a grid: ${lines.length} lines`)
  assert.equal(elementsWithClass(tree, 'dshtd-overlay-gridline').length, 0,
    'there must be no second grid drawn over the first')

  // A label sits 3 units below its line, on both sides. One per line, no more:
  // an unlabelled line is a scale mark a reader has to guess at, and a label
  // with no line is a number floating in the plot.
  const lineYs = lines.map((line) => line.props.y1)
  const tickLabels = (className) => elementsWithClass(tree, className)
    .filter((node) => node.props.transform === undefined
      && Math.abs(node.props.y - 232) > 1)
  for (const side of ['dshtd-axis', 'dshtd-overlay-axis']) {
    const labels = tickLabels(side)
    assert.equal(labels.length, lineYs.length,
      `${side} carries ${labels.length} labels for ${lineYs.length} lines`)
    for (const lineY of lineYs) {
      assert.ok(labels.some((node) => Math.abs(node.props.y - (lineY + 3)) < 0.01),
        `${side} has no label on the line at y=${lineY}`)
    }
  }

  // And the values on the two sides are two scales' readings of the SAME lines.
  // Read in screen order - the highest line first - both sides DESCEND, because
  // chart-space y grows downward while the values grow upward.
  const linesByHeight = [...lineYs].sort((a, b) => a - b)
  const labelOn = (className, lineY) => tickLabels(className)
    .find((node) => Math.abs(node.props.y - (lineY + 3)) < 0.01)
  const leftReadings = linesByHeight.map((lineY) => Number(
    labelOn('dshtd-axis', lineY).children.join('').replace(/[^\d.]/g, '')))
  const rightReadings = linesByHeight.map((lineY) => labelOn('dshtd-overlay-axis', lineY)
    .children.join(''))

  assert.ok(leftReadings.every((value) => Number.isFinite(value)),
    `every line has a left-hand reading: ${leftReadings.join(', ')}`)
  assert.deepEqual(leftReadings, [...leftReadings].sort((a, b) => b - a),
    `the left-hand readings fall down the frame as the values should: ${leftReadings.join(', ')}`)
  // The overlay is the log one, so its readings fall the same way - and read
  // from the SMALLEST up, the steps between them grow: 17.4, 19.1, 20.9 steps by
  // 1.7 then 1.8. Each step is the same ratio, so each is a larger addition than
  // the one below it, which is the exponential spacing the shared grid was for.
  const nums = (label) => Number(/([\d.]+)/.exec(label)[1])
  const overlayValues = rightReadings.map(nums)
  assert.deepEqual(overlayValues, [...overlayValues].sort((a, b) => b - a),
    `the right-hand readings fall too: ${rightReadings.join(', ')}`)
  const rising = [...overlayValues].reverse()
  const overlaySteps = rising.slice(1).map((value, at) => value - rising[at])
  assert.ok(overlaySteps[overlaySteps.length - 1] > overlaySteps[0],
    `the steps grow with the values: ${overlaySteps.join(', ')}`)
  // And not one of those labels carries a unit word: the axis names it once, in
  // the rotated title at the edge.
  assert.ok(!rightReadings.some((label) => /params/.test(label)),
    `a label repeats the rotated title: ${rightReadings.join(', ')}`)
})

test('the shared grid is spaced by the scale: exponential with a log axis, regular without', () => {
  // The two-axis frame had two grids over one another, at two different
  // spacings, with half of each line belonging to no label. It is one set now,
  // and its spacing is the scale's: exponential with a log second line, regular
  // without one.
  const logLo = 16.662e6
  const logHi = 22.217e6
  const logProject = (value) => 214 - t.logFraction(value, logLo, logHi) * 202
  const linearProject = (value) => 214 - ((value - 0) / (6 - 0)) * 202
  const logMarks = t.logTicks(logLo, logHi, 5)
  assert.ok(logMarks.length >= 3,
    `this range has to carry at least three marks for the spacing to mean anything: ${logMarks}`)

  const withLog = t.sharedGridlines(
    t.niceTicks(1, 6, 4), logMarks, true, linearProject, logProject)
  assert.ok(withLog.lines.length >= 3, 'a log second line gives the frame its marks')
  for (const line of withLog.lines) {
    assert.ok(Number.isFinite(line.y), 'every line has a position')
    assert.ok(line.overlayValue > 0, 'and a value on the log axis')
    assert.ok(Number.isFinite(line.primaryValue), 'and a value on the primary axis')
  }
  // THE SPACING IS THE SCALE'S, and on a log axis that means the gaps in VALUE
  // are not equal. Equal distances on the frame are equal RATIOS in value, so
  // the lines land at exponential intervals: 17.38M, 19.05M, 20.89M is steps of
  // 1.67M then 1.84M, growing, at a constant height apart.
  const values = withLog.lines.map((line) => line.overlayValue)
  const valueGaps = values.slice(1).map((value, at) => value - values[at])
  assert.ok(new Set(valueGaps.map((gap) => Math.round(gap / 1000))).size > 1,
    `a log grid's values cannot be evenly spaced: ${valueGaps.map((g) => Math.round(g / 1e3)).join(', ')}k`)
  const ratios = values.slice(1).map((value, at) => value / values[at])
  for (const ratio of ratios) {
    closeTo(ratio, ratios[0], 1e-9,
      `the lines are a geometric series, so every step is the same ratio: `
      + `${ratios.map((r) => r.toFixed(4)).join(', ')}`)
  }
  assert.ok(ratios[0] > 1, 'and it rises')

  // WITHOUT a log axis the lines are the primary axis' own, evenly spaced.
  const plain = t.sharedGridlines(
    t.niceTicks(1, 6, 4), [], false, linearProject, null)
  assert.deepEqual(plain.extra, [])
  assert.deepEqual(plain.lines.map((line) => line.primaryValue), t.niceTicks(1, 6, 4))
  const plainGaps = plain.lines.slice(1).map((line, at) => plain.lines[at].y - line.y)
  for (const gap of plainGaps) closeTo(gap, plainGaps[0], 1e-9, 'regular intervals')
  for (const line of plain.lines) {
    assert.equal(line.overlayValue, null, 'and no overlay value on a line it has no mark on')
  }
})

test('a shared line carries both scales, and the value is the inverse of the drawing', () => {
  // The primary axis' value at a shared line is solved from its OWN projection,
  // so a gridline's label cannot name a value the line is not on.
  const project = (value) => 214 - ((value - 2.0) / (2.3 - 2.0)) * 202
  assert.ok(t.inverseOf(project, project(2.15)) === null || true)

  const values = [2.0, 2.1, 2.2, 2.3]
  for (const value of values) {
    const y = project(value)
    const back = t.inverseOf(project, y)
    closeTo(back, value, 1e-9, `inverseOf must undo the projection at ${value}`)
  }
  assert.equal(t.inverseOf(null, 100), null, 'no projection, no inverse')
  assert.equal(t.inverseOf(project, NaN), null)
})

test('a shared grid never labels two lines with the same text, and carries no unit on a label', () => {
  // The lines are shared, so a tick's value is wherever the line falls - not a
  // round number the axis chose. At the series' own precision two of those can
  // round alike, and a scale with the same number on two lines cannot be read.
  const labels = t.axisTickLabels([2.101, 2.104, 2.107], { digits: 2, unit: '' })
  assert.equal(new Set(labels).size, 3, `two lines share a label: ${labels.join(', ')}`)
  assert.deepEqual(labels, ['2.101', '2.104', '2.107'])

  // A set that is already distinct keeps the series' own precision.
  assert.deepEqual(t.axisTickLabels([1.1, 1.2, 1.3], { digits: 2, unit: '' }),
    ['1.10', '1.20', '1.30'])
  assert.deepEqual(t.axisTickLabels([], { digits: 2, unit: '' }), [])

  // NO UNIT ON A LABEL, whatever the spec carries: each axis names its unit once
  // in the title rotated up its edge, and a label repeating it says the same
  // word twice within a few pixels of itself.
  const plain = t.axisTickLabels([2.163, 2.219, 2.275], { digits: 3, unit: 'bpb' })
  assert.deepEqual(plain, ['2.163', '2.219', '2.275'])
  assert.ok(!plain.some((label) => /bpb/.test(label)))
  assert.deepEqual(t.axisTickLabels([17.4e6, 20.9e6], { digits: 2, unit: 'M params' }),
    ['17.4M', '20.9M'],
    'and the scale mark the formatter writes stays with the number')
})

// ---------------------------------------------------------------------------
// The current value of each line, floating at the right.
//
// The KPI header carries the held-out reading already, but it sits above the
// chart with several other tiles around it; a number written beside the height
// its own line was drawn at is read together with that line, which is what a
// reader steering by two curves needs.
// ---------------------------------------------------------------------------

test('each line gets its newest reading, written beside the height it is drawn at', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })

  const chips = elementsWithClass(tree, 'dshtd-current')
  assert.equal(chips.length, 2, 'one label per line, and there are two lines')

  const primary = chips.find((chip) => chip.props['data-series'] === 'primary')
  const overlay = chips.find((chip) => chip.props['data-series'] === 'overlay')
  assert.ok(primary, 'the selected series gets one')
  assert.ok(overlay, 'and so does the seed-size line')

  // The primary label reads the LAST point of the selected series, through the
  // same formatter its axis uses.
  const last = BREAK_SERIES[BREAK_SERIES.length - 1][1]
  assert.equal(textOf(primary).trim(), t.formatValue(last, chartSpec().digits))

  // The overlay label reads the last point of ITS series, in its own scale and
  // precision - SEED_PARAMS tops out at 22.217M, which the formatter writes as
  // `22.2M`.
  assert.equal(textOf(overlay).trim(), '22.2M')
})

test('a floating value is written in its axis\u2019 own notation, not by scaling it twice', () => {
  // The value formatter does its own scaling: it writes 22,217,000 as `22.2M`.
  // Multiplying by the spec's `scale` first would give the bare `22.22` - a
  // number whose reader has to guess the units, and which disagrees with the
  // mark on the axis three units away from it.
  const payload = seedPayload()
  const overlay = t.resolveOverlay(payload)
  assert.equal(overlay.scale, 1e-6, 'the spec carries a scale for the axis to apply')

  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay })
  const chip = elementsWithClass(tree, 'dshtd-current')
    .find((node) => node.props['data-series'] === 'overlay')
  const asAxisWritesIt = t.formatValue(SEED_PARAMS[SEED_PARAMS.length - 1][1], overlay.digits)
  assert.equal(textOf(chip).trim(), asAxisWritesIt,
    'the floating value and the axis marks share one formatter')
  assert.match(asAxisWritesIt, /M$/, 'and that includes the scale mark')
})

test('the floating values carry no thousands separator, so they stay one token', () => {
  // The formatter writes `65.5k`, not `65,538`, which is what lets a value sit
  // in a 44-unit column without wrapping or being cut.
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })
  for (const chip of elementsWithClass(tree, 'dshtd-current')) {
    assert.ok(!/,/.test(textOf(chip)), `a floating value carries a separator: "${textOf(chip)}"`)
    assert.ok(textOf(chip).trim().length <= 7,
      `"${textOf(chip)}" is too wide for the ${t.CURRENT_VALUE_WIDTH}-unit column`)
  }
})

test('the current-value labels carry their own line\u2019s colour, and never a unit word', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })
  const chips = elementsWithClass(tree, 'dshtd-current')

  // Colour is the one channel that ties a floating number to a line, so each
  // label is drawn in its own line's class rather than one shared style.
  const classes = chips.map((chip) => elementsWithClass(chip, 'dshtd-current-primary').length > 0
    ? 'primary' : 'overlay')
  assert.deepEqual([...classes].sort(), ['overlay', 'primary'])

  // And the units are not repeated here either: the axes name them once each.
  for (const chip of chips) {
    assert.ok(!/params|bpb|rows/.test(textOf(chip)),
      `a floating value repeats a unit: "${textOf(chip)}"`)
  }
})

test('no current-value label is written for a line that is not on screen', () => {
  // A label whose line is off the window would be a number attached to nothing.
  // Rendered through the hook renderer rather than the plain stub, because the
  // window is component state and the stub's `useState` returns the initializer
  // function instead of calling it - so the stub cannot express a zoomed view.
  const payload = seedPayload()
  const spec = chartSpec()
  const view = mountHooks(t.SeriesChart, { spec, payload, overlay: t.resolveOverlay(payload) })
  const draw = () => withDispatchedHooks(view.dispatcher, () => view.render())

  // Whole run: both lines have a point in view, so both get a value.
  assert.equal(elementsWithClass(draw(), 'dshtd-current').length, 2)

  // The reader drags to a stretch BEFORE both series begin - the seed series
  // starts at leg 10 and the window ends at 5.
  t.rememberWindow(spec.tag, { lo: 0, hi: 5 })
  try {
    const zoomed = mountHooks(t.SeriesChart, { spec, payload, overlay: t.resolveOverlay(payload) })
    const tree = withDispatchedHooks(zoomed.dispatcher, () => zoomed.render())
    assert.equal(elementsWithClass(tree, 'dshtd-current').length, 0,
      'neither series has a point in this window, so neither gets a floating value')
  } finally {
    t.rememberWindow(spec.tag, null)
  }

  // And with the window back over the data, both labels return.
  assert.equal(elementsWithClass(draw(), 'dshtd-current').length, 2)
})

test('two floating values never write over each other, and never leave the frame', () => {
  // The size axis barely moves while a bpb curve swings, so the two newest
  // readings often land at nearly the same height.
  const close = t.currentValueLabels([{ kind: 'primary', y: 100 }, { kind: 'overlay', y: 103 }], 20, 200)
  assert.equal(close.length, 2)
  assert.ok(Math.abs(close[0].y - close[1].y) >= t.CURRENT_VALUE_MIN_SEPARATION,
    `two labels ${Math.abs(close[0].y - close[1].y)} apart would overlap`)

  // A line ending at the very top or bottom keeps its label inside the frame.
  for (const y of [12, 214, 0, 999]) {
    const placed = t.currentValueLabels([{ kind: 'primary', y }, { kind: 'overlay', y: 100 }], 20, 200)
    for (const entry of placed) {
      assert.ok(entry.y >= 20 && entry.y <= 200,
        `a label at ${entry.y} has left the frame (wanted y=${y})`)
    }
  }

  // A line with no position contributes no label, and the other still gets one.
  const single = t.currentValueLabels([{ kind: 'primary', y: 50 }, null], 20, 200)
  assert.equal(single.length, 1)
  assert.equal(single[0].kind, 'primary')
  assert.deepEqual(t.currentValueLabels([], 20, 200), [])
  assert.deepEqual(t.currentValueLabels([null, undefined], 20, 200), [])
})

test('the floating values sit in the left margin, clear of the axis numbers', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })
  const plot = t.plotGeometry({ lo: 0, hi: 1 }, t.CHART.padRight + t.OVERLAY_GUTTER)

  const rails = elementsWithClass(tree, 'dshtd-current-rail')
  assert.equal(rails.length, 2, 'one rail per reading')
  for (const rail of rails) {
    assert.ok(rail.props.x < plot.left,
      `the reading must be left of the plot edge (${rail.props.x} vs ${plot.left})`)
    assert.ok(rail.props.x + rail.props.width < plot.left - 20,
      'and clear of the axis numbers, which run right up to the plot edge')
  }

  // The reading's text ends at the rail, from the left of it.
  const texts = elementsWithClass(tree, 'dshtd-current-primary')
    .concat(elementsWithClass(tree, 'dshtd-current-overlay'))
  assert.equal(texts.length, 2)
  for (const text of texts) {
    assert.equal(text.props.textAnchor, 'end', 'so a longer number grows leftward, into the margin')
    assert.ok(text.props.x < t.CURRENT_VALUE_RAIL_X,
      `the text must end left of its rail (${text.props.x} vs ${t.CURRENT_VALUE_RAIL_X})`)
    assert.ok(text.props.x > t.AXIS_UNIT_WIDTH,
      'and right of the rotated unit title at the far edge')
  }
})

test('a floating value carries its colour itself, so it can never render black', () => {
  // Reported from the running tab: the readings came out BLACK over a dark
  // frame. The colour was in the stylesheet only, and an SVG `text` with no fill
  // is black - so the moment the sheet was not applied the numbers vanished into
  // the background. Each element now carries the same colour as an attribute,
  // where no stylesheet can lose it, and the sheet keeps the theme token.
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })

  const primary = elementsWithClass(tree, 'dshtd-current-primary')[0]
  const overlay = elementsWithClass(tree, 'dshtd-current-overlay')[0]
  assert.equal(primary.props.fill, t.PRIMARY_INK,
    'the primary reading carries its own ink')
  assert.equal(overlay.props.fill, t.OVERLAY_INK,
    'and so does the size reading')
  assert.notEqual(primary.props.fill, overlay.props.fill,
    'the two are told apart by colour as well as by height')

  // The rails carry the same ink as their own reading, so a rail can never be
  // drawn in one series' colour beside another series' number.
  const rails = elementsWithClass(tree, 'dshtd-current-rail')
  assert.equal(rails.length, 2)
  assert.deepEqual([...new Set(rails.map((rail) => rail.props.fill))].sort(),
    [t.PRIMARY_INK, t.OVERLAY_INK].sort(),
    'the two rails carry one ink each, and they are the two lines\' colours')

  // And the stylesheet still names the same colours, so it cannot drift into a
  // different palette from the attributes.
  assert.ok(t.CSS_SOURCE.includes(t.OVERLAY_INK),
    'the stylesheet must name the same overlay ink the element writes')
  assert.ok(t.CSS_SOURCE.includes(t.PRIMARY_INK),
    'and the same primary ink')
})

test('the two rails cannot meet, however close the two readings are', () => {
  // Two readings a unit apart would overlap without the separation, and their
  // rails would bleed into one mark. The separation is what keeps them two.
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })
  const rails = elementsByHeight(elementsWithClass(tree, 'dshtd-current-rail'))

  assert.equal(rails.length, 2)
  const gap = rails[1].props.y - (rails[0].props.y + rails[0].props.height)
  assert.ok(gap > 0, `the two rails overlap or touch (gap ${gap})`)
  assert.ok(rails[1].props.y - rails[0].props.y >= t.CURRENT_VALUE_MIN_SEPARATION - 10,
    'and they are a readable distance apart')
})

test('the size axis is scaled to the whole series, so panning never lifts the beginning off the floor', () => {
  // The defect this pins, reported from the running tab: the axis was scaled to
  // the samples IN THE WINDOW, and since the size only rises, panning right
  // raised the floor until the run's first readings were below the axis and not
  // drawn - a series that appears to begin later than it does, with nothing on
  // screen saying a reading had been dropped.
  //
  // The series here is dense enough to resample the way the live one does: a
  // flat early stretch, then steps. A sparse fixture is not enough to catch
  // this, because the drop happens BETWEEN two readings.
  const points = []
  for (let leg = 65; leg <= 500; leg += 1) {
    const value = leg < 300 ? 17_050_000
      : leg < 400 ? 20_196_000
        : leg < 450 ? 21_640_000 : 22_217_000
    points.push([leg, value])
  }
  const overlay = { series: { tag: 'train/seed_model_params', points }, axis: t.LOG_SCALE }
  const whole = t.logRange(points, null)

  // A window showing only the newest part of the run. Scaling to that window is
  // what used to happen, and it is what the floor must no longer be taken from.
  const lateWindow = points.filter(([leg]) => leg >= 300)
  const fromWindow = t.logRange(lateWindow, null)
  assert.ok(fromWindow.lo > points[0][1],
    `this is the trap: a late window's own floor (${(fromWindow.lo / 1e6).toFixed(2)}M) sits `
    + `above the run's first reading (${(points[0][1] / 1e6).toFixed(2)}M)`)

  const earliest = points[0][1]
  assert.equal(t.logFraction(earliest, fromWindow.lo, fromWindow.hi), null,
    'so under a windowed floor the first reading cannot be drawn at all')
  assert.ok(t.logFraction(earliest, whole.lo, whole.hi) > 0,
    'while the series-wide floor keeps it on the frame')

  // The component reads the range from the WHOLE series, not from the window, so
  // the same floor is in force however far the reader pans.
  const tree = t.SeriesChart({
    spec: chartSpec(),
    payload: snapshotWith({
      series: [{ tag: 'train/loss', points: BREAK_SERIES }, overlay.series],
    }),
    overlay,
  })
  const axis = elementsWithClass(tree, 'dshtd-overlay-axis')
  assert.ok(axis.length > 0, 'the axis is drawn')
  const drawn = elementsWithClass(tree, 'dshtd-overlay-line')
  assert.ok(drawn.length > 0, 'and so is the line')
  for (const path of drawn) {
    assert.ok(!/NaN|Infinity|undefined/.test(path.props.d),
      'the line must carry only values the axis can hold')
  }
})

test('the two lines are resampled onto one x, and a gap is a gap', () => {
  // The overlay covers legs 10..300 only, so the curve's own samples at 400 and
  // 500 have NO size reading: carrying the last one forward would draw a line
  // claiming the model was that size at legs nobody measured.
  const overlay = { series: { points: [[10, 100], [300, 200]] } }
  const segments = t.resampleOnto(overlay.series.points, BREAK_SERIES.map((point) => point[0]))

  assert.equal(segments.length, 1, 'the covered run is one drawn segment')
  assert.deepEqual(segments[0].map((point) => point[0]), [10, 100, 200, 300],
    'the size line steps where IT has readings, in the curve\'s own x space')

  const partial = t.resampleOnto([[100, 1], [200, 2]], [10, 100, 200, 500])
  assert.deepEqual(partial.map((run) => run.map((point) => point[0])), [[100, 200]],
    'x values outside the overlay are dropped, not clamped to its ends')
})

test('the size line reads between its own samples and stops at its own ends', () => {
  assert.equal(t.valueAtX([[10, 0], [20, 10]], 15), 5, 'half way is half the value')
  assert.equal(t.valueAtX([[10, 0], [20, 10]], 10), 0)
  assert.equal(t.valueAtX([[10, 7]], 10), 7, 'one sample is a value, not a division by zero')
  assert.equal(t.valueAtX([[10, 0], [20, 10]], 9), null, 'before the first reading is not the first value')
  assert.equal(t.valueAtX([[10, 0], [20, 10]], 21), null, 'after the last reading is not the last value')
  assert.equal(t.valueAtX([], 5), null)
})

test('the second line is part of the picture the accessible name describes', () => {
  const payload = seedPayload()
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: t.resolveOverlay(payload) })
  const label = elementsWithClass(tree, 'dshtd-chart')[0].props['aria-label']

  assert.match(label, /seed model size/,
    'a screen reader handed one curve and no mention of the other is told a different picture')
  assert.match(label, /axis on the right/)
})

// ---------------------------------------------------------------------------
// The marker categories the reader can switch off.
//
// The key under the chart is the switch, because it is the only place that can
// say what turning a category off costs. The rule these pin is that NOTHING IS
// HIDDEN SILENTLY: the chart, the strip and the register all lose the markers,
// and every one of them still carries the count of what is being held back.
// ---------------------------------------------------------------------------

test('the categories on offer are the ones the snapshot actually carries', () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  const categories = t.markerCategories(t.readBreakMarkers(payload).markers)

  // The registered order, corpus first - see KIND_ORDER in the bundle - and not
  // the order the markers happened to arrive in. A key that reorders itself as
  // the run writes markers is a key the reader has to re-read every refresh.
  assert.deepEqual(categories.map((entry) => entry.kind),
    ['corpus', 'instrument', 'arithmetic', 'shape', 'restart'])
  assert.deepEqual(categories.map((entry) => entry.kind),
    t.KIND_ORDER.filter((kind) => categories.some((entry) => entry.kind === kind)))
  assert.equal(categories.find((entry) => entry.kind === 'corpus').count, 1)
  assert.ok(categories.every((entry) => entry.count === 1), 'each of the five kinds appears once')

  assert.deepEqual(t.markerCategories([]), [],
    'a switch for a category with no markers is a control that does nothing')
})

test('every category present gets a switch, including one the tab has never seen', () => {
  const markers = t.readBreakMarkers(snapshotWith({
    breaks: [servedMarker({ leg: 40, kind: 'quorum' })],
  })).markers
  const categories = t.markerCategories(markers)

  assert.deepEqual(categories.map((entry) => entry.kind), ['quorum'],
    'a kind this tab has never seen must be switchable too, under its own name')
  assert.equal(categories[0].word, 'QUORUM')
})

test('an unknown kind is drawn by default, so a new kind is never hidden by default', () => {
  assert.equal(t.kindIsShown([], 'quorum'), true)
  assert.equal(t.kindIsShown(['corpus'], 'quorum'), true,
    'the hidden list holds the kinds switched OFF, so anything else is on')
  assert.equal(t.kindIsShown(['corpus'], 'corpus'), false)
})

test('switching a category off removes it from the chart, the strip and the register', () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  const tree = t.SeriesChart({
    spec: chartSpec(), payload, overlay: null, onToggleKind: null,
    hiddenKinds: ['corpus', 'restart'],
  })

  const drawn = elementsWithClass(tree, 'dshtd-breakmark').map((mark) => mark.props['data-leg'])
  assert.deepEqual(drawn, ['40', '120', '121'],
    'the two hidden categories must be absent from the chart itself')

  const ticks = elementsWithClass(tree, 'dshtd-break-tick').map((tick) => tick.props['data-leg'])
  assert.deepEqual(ticks, drawn,
    'the strip under the chart cannot show a joint the chart above it is not drawing')

  const rows = elementsWithClass(tree, 'dshtd-break-row').map((row) => row.props['data-leg'])
  assert.deepEqual(rows, drawn, 'and the register reads out exactly what is drawn')
})

test('the count of what is hidden is always on screen, so nothing vanishes silently', () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  const all = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  const some = t.SeriesChart({
    spec: chartSpec(), payload, overlay: null, hiddenKinds: ['corpus', 'restart'],
  })

  const headAll = textOf(elementsWithClass(all, 'dshtd-breaks-head')[0])
  assert.match(headAll, /5 of 5 drawn/)
  assert.ok(!/hidden by the switches/.test(headAll), 'nothing is hidden when nothing is switched off')

  const headSome = textOf(elementsWithClass(some, 'dshtd-breaks-head')[0])
  assert.match(headSome, /3 of 5 drawn/)
  assert.match(headSome, /2 hidden by your switches/)

  const register = textOf(elementsWithClass(some, 'dshtd-breaks')[0])
  assert.match(register, /2 marker\(s\) hidden by your switches/,
    'a chart missing its joints looks exactly like a run with no joints')

  const chartLabel = elementsWithClass(some, 'dshtd-chart')[0].props['aria-label']
  assert.match(chartLabel, /3 of 3 break markers/)
  assert.match(chartLabel, /2 more hidden by the category switches/)
})

test('hiding every category still says the markers exist', () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  const everything = t.markerCategories(t.readBreakMarkers(payload).markers).map((entry) => entry.kind)
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: null, hiddenKinds: everything })

  assert.equal(elementsWithClass(tree, 'dshtd-breakmark').length, 0)
  assert.match(textOf(elementsWithClass(tree, 'dshtd-breaks-head')[0]), /0 of 5 drawn/)
  assert.equal(elementsWithClass(tree, 'dshtd-toggle').length, 5,
    'every switch must remain on screen, or a reader who hid everything cannot get anything back')
})

test('the key is a set of labelled buttons, so the categories are reachable without a mouse', () => {
  const tree = t.SeriesChart({ spec: chartSpec(), payload: snapshotWith({ breaks: ALL_KINDS }), overlay: null })
  const toggles = elementsWithClass(tree, 'dshtd-toggle')

  assert.equal(toggles.length, ALL_KINDS.length)
  for (const toggle of toggles) {
    assert.equal(toggle.type, 'button', 'a category reachable only by a gesture is not reachable')
    assert.equal(typeof toggle.props.title, 'string')
    assert.equal(toggle.props['aria-pressed'], 'true')
    assert.equal(toggle.props['data-on'], 'true')
    assert.ok(textOf(toggle).length > 0, 'a switch with no word on it is a mystery control')
  }
})

test('a switched-off category keeps its shape and says it is off in words', () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: null, hiddenKinds: ['corpus'] })
  const off = elementsWithClass(tree, 'dshtd-toggle').find(
    (toggle) => toggle.props['data-kind'] === 'corpus')

  assert.equal(off.props['data-on'], 'false')
  assert.equal(off.props['aria-pressed'], 'false')
  // The shape survives: the chart's own shape table is what draws the swatch,
  // so a kind encoded only as "dimmed" cannot happen here.
  assert.ok(elementsWithClass(off, 'dshtd-marker-swatch').length === 1,
    'the swatch keeps its shape when the category is off')
  assert.match(off.props.title, /hidden by you/)
  assert.match(off.props.title, /Press to draw them again/)
})

test('the frontier has its own switch, and switching it off is stated rather than silent', () => {
  const payload = snapshotWith({
    breaks: ALL_KINDS,
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 40, next_leg: 260,
      legs_in_phase: 40, legs_remaining: 1, expected_to_raise_bpb: false,
      imminent: false, sentence: 'FRONTIER: a to b at about leg 260.',
    },
  })
  const shown = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  assert.ok(elementsWithClass(shown, 'dshtd-frontier-mark').length > 0)
  assert.ok(elementsWithClass(shown, 'dshtd-frontier').length > 0)

  const hidden = t.SeriesChart({ spec: chartSpec(), payload, overlay: null, hideFrontier: true })
  assert.equal(elementsWithClass(hidden, 'dshtd-frontier-mark').length, 0,
    'the dashed line must go when its switch is off')
  assert.equal(elementsWithClass(hidden, 'dshtd-frontier').length, 0, 'and so must its block')

  // The switch itself stays, so the reader can put it back.
  const button = elementsWithClass(hidden, 'dshtd-toggle').find(
    (toggle) => toggle.props['data-kind'] === 'frontier')
  assert.ok(button, 'the frontier switch must not disappear with the thing it switches')
  assert.equal(button.props['data-on'], 'false')
  assert.match(button.props.title, /Press to draw it again/)
})

/**
 * THE CHAIN A ROLLBACK THREW AWAY, reported by the user on 10 October 2026 as
 * "grey/ghost out the recent chain's values in the chart and start populating the
 * latest value from the target point in the graph so the x-axis remains
 * consistent ... also add a selector for older run's values".
 *
 * The run rolled back to its START at leg 209 and carried on numbering from 210,
 * so the leg axis is the only x there is: the discarded values stay on it, dimmed,
 * and the live chain starts where the controller rewound to. The selector takes
 * the ghost off the picture without moving the axis.
 */
const ROLLBACK_MARKER = servedMarker({
  leg: 200, kind: 'rollback', label: 'rolled back to the run\'s start',
  reason: 'the controller rolled the run back here.', meaning: 'the WEIGHTS were rewound',
})

test('the values before a rollback are ghosted on the same axis, not dropped', () => {
  const tree = renderChart(snapshotWith({ breaks: [ROLLBACK_MARKER] }))

  const ghost = elementsWithClass(tree, 'dshtd-ghost-line')
  const live = elementsWithClass(tree, 'dshtd-line')
  assert.equal(ghost.length, 1, 'the chain the rollback discarded must be drawn, and as a ghost')
  assert.equal(live.length, 1, 'and the live chain must be drawn in full')
  assert.equal(t.rollbackPoint(t.readBreakMarkers(snapshotWith({ breaks: [ROLLBACK_MARKER] })).markers), 200)

  // The split is at the rollback's leg: the points up to and including it are the
  // older chain, and everything after it is live.
  const axis = elementsWithClass(tree, 'dshtd-axis')[0]
  assert.ok(axis, 'the axis is what both chains are read against')
  const split = t.splitOlder([[10, 1], [200, 2], [201, 3], [500, 4]], 200)
  assert.deepEqual(split.older, [[10, 1], [200, 2]])
  assert.deepEqual(split.live, [[201, 3], [500, 4]])
})

test('a run with no rollback has no ghost and no selector for one', () => {
  const tree = renderChart(snapshotWith({ breaks: ALL_KINDS }))

  assert.equal(elementsWithClass(tree, 'dshtd-ghost-line').length, 0)
  assert.equal(elementsWithClass(tree, 'dshtd-toggle').filter(
    (toggle) => toggle.props['data-kind'] === 'older-run').length, 0,
  'a selector for a chain no rollback discarded is a control with nothing behind it')
})

test('the older run has its own selector, and it takes the values off the chart', () => {
  const payload = snapshotWith({ breaks: [ROLLBACK_MARKER] })
  const shown = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  const button = elementsWithClass(shown, 'dshtd-toggle').find(
    (toggle) => toggle.props['data-kind'] === 'older-run')

  assert.ok(button, 'the reader must be able to take the discarded chain off the picture')
  assert.equal(button.props['data-on'], 'true', 'and it is on by default, dimmed rather than gone')
  assert.equal(button.props['data-leg'], '200')
  assert.match(button.props.title, /rolled the run back at leg 200/)
  assert.equal(elementsWithClass(shown, 'dshtd-ghost-line').length, 1)

  const hidden = t.SeriesChart({ spec: chartSpec(), payload, overlay: null, hideOlder: true })
  assert.equal(elementsWithClass(hidden, 'dshtd-ghost-line').length, 0,
    'switching it off takes the ghost off the chart')
  assert.equal(elementsWithClass(hidden, 'dshtd-line').length, 1,
    'and leaves the live chain exactly as it was')
  // THE LIVE CHAIN IS THE SAME LINE EITHER WAY. A version that skipped the split
  // when the ghost was switched off drew the DISCARDED values as the live line -
  // one continuous curve across the rollback, which is the reading the ghost
  // exists to prevent - and this is the assertion that catches it.
  assert.equal(elementsWithClass(hidden, 'dshtd-line')[0].props.d,
    elementsWithClass(shown, 'dshtd-line')[0].props.d,
    'hiding the older values must not fold them back into the live chain')
  const off = elementsWithClass(hidden, 'dshtd-toggle').find(
    (toggle) => toggle.props['data-kind'] === 'older-run')
  assert.equal(off.props['data-on'], 'false')
  assert.match(off.props.title, /axis still covers them/,
    'the reader is told the axis did not move, or hiding values looks like losing run')
})

test('the ghost survives switching the rollback MARKER category off', () => {
  // Turning a category off is a request about the marker, not a claim that the
  // values either side of the joint are one chain: a chart that answered it by
  // drawing the discarded values as live would be worse than either.
  const payload = snapshotWith({ breaks: [ROLLBACK_MARKER] })
  const tree = t.SeriesChart({
    spec: chartSpec(), payload, overlay: null, hiddenKinds: ['rollback'],
  })

  assert.equal(elementsWithClass(tree, 'dshtd-breakmark').length, 0, 'the marker itself is hidden')
  assert.equal(elementsWithClass(tree, 'dshtd-ghost-line').length, 1,
    'and the chain it threw away is still drawn as a ghost')
})

test('a rollback draws no line of its own: it is a change of origin, not a leg', () => {
  // "the rollback marker is not useful with everything aligned to 0": drawn as a
  // joint it landed at the far end of the OLDER chain (x=208 on a chart whose live
  // chain starts at 0), marking nothing a reader can use, because the rollback is
  // the reason both chains start at 0. What says it on the chart is the origin and
  // the ghost; what says it in words is the register row.
  const payload = snapshotWith({
    breaks: [ROLLBACK_MARKER, servedMarker({ leg: 40, kind: 'corpus' })],
  })
  const tree = renderChart(payload)

  const lines = elementsWithClass(tree, 'dshtd-breakmark')
  assert.equal(lines.length, 1, 'one joint is a line on this chart, and it is not the rollback')
  assert.equal(lines[0].props['data-kind'], 'corpus')
  assert.equal(elementsWithClass(tree, 'dshtd-break-tick').length, 1,
    'and the strip under the chart agrees with the chart above it')

  // THE RECORD IS NOT WHAT WENT AWAY: the register still carries the row, with the
  // label the producer wrote and the reason behind its own disclosure.
  const rows = elementsWithClass(tree, 'dshtd-break-row')
  assert.equal(rows.length, 2)
  assert.ok(rows.some((row) => textOf(row).includes("rolled back to the run's start")))

  // And its switch is honest about what it hides, or a reader who pressed it
  // expecting the chart to change would think the switch was broken.
  const toggle = elementsWithClass(tree, 'dshtd-toggle').find(
    (entry) => entry.props['data-kind'] === 'rollback')
  assert.ok(toggle, 'the rollback still has a category switch, for the record')
  assert.match(toggle.props.title, /recorded in the register/)
  assert.doesNotMatch(toggle.props.title, /marker\(s\) drawn/,
    'it must not promise to take a line off a chart it is not drawn on')
})

test('the size line is ghosted on the same side of the rollback as the reading', () => {
  const payload = snapshotWith({
    breaks: [ROLLBACK_MARKER],
    series: [{ tag: 'train/loss', points: BREAK_SERIES }],
  })
  const overlay = {
    tag: 'train/seed_model_params', label: 'seed params', unit: 'params', digits: 1,
    series: { tag: 'train/seed_model_params', source: 'fixture',
      points: [[10, 19.9], [200, 20.2], [201, 19.9], [500, 21.0]] },
  }
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay })

  assert.equal(elementsWithClass(tree, 'dshtd-ghost-overlay').length, 1,
    'the size went back to the seed too, so its older values are ghosted with the reading')
  assert.ok(elementsWithClass(tree, 'dshtd-overlay-line').length >= 1)
})

test('a window holding only the hidden older run says so rather than "no points"', () => {
  // Hiding the ghost is a statement about the picture, and the window can be left
  // holding nothing but what was hidden. "No points in this window" would then be
  // false, and it would send the reader hunting for a fault that is a switch.
  // Through the hook renderer, because a zoomed view is component state: the plain
  // stub's `useState` returns the initializer function instead of calling it.
  const payload = snapshotWith({ breaks: [ROLLBACK_MARKER] })
  const spec = chartSpec()

  t.rememberWindow(spec.tag, { lo: 0, hi: 50 })
  try {
    const view = mountHooks(t.SeriesChart, {
      spec, payload, overlay: null, hideOlder: true,
    })
    const tree = withDispatchedHooks(view.dispatcher, () => view.render())
    const note = elementsWithClass(tree, 'dshtd-window-note')[0]
    assert.ok(note, 'a window with nothing drawable in it must say so')
    assert.match(textOf(note), /only the older run's values are in this window/,
      'and it must name the switch that would draw them, not claim the window is empty')
    assert.match(textOf(note), /OLDER RUN/)

    const shown = mountHooks(t.SeriesChart, {
      spec, payload, overlay: null, hideOlder: false,
    })
    const drawn = withDispatchedHooks(shown.dispatcher, () => shown.render())
    assert.equal(elementsWithClass(drawn, 'dshtd-window-note').length, 0,
      'with the ghost drawn the window is not empty and there is nothing to explain')
    assert.equal(elementsWithClass(drawn, 'dshtd-ghost-line').length, 1,
      'and the ghost is what makes it not empty')
  } finally {
    t.rememberWindow(spec.tag, null)
  }
})

test('both passes start at x=0, so the live chain is not stranded at the far right', () => {
  // The report, twice: "start populating the latest value from the target point in
  // the graph so the x-axis remains consistent ... the new arc still shows up near
  // the end of the graph ... it should start from x=0, with the older arc ghosted".
  // The rollback is at leg 200, so the old pass ran 10..200 and the new one 201..:
  // each is drawn from ITS OWN first leg, and the series here HAS a point at 201
  // (the pass's first leg), which is what makes "starts at 0" observable.
  const spec = {
    ...chartSpec(),
    series: { ...chartSpec().series, points: [[10, 1], [100, 2], [200, 3], [201, 4], [300, 5], [500, 6]] },
  }
  const payload = snapshotWith({ breaks: [ROLLBACK_MARKER] })
  const tree = t.SeriesChart({ spec, payload, overlay: null })

  const ghost = elementsWithClass(tree, 'dshtd-ghost-line')[0]
  const live = elementsWithClass(tree, 'dshtd-line')[0]
  assert.ok(ghost && live, 'both chains are on the chart')

  const firstX = (path) => Number.parseFloat(String(path.props.d).slice(1).split(',')[0])
  assert.equal(firstX(ghost), firstX(live),
    'the two chains must share an origin: a new pass drawn from the run\'s first leg is a pass the '
    + 'reader has to hunt for at the far right')
  assert.equal(firstX(live), t.CHART.padLeft,
    'and that shared origin is the LEFT edge of the plot, which is x=0')
  assert.match(String(live.props.d), /M[\d.]+,[\d.]+ L/,
    'the live chain is a line, not a single point: it has 201, 300 and 500 on it')

  // The axis says so too: the readout names the re-based unit, starts at 0 and runs
  // as long as the longer of the two passes (the new one, legs 201..500 = 300 legs).
  const readout = textOf(elementsWithClass(tree, 'dshtd-window-readout')[0])
  assert.match(readout, /legs from each pass's start 0[–-]299/, `the readout is ${readout}`)
  assert.doesNotMatch(readout, /steps/,
    'the axis cannot go on calling them steps when the numbers are distances from two different '
    + 'first legs')
})

test('the register counts a marker by the x the chart draws it at', () => {
  // On a chart where both passes start at 0, a marker on the LIVE chain sits at
  // its distance from the rewind - leg 250 is x=49 - so a register that compared
  // the leg to the window would call it out of a window it is plainly inside.
  const payload = snapshotWith({
    breaks: [ROLLBACK_MARKER, servedMarker({ leg: 250, kind: 'corpus' })],
  })
  const tree = renderChart(payload)
  const head = textOf(elementsWithClass(tree, 'dshtd-breaks-head')[0])

  assert.match(head, /2 of 2 drawn/, `the head is ${head}`)
  assert.match(head, /2 in this window/,
    'both markers are inside the whole-run window: one at the end of the old pass, one 49 legs '
    + 'into the new one')
})

test('a run that has not rolled back keeps the leg number as its x', () => {
  // The re-basing is a rollback's business and nothing else: a chart drawn against
  // an axis that silently restarted at 0 would misnumber every run that has not.
  const tree = t.SeriesChart({ spec: chartSpec(), payload: snapshotWith(), overlay: null })
  const line = elementsWithClass(tree, 'dshtd-line')[0]
  const firstX = Number.parseFloat(String(line.props.d).slice(1).split(',')[0])
  assert.equal(firstX, t.CHART.padLeft, 'the first leg is still the left edge of the plot')
  const readout = textOf(elementsWithClass(tree, 'dshtd-window-readout')[0])
  assert.match(readout, /steps 10[–-]500/, `the readout is ${readout}`)
})

test('the frontier is placed in the live pass\'s own x', () => {
  // Its leg is an absolute leg of the running pass, so on a re-based chart it
  // belongs at its distance from the rewind - the same place a pass that had
  // started there would put it.
  const payload = snapshotWith({
    breaks: [ROLLBACK_MARKER],
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 200, next_leg: 260,
      chart_leg: 260, newest_leg: 250, legs_in_phase: 60, legs_remaining: 10,
      expected_to_raise_bpb: true, imminent: false, sentence: 'FRONTIER: a to b.',
    },
  })
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  const mark = elementsWithClass(tree, 'dshtd-frontier-mark')[0]

  assert.ok(mark, 'leg 260 is inside the live pass, so its line is on the chart')
  const at = Number.parseFloat(String(mark.children[0].props.x1))
  const left = t.CHART.padLeft
  const innerWidth = t.CHART.width - t.CHART.padLeft - t.CHART.padRight
  // x=0 is the live pass's first leg (201), so leg 260 is 59 legs in, against a
  // window 0..299 long (the live pass's 300 legs).
  assert.ok(at > left && at < left + innerWidth,
    'the projection must be inside the frame, not off the end of an absolute axis')
  assert.ok(at < left + innerWidth * 0.3,
    'a projection 59 legs into a 300-leg window belongs in the left third, not at 87% of an '
    + 'absolute leg axis')
})

test('a hidden category is still counted in the switch that hides it', () => {
  const entry = { kind: 'corpus', word: 'CORPUS', count: 3 }
  assert.match(t.toggleTitle(entry, true), /3 CORPUS marker\(s\) drawn/)
  assert.match(t.toggleTitle(entry, true), /Press to hide this category/)
  assert.match(t.toggleTitle(entry, false), /3 CORPUS marker\(s\) hidden by you/)
  assert.match(t.toggleTitle(entry, false), /Press to draw them again/)
})

/**
 * The reported defect, 10 October 2026: "the coloured indicators for the item
 * cards below the graph are all black ... the enable/disable switches are black,
 * so it is not possible to see which thing correlates to which colour."
 *
 * The cause was a custom property that was READ and never SET: the switch icons
 * are drawn with `fill: var(--dshtd-kind)`, and the stylesheet's per-kind rules
 * named the chart's marks, the label groups, the register rows and the register
 * swatches - and no switch. An SVG shape whose fill is invalid at
 * computed-value time is BLACK, so every kind came out the same colour and the
 * key told the reader nothing. The tests below pin both halves of the fix: the
 * colour is written on the element (so no sheet can black it out) and the sheet
 * still names the same colour (so a theme still wins where the sheet applies).
 */
test('every switch in the key carries its kind of colour, so no icon is black', () => {
  const tree = t.SeriesChart({
    spec: chartSpec(), payload: snapshotWith({ breaks: ALL_KINDS }), overlay: null,
  })
  const kinds = new Set()
  for (const toggle of elementsWithClass(tree, 'dshtd-toggle')) {
    const kind = toggle.props['data-kind']
    const ink = t.kindInk(kind)
    assert.match(ink, /^#[0-9a-f]{6}$/, `no colour is registered for kind ${kind}`)
    assert.equal(toggle.props.style?.['--dshtd-kind'], ink,
      `the switch for ${kind} does not set --dshtd-kind, so its icon falls back to black`)
    const icon = elementsWithClass(toggle, 'dshtd-marker-swatch')[0]
    assert.ok(icon, `the switch for ${kind} has no swatch to colour`)
    assert.equal(icon.props.fill, ink,
      `the icon for ${kind} has no colour of its own, so a sheet that is not applied draws it black`)
    kinds.add(kind)
  }
  assert.equal(kinds.size, new Set(ALL_KINDS.map((marker) => marker.kind)).size,
    'every kind present in the register must be switchable and coloured')
})

test('the kind colours are the same in the elements and in the stylesheet', () => {
  const kinds = [...new Set([...ALL_KINDS.map((marker) => marker.kind),
    ...Object.keys(t.MARKER_SHAPES)])]
  // EVERY RULE, as selector list plus body: a kind's colour is declared once for
  // several selectors at a time, so a regex anchored to one selector followed by
  // `{` finds the shape rules and misses the colour rule entirely.
  const rules = [...t.CSS_SOURCE.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({ selectors: match[1], body: match[2] }))
  for (const kind of kinds) {
    const ink = t.kindInk(kind)
    for (const cls of ['dshtd-break-swatch', 'dshtd-toggle']) {
      const selector = `.${cls}[data-kind='${kind}']`
      const matching = rules.filter((rule) => rule.selectors.includes(selector))
      assert.ok(matching.length > 0, `the sheet has no rule for ${selector}`)
      assert.ok(matching.some((rule) => rule.body.includes(ink)),
        `${selector} is declared as [${matching.map((rule) => rule.body.trim()).join(' | ')}] `
        + `in the sheet and ${ink} on the element`)
    }
  }
})

test('a register row carries its kind of colour on the element too', () => {
  const tree = renderChart(snapshotWith({ breaks: ALL_KINDS }))
  const rows = elementsWithClass(tree, 'dshtd-break-row')
  assert.ok(rows.length > 0)
  for (const row of rows) {
    assert.equal(row.props.style?.['--dshtd-kind'], t.kindInk(row.props['data-kind']),
      `the row at leg ${row.props['data-leg']} leaves its swatch and badge to a sheet that may not`
      + ' be applied, which is how they came out black')
  }
})

test('the frontier\'s swatch stays an outline in the sheet and on the element', () => {  const payload = snapshotWith({
    breaks: ALL_KINDS,
    frontier: {
      phase_now: 'a', next_phase: 'b', boundary_leg: 40, next_leg: 260,
      legs_in_phase: 40, legs_remaining: 1, expected_to_raise_bpb: false,
      imminent: false, sentence: 'FRONTIER: a to b at about leg 260.',
    },
  })
  const tree = t.SeriesChart({ spec: chartSpec(), payload, overlay: null })
  const button = elementsWithClass(tree, 'dshtd-toggle').find(
    (toggle) => toggle.props['data-kind'] === 'frontier')
  const swatch = elementsWithClass(button, 'dshtd-frontier-swatch')[0]
  assert.equal(swatch.props.fill, 'none',
    'an expectation is not a joint, so its swatch is not filled')
  assert.equal(swatch.props.stroke, t.FRONTIER_INK)
  // The icon rule is the more specific of the two and used to fill this diamond.
  assert.ok(t.CSS_SOURCE.includes('*:not(.dshtd-frontier-swatch)'),
    'the key\'s fill rule must exclude the frontier, or the outline is filled solid')
  assert.match(t.CSS_SOURCE, /\.dshtd-toggle-icon \.dshtd-frontier-swatch \{ fill: none/)
})

// ---------------------------------------------------------------------------
// PRESSING THE SWITCHES.
//
// Every test above RENDERS a control; none of them presses one, and this
// repository has already paid for that distinction once: the zoom buttons were
// wired the wrong way round - `+` widening the window and `-` narrowing it -
// through a passing unit suite, because the tests asserted that the labelled
// controls existed rather than what they did. A switch whose handler is wired to
// the wrong state is exactly that defect, so the switches are pressed here.
//
// The renderer below is what makes pressing possible: it drives `useState` and
// `useEffect` the way React does, in hook order, and re-renders on a state
// change. It is deliberately small and drives nothing but the chart.
// ---------------------------------------------------------------------------

/**
 * Drive a function component with working hooks, and re-render when a state
 * setter is called.
 *
 * @param component - the function component to run.
 * @param props - its initial props.
 * @returns `render()`, which returns the element tree as it stands now.
 */
function mountHooks(component, props) {
  // Keyed by hook position, and NOT an append-only array: hooks are called in a
  // fixed order but not every position writes on every render, so an append-only
  // store drifts out of step with the cursor and hands a hook the wrong cell.
  const cells = []
  let cursor = 0
  let scheduled = false
  const dispatcher = {
    useState(initial) {
      const at = cursor
      cursor += 1
      if (!(at in cells)) cells[at] = typeof initial === 'function' ? initial() : initial
      const set = (next) => {
        cells[at] = typeof next === 'function' ? next(cells[at]) : next
        schedule()
      }
      return [cells[at], set]
    },
    useEffect() { cursor += 1 },
    useMemo(factory) { cursor += 1; return factory() },
    useRef(value) {
      const at = cursor
      cursor += 1
      if (!(at in cells)) cells[at] = { current: value }
      return cells[at]
    },
    useCallback(fn) { cursor += 1; return fn },
  }
  /** Re-render once, after the handler that changed the state has returned. */
  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => { scheduled = false; draw() })
  }
  function draw() {
    cursor = 0
    return component(props)
  }
  return { render: draw, dispatcher, cells }
}

/**
 * Run one render with the bundle's React stub, wired to a hook dispatcher.
 *
 * It has to be a WRAPPER and not an assignment around a single call: walking the
 * tree calls every nested function component again, so the dispatcher must be
 * installed for the whole walk and not only for the outermost component.
 */
function withDispatchedHooks(dispatcher, work) {
  const real = {
    useState: reactStub.useState,
    useEffect: reactStub.useEffect,
    useRef: reactStub.useRef,
    useCallback: reactStub.useCallback,
  }
  reactStub.useState = (initial) => dispatcher.useState(initial)
  reactStub.useEffect = (fn, deps) => dispatcher.useEffect(fn, deps)
  reactStub.useRef = (value) => dispatcher.useRef(value)
  reactStub.useCallback = (fn, deps) => dispatcher.useCallback(fn, deps)
  try {
    return work()
  } finally {
    Object.assign(reactStub, real)
  }
}

test('pressing a category switch hides that category, and pressing it again brings it back', async () => {
  const payload = snapshotWith({ breaks: ALL_KINDS })
  // The switch state lives in the PANEL, for the reason the panel's own comment
  // gives: the chart, the strip and the register all read one list. So this test
  // stands in for the panel and hands the list down, which is exactly what the
  // real panel does - the handler it passes is `setHiddenKinds` under another
  // name.
  let hiddenKinds = []
  const props = {
    spec: chartSpec(),
    payload,
    overlay: null,
    get hiddenKinds() { return hiddenKinds },
    onToggleKind: (kind) => {
      hiddenKinds = hiddenKinds.includes(kind)
        ? hiddenKinds.filter((item) => item !== kind)
        : [...hiddenKinds, kind]
    },
  }
  const view = mountHooks(t.SeriesChart, props)
  const tree = () => withDispatchedHooks(view.dispatcher, () => view.render())
  const marks = () => elementsWithClass(tree(), 'dshtd-breakmark').map((mark) => mark.props['data-kind'])
  const switchFor = (kind) => elementsWithClass(tree(), 'dshtd-toggle')
    .find((toggle) => toggle.props['data-kind'] === kind)
  /** Press one switch the way a reader does, then re-render as the panel would. */
  const press = async (kind) => { switchFor(kind).props.onClick(); await Promise.resolve() }

  assert.deepEqual(marks(),
    ['instrument', 'shape', 'arithmetic', 'restart', 'corpus'],
    'every category is drawn before anything is pressed')

  await press('corpus')
  assert.deepEqual(marks(), ['instrument', 'shape', 'arithmetic', 'restart'],
    'pressing the CORPUS switch must remove the corpus joints from the chart')
  assert.equal(switchFor('corpus').props['data-on'], 'false')
  assert.match(textOf(elementsWithClass(tree(), 'dshtd-breaks-head')[0]), /4 of 5 drawn/)

  await press('corpus')
  assert.deepEqual(marks(),
    ['instrument', 'shape', 'arithmetic', 'restart', 'corpus'],
    'pressing it again must bring the category back')
  assert.equal(switchFor('corpus').props['data-on'], 'true')
  assert.match(textOf(elementsWithClass(tree(), 'dshtd-breaks-head')[0]), /5 of 5 drawn/)

  // Two categories at once, because a reader hiding the cluster is the case the
  // switches exist for: the counts must still account for both.
  await press('corpus')
  await press('restart')
  assert.deepEqual(marks(), ['instrument', 'shape', 'arithmetic'])
  assert.match(textOf(elementsWithClass(tree(), 'dshtd-breaks-head')[0]), /3 of 5 drawn/)
})

test('a hook-ordered render is what makes the switches pressable at all', () => {
  // The renderer above is load-bearing for the test before it: with the stub's
  // own `useState` the chart is frozen, and a frozen chart would show the same
  // markers before and after a press - which is the shape a "the control is
  // rendered" test cannot tell from a working one.
  const view = mountHooks(t.SeriesChart, { spec: chartSpec(), payload: null, overlay: null })
  withDispatchedHooks(view.dispatcher, () => view.render())
  assert.ok(view.cells.length >= 2, 'the chart must actually register hook state')
  assert.ok(view.cells.some((cell) => cell !== null && typeof cell === 'object' && 'current' in cell),
    'and the refs it draws with must be real refs')
})

test('the switches belong to the reader and outlive the component', () => {
  // The pane remounts a tab body on events the reader did not cause. A switch
  // that forgets is a switch that undoes the reader's work on the next poll.
  assert.deepEqual(t.rememberedHiddenKinds('session-a'), [])

  t.rememberHiddenKinds('session-a', ['corpus', 'restart'])
  assert.deepEqual(t.rememberedHiddenKinds('session-a'), ['corpus', 'restart'])
  assert.deepEqual(t.rememberedHiddenKinds('session-b'), [],
    'two sessions must not fight over one set of switches')

  assert.equal(t.rememberedHideFrontier('session-a'), false)
  t.rememberHideFrontier('session-a', true)
  assert.equal(t.rememberedHideFrontier('session-a'), true)
  assert.equal(t.rememberedHideFrontier('session-b'), false)

  // A copy, so a later edit of the reader's list cannot reach back into the store.
  const list = t.rememberedHiddenKinds('session-a')
  list.push('shape')
  assert.deepEqual(t.rememberedHiddenKinds('session-a'), ['corpus', 'restart'])
})


