/**
 * Browser half of `dsh-train-dashboard`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * A live training dashboard that lives in the RIGHT PANE, as a real tab type
 * beside Files / Terminal / Document — the same registration the shipped tabs
 * use (`sidebarRightTabs`), so it gets a strip chip, a title, and the pane's
 * own chrome. Two ways to open it:
 *
 *   - a chart glyph pinned to the TOP-RIGHT of the frame (a `shell.overlay`
 *     entry, above every column), which opens the tab in one click;
 *   - the pane's "+" guide menu lists "Training dashboard".
 *
 * WHAT IT SHOWS. A KPI header (latest step, the headline series, step wall
 * time, throughput, memory peak, evaluation accuracy, whether the run is still
 * writing), then ONE series at a time on its own axis, chosen from the tags
 * the host serves, with an optional break point marked. One series at a time
 * is deliberate: series carry different units — bits per byte, seconds, GiB,
 * accuracy, counts — and drawing them on one axis would invite exactly the
 * comparison the axis cannot support.
 *
 * IT NEVER RENDERS A LIE ABOUT FRESHNESS. The snapshot is written while this
 * reads it, so a missing, stale or mid-write snapshot is NORMAL rather than
 * exceptional. Every one of those states shows the last numbers it has, with
 * their true age attached and what is being done about it — never an empty
 * chart and never a bare error. A tab that looks broken when it is merely
 * waiting sends someone hunting for a fault that does not exist.
 *
 * Wire-format rules, each one learned the hard way in this project:
 *
 * - The factory creates its OWN `var module = { exports: {} }` (no CommonJS
 *   wrapper exists; a bare `module` reference kills the client boot).
 * - The bundle exports `inject` + `apply`; the loader drives `apply(ctx)`.
 * - Services must be DECLARED in `inject` before use: `sidebarRight` and
 *   `sidebarRightTabs` are the right pane's cross-plugin faces, `layout` opens
 *   the pane. A slot name is never a service.
 * - The tab BODY registers under the tab definition's `id` (`TYPE_ID`), not
 *   under `kind`: the pane dispatches with `entryKey: definition.id ?? kind`,
 *   so registering the body under `kind` opens a tab whose body is the pane's
 *   own "Nothing here can view this kind of content yet."
 * - A slot registration without `name` throws while `apply` runs, which the
 *   desktop application treats as a failed startup.
 * - React comes from `require('react')` — the shared module table. No Harness
 *   client package is imported, and there is no build step.
 * - Styling uses the theme tokens (`--dsw-alias-*`) with literal fallbacks, so
 *   a renamed token degrades the look rather than breaking the render.
 *
 * @module dsh-train-dashboard/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-train-dashboard',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    /** Host routes; must match index.mjs. */
    const ROUTE = '/dsh-train-dashboard'
    /** The right-pane tab kind this bundle owns: what `openTab` names. */
    const KIND = 'train-dashboard'
    /** The tab DEFINITION's id, which is also the key its body registers under. */
    const TYPE_ID = 'dsh-train-dashboard.panel'

    /** How often the small state route is polled, in milliseconds. */
    const POLL_MS = 5000

    const CLASS = {
      trigger: 'dshtd-trigger',
      triggerButton: 'dshtd-trigger-button',
      panel: 'dshtd-panel',
      head: 'dshtd-head',
      title: 'dshtd-title',
      subtitle: 'dshtd-subtitle',
      age: 'dshtd-age',
      ageBadge: 'dshtd-age-badge',
      refresh: 'dshtd-refresh',
      kpis: 'dshtd-kpis',
      kpi: 'dshtd-kpi',
      kpiLabel: 'dshtd-kpi-label',
      kpiValue: 'dshtd-kpi-value',
      chips: 'dshtd-chips',
      chip: 'dshtd-chip',
      chart: 'dshtd-chart',
      chartWrap: 'dshtd-chart-wrap',
      axis: 'dshtd-axis',
      gridline: 'dshtd-gridline',
      breakline: 'dshtd-breakline',
      breaklabel: 'dshtd-breaklabel',
      line: 'dshtd-line',
      dot: 'dshtd-dot',
      windowRow: 'dshtd-window-row',
      windowButton: 'dshtd-window-button',
      windowReadout: 'dshtd-window-readout',
      windowNote: 'dshtd-window-note',
      brush: 'dshtd-brush',
      brushEdge: 'dshtd-brush-edge',
      overview: 'dshtd-overview',
      overviewLine: 'dshtd-overview-line',
      overviewWindow: 'dshtd-overview-window',
      empty: 'dshtd-empty',
      notice: 'dshtd-notice',
      noticeTitle: 'dshtd-notice-title',
      noticeBody: 'dshtd-notice-body',
      code: 'dshtd-code',
      legend: 'dshtd-legend',
      legendItem: 'dshtd-legend-item',
      footnote: 'dshtd-footnote',
    }

    const CSS = `
/* The trigger lives in the frame's own overlay seat, in the window's control
   row. It is NOT position:fixed at the top right: that row's right end belongs
   to the window controls (minimise/maximise/close), so a fixed trigger is drawn
   underneath them and cannot be clicked. Sit in the seat instead, as a normal
   icon button of the row. */
.${CLASS.trigger} { display: inline-flex; align-items: center; }
.${CLASS.triggerButton} {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a);
  background: var(--dsw-alias-bg-layer-1, #1d1d1d);
  color: var(--dsw-alias-label-secondary, #b0b0b0);
}
.${CLASS.triggerButton}:hover {
  background: var(--dsw-alias-bg-layer-2, #262626);
  color: var(--dsw-alias-label-primary, #f0f0f0);
}
.${CLASS.panel} {
  display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: auto;
  padding: 12px 14px 18px; gap: 12px;
  color: var(--dsw-alias-label-primary, #f0f0f0);
  background: var(--dsw-alias-bg-base, transparent);
  font-size: 12px; line-height: 1.5;
}
.${CLASS.head} { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.${CLASS.title} { font-size: 13px; font-weight: 600; }
.${CLASS.subtitle} { color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 11px; }
.${CLASS.age} { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
.${CLASS.ageBadge} {
  padding: 1px 7px; border-radius: 999px; font-size: 11px; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a);
  color: var(--dsw-alias-label-secondary, #b0b0b0);
}
.${CLASS.ageBadge}[data-tone='fresh'] {
  color: var(--dsw-alias-state-success-primary, #46a758);
  border-color: var(--dsw-alias-state-success-secondary, #2b6b36);
}
.${CLASS.ageBadge}[data-tone='stale'] {
  color: var(--dsw-alias-state-warn-primary, #e5a34d);
  border-color: var(--dsw-alias-state-warn-secondary, #7a5520);
}
.${CLASS.ageBadge}[data-tone='none'] {
  color: var(--dsw-alias-state-error-primary, #e5484d);
  border-color: var(--dsw-alias-state-error-secondary, #7a2427);
}
.${CLASS.refresh} {
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); color: inherit; cursor: pointer;
  font-size: 11px; padding: 2px 8px;
}
.${CLASS.refresh}[disabled] { opacity: 0.5; cursor: default; }
.${CLASS.kpis} { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.${CLASS.kpi} {
  border: 1px solid var(--dsw-alias-border-l1, #2e2e2e); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 6px 8px; min-width: 0;
}
.${CLASS.kpiLabel} {
  color: var(--dsw-alias-label-caption, #8a8a8a); font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.${CLASS.kpiValue} { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.${CLASS.chips} { display: flex; flex-wrap: wrap; gap: 6px; }
.${CLASS.chip} {
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a); border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-secondary, #b0b0b0);
  cursor: pointer; font-size: 11px; padding: 2px 10px; white-space: nowrap;
}
.${CLASS.chip}[data-on='true'] {
  background: var(--dsw-alias-bg-layer-2, #262626);
  color: var(--dsw-alias-label-primary, #f0f0f0);
  border-color: var(--dsw-alias-brand-primary, #4d6bfe);
}
.${CLASS.chartWrap} {
  border: 1px solid var(--dsw-alias-border-l1, #2e2e2e); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 6px;
}
.${CLASS.chart} { display: block; width: 100%; height: auto; }
.${CLASS.axis} { fill: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 9px; }
.${CLASS.gridline} { stroke: var(--dsw-alias-border-l1, #2e2e2e); stroke-width: 1; }
.${CLASS.breakline} { stroke: var(--dsw-alias-state-warn-primary, #e5a34d); stroke-width: 1; stroke-dasharray: 3 3; }
.${CLASS.breaklabel} { fill: var(--dsw-alias-state-warn-primary, #e5a34d); font-size: 9px; }
.${CLASS.line} { fill: none; stroke: var(--dsw-alias-brand-primary, #4d6bfe); stroke-width: 1.6; stroke-linejoin: round; }
.${CLASS.dot} { fill: var(--dsw-alias-brand-primary, #4d6bfe); }
.${CLASS.legend} { display: flex; flex-wrap: wrap; gap: 10px; color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10px; }
.${CLASS.legendItem} { display: inline-flex; align-items: center; gap: 4px; }
.${CLASS.notice} {
  border: 1px solid var(--dsw-alias-state-warn-secondary, #7a5520); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 10px 12px;
}
.${CLASS.noticeTitle} { font-weight: 600; margin-bottom: 4px; }
.${CLASS.noticeBody} { color: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.code} {
  display: block; margin-top: 6px; padding: 6px 8px; border-radius: 6px; overflow-x: auto;
  background: var(--dsw-alias-bg-layer-3, #111); font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 10.5px; color: var(--dsw-alias-label-secondary, #b0b0b0); white-space: pre;
}
.${CLASS.empty} { color: var(--dsw-alias-label-tertiary, #8a8a8a); padding: 18px 4px; text-align: center; }
.${CLASS.footnote} { color: var(--dsw-alias-label-caption, #8a8a8a); font-size: 10px; }
/* The window toolbar. Buttons are real buttons with labels, not hover-only
   glyphs, so the range is reachable by keyboard and by touch. */
.${CLASS.windowRow} {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin: 2px 0 4px;
}
.${CLASS.windowButton} {
  min-width: 26px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a);
  background: var(--dsw-alias-bg-layer-1, #1d1d1d);
  color: var(--dsw-alias-label-secondary, #b0b0b0);
  font-size: 11px; line-height: 16px;
}
.${CLASS.windowButton}:hover:not([disabled]) {
  background: var(--dsw-alias-bg-layer-2, #262626);
  color: var(--dsw-alias-label-primary, #f0f0f0);
}
.${CLASS.windowButton}[disabled] { opacity: 0.4; cursor: default; }
.${CLASS.windowReadout} {
  color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
/* The chart takes pointer drags for the window, so the browser must not claim
   them for scrolling or text selection. */
.${CLASS.chart} { touch-action: none; user-select: none; cursor: crosshair; }
.${CLASS.chart}:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary, #4d6bfe); }
.${CLASS.brush} { fill: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 0.16; }
.${CLASS.brushEdge} { stroke: var(--dsw-alias-brand-primary, #4d6bfe); stroke-width: 1; }
.${CLASS.overview} { touch-action: none; user-select: none; cursor: crosshair; }
.${CLASS.overviewLine} { fill: none; stroke: var(--dsw-alias-label-tertiary, #8a8a8a); stroke-width: 1; }
.${CLASS.overviewWindow} {
  fill: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 0.22;
  stroke: var(--dsw-alias-brand-primary, #4d6bfe); stroke-width: 1;
}
.${CLASS.windowNote} {
  fill: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 11px;
}
.${CLASS.overview} { margin-top: 2px; }
`

    /**
     * Install this bundle's stylesheet once, and hand back its remover.
     *
     * Two attributes are not decoration — the harness client loader owns plugin
     * styles by them. `data-plugin` is the ownership key: the loader claims every
     * style tag WITHOUT it for whichever plugin materialises next, and
     * `removeOwnedStyles(id)` deletes every tag whose `data-plugin` equals an id
     * when that entry is replaced or pruned. A tag marked only with a private
     * `data-…` attribute therefore looks untagged: another plugin claims it, and
     * the first refresh or prune of that plugin deletes THIS plugin's sheet. The
     * sheet is injected while `apply` runs, which is after the loader's claim
     * pass, so the plugin's own claim never sees it either. The symptoms are
     * exactly the ones a missing sheet produces — an SVG <path> with no
     * `fill: none` fills black, and a button with no CSS becomes the browser's
     * default grey one. `data-plugin-css` is the loader's per-sheet identity,
     * used for its HMR bookkeeping and the duplicate guard below.
     */
    const STYLE_OWNER = 'dsh-train-dashboard'
    const STYLE_KEY = `${STYLE_OWNER}/styles`

    function insertStyles() {
      const existing = document.querySelector(`style[data-plugin-css="${STYLE_KEY}"]`)
      if (existing !== null) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = STYLE_OWNER
      tag.dataset.pluginCss = STYLE_KEY
      tag.dataset.dshTrainDashboard = 'true'
      tag.textContent = CSS
      document.head.append(tag)
      return () => { tag.remove() }
    }

    // ----------------------------------------------------------------------
    // Pure helpers. No React, no DOM, no fetch: these are what the tests pin.
    // ----------------------------------------------------------------------

    /**
     * The series offered as chips, best first, with their units.
     *
     * The order is a reading order and not the host's: the headline curve
     * first, then the things that explain a move in it (wall time, gradient
     * norm, memory), then the evaluation readings.
     *
     * This list is a convenience and not a contract. A tag it does not know is
     * still offered, labelled by its own tag, so a producer is free to emit
     * whatever series names its run uses.
     */
    const INTERESTING = [
      { tag: 'train/bpb_sealed', label: 'sealed bpb', unit: 'bpb', digits: 4 },
      { tag: 'train/bpb_legval', label: 'leg-val bpb', unit: 'bpb', digits: 4 },
      { tag: 'train/wall_seconds', label: 'leg wall time', unit: 's', digits: 1 },
      { tag: 'train/units_per_second', label: 'units/s', unit: 'u/s', digits: 0 },
      { tag: 'train/gnorm', label: 'grad norm', unit: '', digits: 3 },
      { tag: 'train/vocabulary_size', label: 'vocab size', unit: '', digits: 0 },
      { tag: 'memory/vram_peak_gib', label: 'VRAM peak', unit: 'GiB', digits: 2 },
      { tag: 'memory/vram_headroom_gib', label: 'VRAM headroom', unit: 'GiB', digits: 2 },
      { tag: 'eval/exam_accuracy', label: 'exam accuracy', unit: '', digits: 4 },
    ]

    /**
     * Whether a tag looks like a per-step trace rather than a per-run series.
     *
     * A trace tag names one step (`vram_trace/step_0001_gib`), so offering one
     * chip per trace would bury the series a reader came for. The rule is by
     * shape, not by a list of known prefixes, so a producer's own trace naming
     * is filtered too.
     */
    function isTraceTag(tag) {
      return tag.startsWith('vram_trace/') || tag.includes('/trace/') || tag.endsWith('_trace')
    }

    /** Index a payload's series by tag. */
    function seriesIndex(payload) {
      const index = new Map()
      const list = payload !== null && typeof payload === 'object' && Array.isArray(payload.series)
        ? payload.series : []
      for (const item of list) {
        if (item !== null && typeof item === 'object' && typeof item.tag === 'string') {
          const points = Array.isArray(item.points) ? item.points : []
          const usable = points.filter((point) => Array.isArray(point)
            && Number.isFinite(point[0]) && Number.isFinite(point[1]))
          if (usable.length > 0) index.set(item.tag, { ...item, points: usable })
        }
      }
      return index
    }

    /**
     * The chips to offer: every preferred series the payload actually has,
     * then any other series so a new tag is reachable without a plugin
     * change. Per-step trace tags are left out of the fallback list because
     * each one is a single step and would flood the chips.
     */
    function availableSeries(payload) {
      const index = seriesIndex(payload)
      const offered = []
      for (const spec of INTERESTING) {
        if (index.has(spec.tag)) offered.push({ ...spec, series: index.get(spec.tag) })
      }
      const known = new Set(offered.map((item) => item.tag))
      for (const [tag, item] of index) {
        if (known.has(tag)) continue
        if (isTraceTag(tag)) continue
        if (tag.endsWith('_pre_break') || tag.endsWith('_post_break')) continue
        offered.push({ tag, label: tag, unit: '', digits: 3, series: item })
      }
      return offered
    }

    /** The last point of a tag, or null. */
    function lastPoint(payload, tag) {
      const item = seriesIndex(payload).get(tag)
      if (item === undefined || item.points.length === 0) return null
      return item.points[item.points.length - 1]
    }

    /** Round tick values covering [min, max] on human numbers. */
    function niceTicks(min, max, count) {
      if (!Number.isFinite(min) || !Number.isFinite(max)) return []
      if (min === max) return [min]
      const span = max - min
      const rough = span / Math.max(1, count)
      const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
      const candidates = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude)
      let step = candidates[candidates.length - 1]
      for (const candidate of candidates) {
        if (candidate >= rough) { step = candidate; break }
      }
      const ticks = []
      const first = Math.ceil(min / step) * step
      for (let value = first; value <= max + step * 1e-6; value += step) {
        ticks.push(Number(value.toFixed(10)))
      }
      return ticks
    }

    /** Format one value for a KPI tile or an axis label. */
    function formatValue(value, digits) {
      if (!Number.isFinite(value)) return '—'
      const places = Number.isFinite(digits) ? digits : 3
      if (value !== 0 && Math.abs(value) >= 1e6) {
        return `${(value / 1e6).toFixed(1)}M`
      }
      return value.toFixed(places)
    }

    /** A `d` attribute for a polyline through points, in chart coordinates. */
    function polylinePath(points, projectX, projectY) {
      if (!Array.isArray(points) || points.length === 0) return ''
      return points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${projectX(point[0]).toFixed(2)},${projectY(point[1]).toFixed(2)}`)
        .join(' ')
    }

    /**
     * Human age text for a snapshot, or a phrase when there is none.
     *
     * Three states, and they are not the same: no snapshot at all, a snapshot
     * whose age cannot be told (a producer that omitted `generated_at`), and a
     * snapshot with a readable age. The middle one used to read "no snapshot
     * yet" over a populated chart, which is a lie about the numbers on screen.
     */
    function describeAge(state) {
      if (state === null || state === undefined) return { text: 'no snapshot', tone: 'none' }
      if (state.haveSnapshot !== true) return { text: 'no snapshot yet', tone: 'none' }
      if (!Number.isFinite(state.ageSeconds)) return { text: 'age unknown', tone: 'stale' }
      const age = state.ageSeconds
      const text = age < 90
        ? `${Math.round(age)}s old`
        : `${Math.round(age / 60)} min old`
      if (state.stale === true) return { text: `${text} · stale`, tone: 'stale' }
      return { text: `${text} · fresh`, tone: 'fresh' }
    }

    /** One sentence saying how old the numbers are, for the stale banner. */
    function ageSentence(state) {
      if (state === null || state === undefined || !Number.isFinite(state.ageSeconds)) {
        return 'The snapshot carries no readable timestamp, so how old it is cannot be told.'
      }
      return `The snapshot is ${describeAge(state).text}.`
    }

    /**
     * The message to show when there is nothing to chart, and it says what to
     * DO about it rather than only that something is wrong.
     *
     * The cases are genuinely different and the host labels them: a MISSING
     * snapshot is fixed by building one, an UNCONFIGURED host has no command
     * to build one with (so nothing will happen until one is set), and an
     * UNUSABLE snapshot (a version mismatch, a body that is not JSON) will not
     * be fixed by pressing Refresh, so telling someone to press it would send
     * them round a loop. The host's own words win in the last case.
     */
    function emptyReason(state) {
      if (state === null || state === undefined) {
        return { title: 'Waiting for the host half', body: 'The tab has not reached the host yet.' }
      }
      if (state.haveSnapshot !== true && state.reason === 'unusable'
          && typeof state.error === 'string' && state.error !== '') {
        return {
          title: 'The snapshot is there but this tab cannot read it',
          body: `${state.error}. Rebuilding will not change this on its own — the plugin and `
            + 'the command that writes the snapshot have to agree on the contract.',
        }
      }
      if (state.haveSnapshot !== true && state.reason === 'unconfigured') {
        return {
          title: 'No snapshot yet, and no snapshot command is configured',
          body: 'This tab charts a JSON snapshot that a command of your own writes. None is '
            + 'configured for this host, so there is nothing to run. Set `command` (and '
            + '`workspace`) in this plugin\'s row config — see "The snapshot contract" in the '
            + 'README — then reload the page.',
        }
      }
      // The host sends the exact argv a rebuild would run; showing the host's
      // own words rather than a command this file guessed keeps the two halves
      // from drifting apart.
      const command = typeof state.commandHint === 'string' && state.commandHint !== ''
        ? state.commandHint : null
      if (state.haveSnapshot !== true && state.canRefresh === true) {
        return {
          title: 'No snapshot yet',
          body: 'The snapshot the tab reads has not been written. This tab can write it — '
            + 'press Refresh, and your command runs once.',
          command,
        }
      }
      if (state.haveSnapshot !== true) {
        return {
          title: 'No snapshot yet, and this profile cannot build one',
          body: 'This host has no subprocess provider, so the tab cannot run the command '
            + 'itself. Run this in your project, then press Refresh:',
          command,
        }
      }
      if (typeof state.error === 'string' && state.error !== '') {
        return { title: 'The last snapshot could not be used', body: state.error }
      }
      return { title: 'The snapshot carries no series', body: 'The run has not written a point yet.' }
    }

    // ----------------------------------------------------------------------
    // React components
    // ----------------------------------------------------------------------

    const CHART = { width: 720, height: 240, padLeft: 54, padRight: 14, padTop: 12, padBottom: 26 }
    /** The strip under the chart: one overview of the whole run and the window on it. */
    const OVERVIEW = { height: 30, padTop: 4, padBottom: 4 }

    /** What the x axis counts. Every series in a training snapshot is keyed by step. */
    const X_AXIS_LABEL = 'step'
    /** The narrowest window the reader can reach, as a fraction of the full span. */
    const MIN_WINDOW_FRACTION = 0.002
    /** Padding above and below the visible extremes, as a fraction of their span. */
    const Y_PADDING_FRACTION = 0.08
    /** One wheel notch or one button press. */
    const ZOOM_FACTOR = 0.6
    /** How far one arrow key pans, as a fraction of the window. */
    const PAN_FRACTION = 0.25
    /** Below this many pixels a drag is a click, not a selection. */
    const MIN_BRUSH_PIXELS = 6
    /**
     * The clip path's id. One chart is on screen at a time — the panel draws one
     * series — so a constant id is unambiguous; two charts would share the first
     * clip rect, which is the same geometry either way.
     */
    const CLIP_ID = 'dshtd-clip'

    /** The x extent of a series, with a one-step span for a single-point series. */
    function fullRange(points) {
      const xs = points.map((point) => point[0])
      const lo = Math.min(...xs)
      const hi = Math.max(...xs)
      return lo === hi ? { lo: lo - 1, hi: hi + 1 } : { lo, hi }
    }

    /**
     * Keep a window inside the run and no narrower than the floor.
     *
     * Zooming past the floor would leave one or two points in the frame, which
     * is a chart that says nothing; the floor is a registered constant rather
     * than an accident of the arithmetic. A window is centred on the request and
     * then slid back inside the bounds, so dragging past an edge stops at the
     * edge instead of compressing.
     * @param range - the requested window.
     * @param bounds - the whole run.
     * @param minSpan - the floor in x units, defaulting to the registered fraction.
     * @returns the clamped window, or null when the run has no extent.
     */
    function clampRange(range, bounds, minSpan = 0) {
      const boundSpan = bounds.hi - bounds.lo
      if (!(boundSpan > 0)) return null
      const floor = Math.max(minSpan, boundSpan * MIN_WINDOW_FRACTION)
      const span = Math.min(Math.max(range.hi - range.lo, floor), boundSpan)
      const centre = (range.lo + range.hi) / 2
      let lo = centre - span / 2
      if (lo < bounds.lo) lo = bounds.lo
      if (lo + span > bounds.hi) lo = bounds.hi - span
      return { lo, hi: lo + span }
    }

    /** Zoom about one x value: a factor below 1 narrows the window. */
    function zoomRange(range, factor, anchor) {
      return {
        lo: anchor + (range.lo - anchor) * factor,
        hi: anchor + (range.hi - anchor) * factor,
      }
    }

    /** Slide a window by a fraction of its own width. */
    function panRange(range, fraction) {
      const shift = (range.hi - range.lo) * fraction
      return { lo: range.lo + shift, hi: range.hi + shift }
    }

    /** The samples inside a window, ascending in x. */
    function pointsInRange(points, range) {
      return points.filter((point) => point[0] >= range.lo && point[0] <= range.hi)
    }

    /**
     * The samples to DRAW for a window: those inside it, plus the one bracketing
     * each edge, so the line meets the frame instead of starting in mid-air.
     *
     * These are for the GEOMETRY only. Scaling the axis to them would hand the
     * scale back to the sample just outside the window — the spike the reader
     * zoomed in to get away from — so the axis is scaled to `pointsInRange`.
     * @param points - the whole series, ascending in x.
     * @param range - the window.
     * @returns the samples to draw, ascending in x.
     */
    function pointsToDraw(points, range) {
      const drawn = []
      let before = null
      let after = null
      for (const point of points) {
        if (point[0] < range.lo) before = point
        else if (point[0] > range.hi) { after = point; break }
        else drawn.push(point)
      }
      const ordered = before === null ? drawn : [before, ...drawn]
      return after === null ? ordered : [...ordered, after]
    }

    /**
     * The y extent to draw one set of points in, padded; null when there is none.
     *
     * This is what auto-scales a zoomed window: the caller passes the points IN
     * VIEW, so a spike outside the window stops setting the axis.
     * @param points - the points in view.
     * @returns the padded extent, or null for no points.
     */
    function valueRange(points) {
      if (points.length === 0) return null
      const ys = points.map((point) => point[1])
      let lo = Math.min(...ys)
      let hi = Math.max(...ys)
      if (lo === hi) { lo -= 1; hi += 1 }
      const padding = (hi - lo) * Y_PADDING_FRACTION
      return { lo: lo - padding, hi: hi + padding }
    }

    /** The frame's x mapping: which data values its left and right edges hold. */
    function plotGeometry(range) {
      return { left: CHART.padLeft, right: CHART.width - CHART.padRight, lo: range.lo, hi: range.hi }
    }

    /** Clamp a chart-space x to the frame's plot columns. */
    function clampChartPixel(px) {
      return Math.min(Math.max(px, CHART.padLeft), CHART.width - CHART.padRight)
    }

    /** The data value at one x pixel of the frame. */
    function valueAt(px, plot) {
      const fraction = (px - plot.left) / (plot.right - plot.left)
      return plot.lo + fraction * (plot.hi - plot.lo)
    }

    /** The window two x pixels select, ordered. */
    function brushRange(fromPx, toPx, plot) {
      const a = valueAt(fromPx, plot)
      const b = valueAt(toPx, plot)
      return a <= b ? { lo: a, hi: b } : { lo: b, hi: a }
    }

    /**
     * The chart-space x of a pointer event over an element that draws the frame.
     * @param event - a pointer event.
     * @param element - the element the frame is drawn in.
     * @returns the clamped chart-space x.
     */
    function chartPixelFromEvent(event, element) {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0) return CHART.padLeft
      return clampChartPixel(((event.clientX - rect.left) / rect.width) * CHART.width)
    }

    /** "steps 120–480 · 360 of 1200 shown", for the visible readout. */
    function rangeLabel(range, bounds) {
      const lo = Math.round(range.lo)
      const hi = Math.round(range.hi)
      const total = Math.round(bounds.hi - bounds.lo)
      const whole = range.lo <= bounds.lo && range.hi >= bounds.hi
      return whole
        ? `${X_AXIS_LABEL}s ${lo}–${hi} · all ${total} shown`
        : `${X_AXIS_LABEL}s ${lo}–${hi} · ${Math.round(range.hi - range.lo)} of ${total} shown`
    }

    /**
     * The chart for one series, over the timeline the reader selects.
     *
     * Drag on the chart to select a window and it zooms to it; wheel, `+`/`−`,
     * or a drag on the strip below all do the same thing; `Reset` (or `0`, or a
     * double-click) returns to the whole run. The y axis rescales to whatever is
     * IN the window, which is the reason the interaction exists: on a long run
     * one early spike can flatten the last few thousand steps — the part being
     * steered — into a straight line.
     *
     * Zooming changes the DOMAIN, not an SVG transform, so strokes stay a pixel,
     * tick labels stay legible, and the ticks are the standard nice ones for the
     * window on screen. Every control is a labelled button and the chart itself
     * takes focus, because a range reachable only by dragging is a range a
     * keyboard user cannot choose.
     */
    function SeriesChart({ spec, breakLeg }) {
      const points = spec.series.points
      const bounds = React.useMemo(() => fullRange(points), [points])
      // `null` IS the whole run, so "never zoomed" and "reset" are one state and
      // the readout cannot disagree with the picture.
      const [view, setView] = React.useState(null)
      const [brush, setBrush] = React.useState(null)
      const hostRef = React.useRef(null)
      const brushRef = React.useRef(null)
      brushRef.current = brush
      const range = view === null ? bounds : view
      const inside = pointsInRange(points, range)
      const drawn = pointsToDraw(points, range)
      // The axis follows the samples IN the window. A bracketing sample only
      // exists so the line reaches the frame, and letting its value set the
      // scale would let the spike the reader zoomed away from keep dominating
      // the axis — which is the whole reason to zoom. When no sample is inside,
      // the window is crossed by one segment whose two endpoints bound
      // everything visible in it, so those are the honest scale.
      const values = valueRange(inside.length > 0 ? inside : drawn)
      const windowIsEmpty = inside.length === 0 && drawn.length < 2
      const plot = plotGeometry(range)

      /** Show a window, clamped; the whole run collapses back to the null state. */
      const showWindow = React.useCallback((next) => {
        if (next === null) { setView(null); return }
        const clamped = clampRange(next, bounds)
        if (clamped === null || (clamped.lo <= bounds.lo && clamped.hi >= bounds.hi)) { setView(null); return }
        setView(clamped)
      }, [bounds])

      const zoomBy = React.useCallback((factor, anchor) => {
        showWindow(zoomRange(range, factor, anchor))
      }, [range, showWindow])

      // The wheel listener is bound once, so it reads the live window from a ref
      // instead of from the render that installed it.
      const live = React.useRef(null)
      live.current = { range, bounds, plot }
      React.useEffect(() => {
        const host = hostRef.current
        if (host === null) return undefined
        // React's wheel listener is passive by contract, so a wheel that zooms
        // rather than scrolls the panel has to be bound natively.
        const onWheel = (event) => {
          event.preventDefault()
          const current = live.current
          if (current === null) return
          const anchor = valueAt(chartPixelFromEvent(event, host), current.plot)
          const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
          showWindow(zoomRange(current.range, factor, anchor))
        }
        host.addEventListener('wheel', onWheel, { passive: false })
        return () => { host.removeEventListener('wheel', onWheel) }
      }, [showWindow])

      const onPointerDown = (event) => {
        if (event.button !== 0) return
        const host = hostRef.current
        if (host === null) return
        const at = chartPixelFromEvent(event, host)
        host.setPointerCapture?.(event.pointerId)
        setBrush({ from: at, to: at })
      }
      const onPointerMove = (event) => {
        const host = hostRef.current
        if (host === null) return
        const at = chartPixelFromEvent(event, host)
        setBrush((current) => (current === null ? null : { from: current.from, to: at }))
      }
      const onPointerUp = (event) => {
        hostRef.current?.releasePointerCapture?.(event.pointerId)
        const current = brushRef.current
        setBrush(null)
        if (current === null) return
        if (Math.abs(current.to - current.from) < MIN_BRUSH_PIXELS) return
        showWindow(brushRange(current.from, current.to, plot))
      }
      const onKeyDown = (event) => {
        const centre = (range.lo + range.hi) / 2
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1 / ZOOM_FACTOR, centre) }
        else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomBy(ZOOM_FACTOR, centre) }
        else if (event.key === '0' || event.key === 'Escape') { event.preventDefault(); showWindow(null) }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); showWindow(panRange(range, -PAN_FRACTION)) }
        else if (event.key === 'ArrowRight') { event.preventDefault(); showWindow(panRange(range, PAN_FRACTION)) }
      }

      const innerWidth = CHART.width - CHART.padLeft - CHART.padRight
      const innerHeight = CHART.height - CHART.padTop - CHART.padBottom
      const yLo = values === null ? 0 : values.lo
      const yHi = values === null ? 1 : values.hi
      const projectX = (value) => CHART.padLeft + ((value - range.lo) / (range.hi - range.lo)) * innerWidth
      const projectY = (value) => CHART.padTop + innerHeight - ((value - yLo) / (yHi - yLo)) * innerHeight

      const children = []
      children.push(React.createElement('clipPath', { key: 'clip', id: CLIP_ID },
        React.createElement('rect', {
          x: CHART.padLeft, y: CHART.padTop, width: innerWidth, height: innerHeight,
        })))
      for (const tick of niceTicks(yLo, yHi, 4)) {
        const y = projectY(tick)
        children.push(React.createElement('line', {
          key: `grid-${tick}`, className: CLASS.gridline,
          x1: CHART.padLeft, x2: CHART.width - CHART.padRight, y1: y, y2: y,
        }))
        children.push(React.createElement('text', {
          key: `gridlabel-${tick}`, className: CLASS.axis,
          x: CHART.padLeft - 6, y: y + 3, textAnchor: 'end',
        }, formatValue(tick, spec.digits)))
      }
      for (const tick of niceTicks(range.lo, range.hi, 5)) {
        children.push(React.createElement('text', {
          key: `xtick-${tick}`, className: CLASS.axis,
          x: projectX(tick), y: CHART.height - 8, textAnchor: 'middle',
        }, String(Math.round(tick))))
      }

      // The break: on the chart itself, because a joint that is only explained
      // in a footnote is a joint the reader will fit across.
      if (Number.isFinite(breakLeg) && breakLeg >= range.lo && breakLeg <= range.hi) {
        const x = projectX(breakLeg)
        children.push(React.createElement('line', {
          key: 'break', className: CLASS.breakline,
          x1: x, x2: x, y1: CHART.padTop, y2: CHART.padTop + innerHeight,
        }))
        children.push(React.createElement('text', {
          key: 'breaklabel', className: CLASS.breaklabel,
          x: x + 3, y: CHART.padTop + 9,
        }, `break leg ${breakLeg}`))
      }

      if (drawn.length >= 2) {
        children.push(React.createElement('path', {
          key: 'line', className: CLASS.line, clipPath: `url(#${CLIP_ID})`,
          d: polylinePath(drawn, projectX, projectY),
        }))
      } else if (drawn.length === 1) {
        // One sample is a dot, not a line: a single M draws nothing at all.
        children.push(React.createElement('circle', {
          key: 'only', className: CLASS.dot,
          cx: projectX(drawn[0][0]), cy: projectY(drawn[0][1]), r: 2.6,
        }))
      }

      const newest = points[points.length - 1]
      if (newest !== undefined && newest[0] >= range.lo && newest[0] <= range.hi) {
        children.push(React.createElement('circle', {
          key: 'newest', className: CLASS.dot,
          cx: projectX(newest[0]), cy: projectY(newest[1]), r: 2.6,
        }))
      }

      if (brush !== null && brush.overview !== true && Math.abs(brush.to - brush.from) >= 1) {
        const left = Math.min(brush.from, brush.to)
        const right = Math.max(brush.from, brush.to)
        children.push(React.createElement('rect', {
          key: 'brush', className: CLASS.brush,
          x: left, y: CHART.padTop, width: right - left, height: innerHeight,
        }))
        for (const [index, edge] of [left, right].entries()) {
          children.push(React.createElement('line', {
            key: `brushedge-${index}`, className: CLASS.brushEdge,
            x1: edge, x2: edge, y1: CHART.padTop, y2: CHART.padTop + innerHeight,
          }))
        }
      }

      if (windowIsEmpty) {
        children.push(React.createElement('text', {
          key: 'windowempty', className: CLASS.windowNote,
          x: CHART.padLeft + innerWidth / 2, y: CHART.padTop + innerHeight / 2, textAnchor: 'middle',
        }, 'no points in this window · Reset shows the run'))
      }

      const atFloor = range.hi - range.lo <= (bounds.hi - bounds.lo) * MIN_WINDOW_FRACTION * 1.01
      const windowRow = React.createElement('div', { className: CLASS.windowRow },
        React.createElement('button', {
          type: 'button', className: CLASS.windowButton, disabled: !(view !== null),
          title: 'Zoom out ( - )', 'aria-label': 'Zoom out',
          onClick: () => { zoomBy(ZOOM_FACTOR, (range.lo + range.hi) / 2) },
        }, '−'),
        React.createElement('button', {
          type: 'button', className: CLASS.windowButton, disabled: atFloor,
          title: 'Zoom in ( + )', 'aria-label': 'Zoom in',
          onClick: () => { zoomBy(1 / ZOOM_FACTOR, (range.lo + range.hi) / 2) },
        }, '+'),
        React.createElement('button', {
          type: 'button', className: CLASS.windowButton, disabled: !(view !== null),
          title: 'Show the whole run ( 0 )', 'aria-label': 'Reset to the whole run',
          onClick: () => { showWindow(null) },
        }, 'Reset'),
        React.createElement('span', {
          className: CLASS.windowReadout, 'aria-live': 'polite',
        }, rangeLabel(range, bounds)))

      const chart = React.createElement('svg', {
        ref: hostRef,
        className: CLASS.chart,
        viewBox: `0 0 ${CHART.width} ${CHART.height}`,
        role: 'img',
        tabIndex: 0,
        'aria-label': `${spec.label}. ${rangeLabel(range, bounds)}. `
          + `${inside.length} of ${points.length} points in view.`,
        onPointerDown, onPointerMove, onPointerUp,
        onDoubleClick: () => { showWindow(null) },
        onKeyDown,
      }, ...children)

      // The strip is the whole run at a stable scale, with the window drawn on
      // it: the reader can see where they are in the run and jump anywhere,
      // without the strip's own shape changing as they zoom.
      const overviewPlot = { left: CHART.padLeft, right: CHART.width - CHART.padRight, lo: bounds.lo, hi: bounds.hi }
      const overviewValues = valueRange(points) ?? { lo: 0, hi: 1 }
      const overviewHeight = OVERVIEW.height - OVERVIEW.padTop - OVERVIEW.padBottom
      const projectOverviewX = (value) =>
        CHART.padLeft + ((value - bounds.lo) / (bounds.hi - bounds.lo)) * innerWidth
      const projectOverviewY = (value) =>
        OVERVIEW.padTop + overviewHeight - ((value - overviewValues.lo) / (overviewValues.hi - overviewValues.lo)) * overviewHeight
      const overviewRef = React.useRef(null)
      const overviewBrushRef = React.useRef(null)
      const overview = points.length < 2 ? null : React.createElement('svg', {
        ref: overviewRef,
        className: CLASS.overview,
        viewBox: `0 0 ${CHART.width} ${OVERVIEW.height}`,
        role: 'img',
        'aria-label': `The whole run, with the window on it: ${rangeLabel(range, bounds)}`,
        onPointerDown: (event) => {
          if (event.button !== 0 || overviewRef.current === null) return
          const at = chartPixelFromEvent(event, overviewRef.current)
          overviewRef.current.setPointerCapture?.(event.pointerId)
          setBrush({ from: at, to: at, overview: true })
        },
        onPointerMove: (event) => {
          if (overviewRef.current === null) return
          const at = chartPixelFromEvent(event, overviewRef.current)
          setBrush((current) => (current === null || current.overview !== true
            ? current
            : { from: current.from, to: at, overview: true }))
        },
        onPointerUp: (event) => {
          overviewRef.current?.releasePointerCapture?.(event.pointerId)
          const current = overviewBrushRef.current
          setBrush(null)
          if (current === null) return
          if (Math.abs(current.to - current.from) < MIN_BRUSH_PIXELS) {
            // A click, not a drag: keep the window's width and move it there.
            const half = (range.hi - range.lo) / 2
            const centre = valueAt(current.to, overviewPlot)
            showWindow({ lo: centre - half, hi: centre + half })
            return
          }
          showWindow(brushRange(current.from, current.to, overviewPlot))
        },
      },
      React.createElement('path', {
        className: CLASS.overviewLine,
        d: polylinePath(points, projectOverviewX, projectOverviewY),
      }),
      // The window, and — while a drag is in flight on the strip — the window it
      // would select, so the reader sees what they are about to zoom to.
      React.createElement('rect', {
        key: 'window', className: CLASS.overviewWindow,
        x: projectOverviewX(range.lo), y: 0,
        width: Math.max(2, projectOverviewX(range.hi) - projectOverviewX(range.lo)),
        height: OVERVIEW.height,
      }),
      brush !== null && brush.overview === true && Math.abs(brush.to - brush.from) >= 1
        ? React.createElement('rect', {
          key: 'pending', className: CLASS.overviewWindow,
          x: Math.min(brush.from, brush.to), y: 0,
          width: Math.abs(brush.to - brush.from), height: OVERVIEW.height,
        })
        : null)
      overviewBrushRef.current = brush !== null && brush.overview === true ? brush : null

      return React.createElement(React.Fragment, null, windowRow, chart, overview)
    }

    /** One KPI tile. */
    function Kpi({ label, value, title }) {
      return React.createElement('div', { className: CLASS.kpi, title },
        React.createElement('div', { className: CLASS.kpiLabel }, label),
        React.createElement('div', { className: CLASS.kpiValue }, value))
    }

    /**
     * The panel: polls the small state route, fetches the series only when the
     * revision moves, and keeps showing the last good payload throughout.
     */
    function Panel() {
      const [state, setState] = React.useState(null)
      const [payload, setPayload] = React.useState(null)
      const [chosen, setChosen] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const revisionRef = React.useRef(null)

      React.useEffect(() => {
        let stopped = false
        let timer = null

        const tick = async () => {
          try {
            const response = await fetch(`${ROUTE}/state`)
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
            const next = await response.json()
            if (stopped) return
            setState(next)
            setFailure(null)
            if (next.revision !== null && next.revision !== revisionRef.current) {
              const body = await fetch(`${ROUTE}/series`)
              if (stopped) return
              if (body.ok) {
                const full = await body.json()
                if (stopped) return
                revisionRef.current = next.revision
                setPayload(full)
              } else if (body.status === 503) {
                // Expected while the first snapshot is being built. Keep
                // whatever is on screen; the notice already says so.
              } else {
                throw new Error(`series ${body.status} ${body.statusText}`)
              }
            }
          } catch (error) {
            if (!stopped) setFailure(error instanceof Error ? error.message : String(error))
          } finally {
            if (!stopped) timer = setTimeout(tick, POLL_MS)
          }
        }

        tick()
        return () => { stopped = true; if (timer !== null) clearTimeout(timer) }
      }, [])

      /** Ask the host to rebuild the snapshot now, then poll sooner. */
      const refresh = React.useCallback(async () => {
        try {
          // The state route is what triggers the host's due-check; touching it
          // is the request. A tick follows so the rebuild is picked up fast.
          await fetch(`${ROUTE}/state`)
          setTimeout(() => { revisionRef.current = null }, 1500)
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error))
        }
      }, [])

      const offered = React.useMemo(() => availableSeries(payload), [payload])
      const activeSpec = React.useMemo(() => {
        if (offered.length === 0) return null
        return offered.find((item) => item.tag === chosen) ?? offered[0]
      }, [offered, chosen])

      const age = describeAge(state)
      const latestBpb = lastPoint(payload, 'train/bpb_sealed')
      const latestLeg = lastPoint(payload, 'train/bpb_legval') ?? latestBpb
      const latestWall = lastPoint(payload, 'train/wall_seconds')
      const latestVram = lastPoint(payload, 'memory/vram_peak_gib')
      const latestExam = lastPoint(payload, 'eval/exam_accuracy')
      const latestUnits = lastPoint(payload, 'train/units_per_second')

      const head = React.createElement('div', { className: CLASS.head },
        React.createElement('span', { className: CLASS.title }, 'Training dashboard'),
        React.createElement('span', { className: CLASS.subtitle },
          state?.arm ? `run ${state.arm}` : 'training run'),
        React.createElement('span', { className: CLASS.age },
          React.createElement('span', {
            className: CLASS.ageBadge, 'data-tone': age.tone,
            title: state?.generatedAt ? `snapshot generated ${state.generatedAt}` : 'no snapshot',
          }, state?.refreshing === true ? `${age.text} · rebuilding` : age.text),
          React.createElement('button', {
            className: CLASS.refresh, type: 'button', onClick: refresh,
            disabled: state?.canRefresh !== true,
            title: state?.canRefresh === true
              ? 'Rebuild the snapshot now'
              : 'This profile has no subprocess provider, so the tab cannot run the tool',
          }, 'Refresh')))

      const kpis = React.createElement('div', { className: CLASS.kpis },
        React.createElement(Kpi, {
          label: 'leg',
          value: latestLeg === null ? '—' : String(Math.round(latestLeg[0])),
        }),
        React.createElement(Kpi, {
          label: 'sealed bpb',
          value: latestBpb === null ? '—' : formatValue(latestBpb[1], 4),
          title: 'the sealed exam curve, one reading per leg',
        }),
        React.createElement(Kpi, {
          label: 'leg wall',
          value: latestWall === null ? '—' : `${formatValue(latestWall[1], 1)}s`,
        }),
        React.createElement(Kpi, {
          label: 'units/s',
          value: latestUnits === null ? '—' : formatValue(latestUnits[1], 0),
        }),
        React.createElement(Kpi, {
          label: 'vram peak',
          value: latestVram === null ? '—' : `${formatValue(latestVram[1], 2)}G`,
        }),
        React.createElement(Kpi, {
          label: 'exam acc',
          value: latestExam === null ? '—' : formatValue(latestExam[1], 4),
          title: latestExam === null ? 'no exam reading yet'
            : `last read at leg ${Math.round(latestExam[0])}`,
        }))

      const chips = offered.length === 0 ? null
        : React.createElement('div', { className: CLASS.chips },
          ...offered.map((item) => React.createElement('button', {
            key: item.tag, type: 'button', className: CLASS.chip,
            'data-on': activeSpec !== null && activeSpec.tag === item.tag ? 'true' : 'false',
            onClick: () => setChosen(item.tag),
            title: item.series.source ? `${item.tag} — ${item.series.source}` : item.tag,
          }, item.label)))

      const chart = activeSpec === null ? null
        : React.createElement('div', { className: CLASS.chartWrap },
          React.createElement(SeriesChart, { spec: activeSpec, breakLeg: state?.breakLeg }),
          React.createElement('div', { className: CLASS.legend },
            React.createElement('span', { className: CLASS.legendItem },
              `${activeSpec.series.points.length} points · unit ${activeSpec.unit || 'none'}`
              + (activeSpec.series.source ? ` · ${activeSpec.series.source}` : ''))))

      const notice = failure !== null
        ? React.createElement('div', { className: CLASS.notice },
          React.createElement('div', { className: CLASS.noticeTitle }, 'The host is not answering'),
          React.createElement('div', { className: CLASS.noticeBody }, failure))
        : (payload === null
          ? (() => {
            const reason = emptyReason(state)
            return React.createElement('div', { className: CLASS.notice },
              React.createElement('div', { className: CLASS.noticeTitle }, reason.title),
              React.createElement('div', { className: CLASS.noticeBody }, reason.body),
              reason.command
                ? React.createElement('code', { className: CLASS.code }, reason.command)
                : null)
          })()
          : null)

      const stale = payload !== null && state?.stale === true
        ? React.createElement('div', { className: CLASS.notice },
          React.createElement('div', { className: CLASS.noticeTitle }, 'These numbers are not the newest'),
          React.createElement('div', { className: CLASS.noticeBody },
            `${ageSentence(state)} They are older than the ${state.refreshSeconds}s refresh interval, `
            + 'so a step may have finished since. What is drawn below is real, just not current.'))
        : null

      const body = payload === null
        ? React.createElement('div', { className: CLASS.empty }, 'No series to draw yet.')
        : React.createElement(React.Fragment, null, kpis, chips, chart)

      return React.createElement('div', { className: CLASS.panel },
        head, notice, stale, body,
        React.createElement('div', { className: CLASS.footnote },
          state?.snapshotPath ? `reading ${state.snapshotPath}` : 'reading the configured snapshot'))
    }

    /**
     * The frame trigger: a chart glyph that opens the tab.
     *
     * The wrapper is what the stylesheet positions, so the button must be
     * rendered inside it — a registered component that returns the button alone
     * leaves `.dshtd-trigger` with no element to apply to.
     */
    function TriggerButton({ sidebarRight, layout }) {
      return React.createElement('div', { className: CLASS.trigger },
        React.createElement('button', {
          className: CLASS.triggerButton,
          type: 'button',
          title: 'Training dashboard',
          'aria-label': 'Training dashboard',
          onClick: () => {
            const open = typeof sidebarRight?.isOpen === 'function' ? sidebarRight.isOpen() : false
            const showing = typeof sidebarRight?.activeTab === 'function'
              ? sidebarRight.activeTab() === KIND : false
            if (open && showing) {
              layout.closeRightbar()
            } else {
              sidebarRight.openTab(KIND)
              layout.openRightbar(true, false)
            }
          },
        }, React.createElement('svg', {
          viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.7,
          strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        },
        React.createElement('path', { d: 'M3 20h18' }),
        React.createElement('path', { d: 'M4 16l4.5-5 3.5 3L20 6' }),
        React.createElement('path', { d: 'M20 10V6h-4' }))))
    }

    /** The only declared dependencies: real client services, never slots. */
    const inject = ['slots', 'sidebarRight', 'sidebarRightTabs', 'layout']

    /** Register the tab type, its body and title, and the frame trigger. */
    function apply(ctx) {
      const removeStyles = insertStyles()
      ctx.effect(() => removeStyles, 'train-dashboard styles')

      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TYPE_ID,
        kind: KIND,
        multiple: false,
        priority: 'extension',
        title: () => 'Training dashboard',
        guide: [{
          id: 'open',
          order: 55,
          title: () => 'Training dashboard',
          description: () => "The live training pass: sealed bpb, leg wall time, VRAM and exams.",
          icon: null,
        }],
      }), 'train-dashboard.tab-type')

      // The body registers under the DEFINITION'S ID: the pane dispatches with
      // `entryKey: definition.id ?? tab.kind`.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TYPE_ID,
        inject: () => ({}),
      }, Panel)), 'train-dashboard.tab-body')

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: TYPE_ID,
        inject: () => ({}),
      }, () => React.createElement('span', null, 'Training dashboard'))),
      'train-dashboard.tab-title')

      // `name` is the registration's own address in the slot registry: a
      // registration without it throws `slot "undefined" is not declared`
      // while `apply` runs, which the desktop application treats as a failed
      // startup.
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'train-dashboard-trigger',
        order: 79,
        label: 'Training dashboard',
      }, () => React.createElement(TriggerButton, {
        sidebarRight: ctx.sidebarRight,
        layout: ctx.layout,
      }))), 'train-dashboard.trigger')
    }

    module.exports.inject = inject
    module.exports.apply = apply
    // The pure helpers, exposed so a test can pin them without a DOM. They are
    // the parts that can be wrong in a way the rendered page cannot show.
    module.exports.__test = {
      seriesIndex,
      availableSeries,
      isTraceTag,
      lastPoint,
      niceTicks,
      formatValue,
      polylinePath,
      describeAge,
      ageSentence,
      emptyReason,
      CHART,
      OVERVIEW,
      fullRange,
      clampRange,
      zoomRange,
      panRange,
      pointsInRange,
      pointsToDraw,
      valueRange,
      plotGeometry,
      clampChartPixel,
      valueAt,
      brushRange,
      rangeLabel,
      MIN_WINDOW_FRACTION,
      ZOOM_FACTOR,
      PAN_FRACTION,
      MIN_BRUSH_PIXELS,
      POLL_MS,
      TYPE_ID,
      KIND,
      ROUTE,
      Panel,
      SeriesChart,
    }
    return module.exports
  },
})
