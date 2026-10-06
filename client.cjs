/**
 * Browser half of `dsh-train-dashboard`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * A live training dashboard that lives in the RIGHT PANE, as a real tab type
 * beside Files / Terminal / Document — the same registration the shipped tabs
 * use (`sidebarRightTabs`), so it gets a strip chip, a title, and the pane's
 * own chrome. Two ways to open it:
 *
 *   - a chart glyph in the session header's ACTION ROW (the
 *     `conversation.session.header.actions` seat, beside the shipped jobs and
 *     subagent controls), which opens the tab in one click;
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

    /**
     * The seat the one-click trigger registers in: the session header's
     * title-adjacent action row, where the shipped jobs, subagent, agent-preset
     * and agent-team controls live.
     *
     * It is deliberately NOT `shell.overlay`. That seat is a frame-wide
     * floating layer for badges, toasts and status pills, and the layer is
     * click-through by design, so a BUTTON registered there is both in the
     * wrong place (the window's top-left, beside the application menus and the
     * sidebar's reopen control) and unclickable unless it opts back into
     * pointer events. An action belongs in an action row.
     */
    const TRIGGER_SLOT = 'conversation.session.header.actions'

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
      moreChip: 'dshtd-more-chip',
      chart: 'dshtd-chart',
      chartWrap: 'dshtd-chart-wrap',
      axis: 'dshtd-axis',
      gridline: 'dshtd-gridline',
      marker: 'dshtd-breakmark',
      markerTick: 'dshtd-break-tick',
      markerLabel: 'dshtd-breaklabel',
      markerHalo: 'dshtd-breakhalo',
      markerSwatch: 'dshtd-marker-swatch',
      markerLegText: 'dshtd-break-leg-text',
      frontierMark: 'dshtd-frontier-mark',
      frontierLabel: 'dshtd-frontier-label',
      breaks: 'dshtd-breaks',
      breaksHead: 'dshtd-breaks-head',
      breaksNote: 'dshtd-breaks-note',
      breaksKey: 'dshtd-breaks-key',
      keyItem: 'dshtd-breaks-key-item',
      swatch: 'dshtd-break-swatch',
      breakRow: 'dshtd-break-row',
      breakRowHead: 'dshtd-break-row-head',
      breakBadge: 'dshtd-break-badge',
      breakLegText: 'dshtd-break-leg',
      breakWhat: 'dshtd-break-what',
      breakReason: 'dshtd-break-reason',
      breakMeaning: 'dshtd-break-meaning',
      breakSupport: 'dshtd-break-support',
      breakContradiction: 'dshtd-break-contradiction',
      frontier: 'dshtd-frontier',
      frontierSwatch: 'dshtd-frontier-swatch',
      frontierTitle: 'dshtd-frontier-title',
      frontierHead: 'dshtd-frontier-head',
      frontierSentence: 'dshtd-frontier-sentence',
      frontierCaveat: 'dshtd-frontier-caveat',
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
/* The trigger is one entry in the session header's action row, beside the
   shipped jobs and subagent controls, so its metrics are theirs: a borderless
   transparent button of at least 28px, tertiary label colour at rest and
   secondary on hover, which is what makes the row read as one set of controls
   rather than a foreign object dropped into it. */
.${CLASS.trigger} { display: inline-flex; align-items: center; }
.${CLASS.triggerButton} {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; min-height: 28px; padding: 3px 4px; cursor: pointer;
  border: 0; border-radius: var(--dsw-radius-sm, 6px); background: 0 0;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}
.${CLASS.triggerButton}:hover, .${CLASS.triggerButton}:focus-visible {
  background: var(--dsw-alias-fill-l1, rgba(255, 255, 255, 0.06));
  color: var(--dsw-alias-label-secondary, #b0b0b0);
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
/* The reader's choice when this revision does not carry it: still selected, and
   visibly set apart by a dashed edge as well as by its own text, so the state is
   never carried by colour alone. */
.${CLASS.chip}[data-missing='true'] {
  border-style: dashed;
  border-color: var(--dsw-alias-border-l2, #5a5a5a);
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}
/* The disclosure that holds the other fifty-odd series. Quieter than a chip and
   not a series itself, so it cannot be mistaken for one. */
.${CLASS.moreChip} {
  border: 1px dashed var(--dsw-alias-border-l2, #3a3a3a); border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-tertiary, #8a8a8a);
  cursor: pointer; font-size: 11px; padding: 2px 10px; white-space: nowrap;
}
.${CLASS.moreChip}:hover, .${CLASS.moreChip}[data-open='true'] {
  color: var(--dsw-alias-label-secondary, #b0b0b0);
  border-color: var(--dsw-alias-border-l1, #4a4a4a);
}
.${CLASS.chartWrap} {
  border: 1px solid var(--dsw-alias-border-l1, #2e2e2e); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 6px;
}
.${CLASS.chart} { display: block; width: 100%; height: auto; }
.${CLASS.axis} { fill: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 9px; }
.${CLASS.gridline} { stroke: var(--dsw-alias-border-l1, #2e2e2e); stroke-width: 1; }
/* The break markers. THE KIND IS A SHAPE ON THE LINE, and the colour is a second
   channel for the same fact: a reader who cannot tell green from amber still
   reads a circle against a triangle. The word for the kind is in the register
   under the chart, where the reason, the meaning and the reading live too. Each
   kind sets one custom property, and the line, its swatch and the register's badge
   all read it. The label group is included, because the swatch is a child of that
   group and a custom property set on the line's group does not reach it. */
.${CLASS.marker}[data-kind='corpus'], .${CLASS.markerLabel}[data-kind='corpus'], .${CLASS.breakRow}[data-kind='corpus'], .${CLASS.swatch}[data-kind='corpus'] { --dshtd-kind: #3fa06b; }
.${CLASS.marker}[data-kind='instrument'], .${CLASS.markerLabel}[data-kind='instrument'], .${CLASS.breakRow}[data-kind='instrument'], .${CLASS.swatch}[data-kind='instrument'] { --dshtd-kind: #8f7ff0; }
.${CLASS.marker}[data-kind='arithmetic'], .${CLASS.markerLabel}[data-kind='arithmetic'], .${CLASS.breakRow}[data-kind='arithmetic'], .${CLASS.swatch}[data-kind='arithmetic'] { --dshtd-kind: #e05252; }
.${CLASS.marker}[data-kind='shape'], .${CLASS.markerLabel}[data-kind='shape'], .${CLASS.breakRow}[data-kind='shape'], .${CLASS.swatch}[data-kind='shape'] { --dshtd-kind: #e0a13f; }
.${CLASS.marker}[data-kind='restart'], .${CLASS.markerLabel}[data-kind='restart'], .${CLASS.breakRow}[data-kind='restart'], .${CLASS.swatch}[data-kind='restart'] { --dshtd-kind: #5aa9e6; }
.${CLASS.marker}[data-kind='break'], .${CLASS.markerLabel}[data-kind='break'], .${CLASS.breakRow}[data-kind='break'], .${CLASS.swatch}[data-kind='break'] { --dshtd-kind: #9aa0a6; }
.${CLASS.marker}, .${CLASS.markerLabel}, .${CLASS.breakRow}, .${CLASS.swatch} { --dshtd-kind: #9aa0a6; }
.${CLASS.marker} { stroke: var(--dshtd-kind); stroke-width: 1; }
.${CLASS.marker}[data-declared='true'] { stroke-dasharray: 3 3; }
/* The same markers on the strip under the chart: dimmer, because they are a
   map of where the joints are and not the labels a reader works from. */
.${CLASS.markerTick} { stroke: var(--dshtd-kind); stroke-width: 1; opacity: 0.55; }
.${CLASS.markerHalo} { fill: var(--dsw-alias-bg-layer-1, #1d1d1d); opacity: 0.85; }
.${CLASS.markerLabel} { font-size: 9px; }
.${CLASS.markerLegText} { fill: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.markerSwatch} { fill: var(--dshtd-kind); }
/* The register and its key carry the SAME SHAPE as the mark on the chart, so the
   chart can be read without separating hues: the reader finds the triangle in the
   key and the same triangle on the line. One shape per kind, matching
   MARKER_SHAPES in the browser half. */
.${CLASS.swatch} {
  width: 9px; height: 9px; flex: none; display: inline-block;
  background: var(--dshtd-kind); border-radius: 2px;
}
.${CLASS.swatch}[data-kind='corpus'] { border-radius: 50%; }
.${CLASS.swatch}[data-kind='instrument'] { border-radius: 2px; }
.${CLASS.swatch}[data-kind='shape'] { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.${CLASS.swatch}[data-kind='arithmetic'] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.${CLASS.swatch}[data-kind='restart'] { clip-path: polygon(0 0, 100% 0, 50% 100%); }
.${CLASS.swatch}[data-kind='break'] { clip-path: inset(35% 0 35% 0); }
.${CLASS.swatch}[data-kind='unknown'] {
  clip-path: polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%,
    35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%);
}
/* The frontier's own swatch: the outline of a diamond, in the label colour. An
   expectation is not a kind of joint, so it is the one swatch that is not filled. */
.${CLASS.frontierSwatch} { fill: none; stroke: var(--dsw-alias-label-tertiary, #8a8a8a); stroke-width: 1; }
/* The frontier: dashed, dimmer, and labelled "expected". It must not look like
   the markers above, which are read from artifacts that exist. */
.${CLASS.frontierMark} { stroke: var(--dsw-alias-label-tertiary, #8a8a8a); stroke-width: 1; stroke-dasharray: 6 4; opacity: 0.9; }
.${CLASS.frontierLabel} { fill: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 9px; font-style: italic; }
.${CLASS.breaks} {
  display: flex; flex-direction: column; gap: 8px; margin-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l1, #2e2e2e); padding-top: 8px;
}
.${CLASS.breaksHead} { font-size: 11px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.${CLASS.breaksNote} { color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10px; font-weight: 400; }
.${CLASS.breaksKey} { display: flex; flex-wrap: wrap; gap: 10px; }
.${CLASS.keyItem} { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary, #b0b0b0); font-size: 10px; }
.${CLASS.swatch} { width: 8px; height: 8px; border-radius: 2px; background: var(--dshtd-kind); display: inline-block; }
.${CLASS.breakRow} {
  border-left: 2px solid var(--dshtd-kind); border-radius: 0 6px 6px 0;
  background: var(--dsw-alias-bg-layer-2, #262626); padding: 6px 8px;
  display: flex; flex-direction: column; gap: 3px;
}
.${CLASS.breakRowHead} { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.${CLASS.breakBadge} {
  color: var(--dshtd-kind); border: 1px solid var(--dshtd-kind); border-radius: 999px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em; padding: 0 6px;
}
.${CLASS.breakLegText} { color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10px; font-variant-numeric: tabular-nums; }
.${CLASS.breakWhat} { font-size: 11px; font-weight: 600; }
.${CLASS.breakReason} { color: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.breakMeaning} { color: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.breakSupport}, .${CLASS.breaksNote} { color: var(--dsw-alias-label-caption, #8a8a8a); font-size: 10px; }
.${CLASS.breakContradiction} { color: var(--dsw-alias-state-warn-primary, #e5a34d); }
.${CLASS.frontier} {
  border: 1px dashed var(--dsw-alias-border-l2, #3a3a3a); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 8px 10px;
  display: flex; flex-direction: column; gap: 4px;
}
.${CLASS.frontierTitle} { font-weight: 600; }
.${CLASS.frontierHead} { color: var(--dsw-alias-label-primary, #f0f0f0); }
.${CLASS.frontierSentence} { color: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.frontierCaveat} { color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10px; }
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
     * The metrics this tab leads with, in reading order, with their units.
     *
     * A SHORT list on purpose. The snapshot carries sixty series, and a chip for
     * every one of them is a wall of controls over a chart that draws one curve:
     * the reader ends up hunting for the few they actually steer by. Everything
     * else is still reachable, one click away, behind "more series" — see
     * `availableSeries` and `splitOffered`.
     *
     * What is here, and why:
     *   - the leg's own end-of-leg validation reading, NOT the curve's bpb. They
     *     are the SAME CHART: measured on the live snapshot, the curve carries 688
     *     readings over legs 1..689 and the leg reading carries 730 over 1..731,
     *     and on all 688 legs they share the values are identical. The curve stops
     *     at the phase boundary (leg 690, the corpus transfer) and the leg reading
     *     keeps going for another 42 legs. Offering both put a truncated duplicate
     *     of one curve in the chips, and the truncated copy was the default.
     *   - throughput, because the pass's next throughput rung is priced in units
     *     per second and this is that number.
     *   - VRAM peak, because the memory envelope is the physical stop.
     *   - the exam, because it is the only instrument that measures capability
     *     rather than compression.
     *
     * This list is a convenience and not a contract. A tag it does not know is
     * still offered, labelled by its own tag, so a producer is free to emit
     * whatever series names its run uses.
     */
    const INTERESTING = [
      { tag: 'train/bpb_legval', label: 'leg-val bpb', unit: 'bpb', digits: 4 },
      { tag: 'train/units_per_second', label: 'units/s', unit: 'u/s', digits: 1 },
      { tag: 'memory/vram_peak_gib', label: 'VRAM peak', unit: 'GiB', digits: 2 },
      { tag: 'eval/exam_accuracy', label: 'exam accuracy', unit: '', digits: 4 },
      // The curve's own bits per byte, kept ONLY for a snapshot whose producer
      // writes no leg-end reading. Where both exist it is a strict prefix of the
      // other: identical on every shared leg, and it stops at the phase boundary.
      {
        tag: 'train/bpb_sealed',
        label: 'sealed bpb (stops at the transfer)',
        unit: 'bpb',
        digits: 4,
        fallbackFor: 'train/bpb_legval',
      },
    ]

    /**
     * The held-out reading, best source first.
     *
     * The tab's headline number, and the one the KPI header and the default chart
     * both read. Named once here so the two cannot disagree about which series the
     * reading comes from.
     */
    const HEADLINE_TAGS = ['train/bpb_legval', 'train/bpb_sealed']

    /**
     * Whether a tag looks like a per-step trace rather than a per-run series.
     *
     * A trace tag names one step (`vram_trace/step_0001_gib`), so offering one
     * chip per trace would bury the series a reader came for. The rule is by
     * shape, not by a list of known prefixes, so a producer's own trace naming
     * is filtered too.
     */
    function isTraceTag(tag) {
      return tag.includes('/trace/') || tag.endsWith('_trace')
        // A producer's own per-step, per-leg naming: `<subject>_trace/<...>`.
        // The snapshot's guard traces are named this way and rotate with the leg
        // (guard_trace/…_leg_00722_… becomes …_00725_…), so a chip for one is a
        // chip that disappears on the next refresh — and a chip that disappears
        // is how a reader's selection used to be silently replaced.
        || /(^|\/)[a-z0-9]+_trace\//.test(tag)
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
     * Every series the payload could be charted as, the leads first.
     *
     * Each entry carries `primary`: the leads from INTERESTING are primary and
     * everything else is not, so the panel can show a handful of chips and keep
     * the rest behind a disclosure without losing the promise that a tag this
     * tab has never heard of is still reachable.
     *
     * An entry with `fallbackFor` is dropped when the series it defers to is
     * present, which is how the curve's rounded bpb stops being offered beside
     * the leg-end reading of the same number.
     *
     * Per-step trace tags are left out of the fallback list because each one is a
     * single step and would flood the chips.
     */
    function availableSeries(payload) {
      const index = seriesIndex(payload)
      const offered = []
      const known = new Set()
      // A series another entry defers to its better source entirely: `bpb_sealed`
      // is a strict prefix of `bpb_legval`, so where both exist the truncated one
      // is not offered at all, not even behind the disclosure.
      const suppressed = new Set(INTERESTING
        .filter((spec) => spec.fallbackFor !== undefined && index.has(spec.fallbackFor))
        .map((spec) => spec.tag))
      for (const spec of INTERESTING) {
        if (suppressed.has(spec.tag)) continue
        if (index.has(spec.tag)) {
          offered.push({ ...spec, primary: true, series: index.get(spec.tag) })
          known.add(spec.tag)
        }
      }
      for (const [tag, item] of index) {
        if (known.has(tag) || suppressed.has(tag)) continue
        if (isTraceTag(tag)) continue
        if (tag.endsWith('_pre_break') || tag.endsWith('_post_break')) continue
        offered.push({ tag, label: tag, unit: '', digits: 3, primary: false, series: item })
      }
      return offered
    }

    /** The chips shown by default, and the ones behind the disclosure. */
    function splitOffered(offered) {
      return {
        primary: offered.filter((item) => item.primary === true),
        more: offered.filter((item) => item.primary !== true),
      }
    }

    /**
     * Whether the disclosure must be open regardless of what the reader clicked.
     *
     * A remembered choice can live among the hidden series, because the series a
     * reader is steering moves as the run does, and a chart drawing a series whose
     * chip is not on screen is a chart with no visible selection.
     */
    function disclosureForced(chosen, more) {
      return chosen !== null && more.some((item) => item.tag === chosen)
    }

    /**
     * The series each session last had on screen, and the window each series was
     * left zoomed to.
     *
     * Both belong to the READER, not to the payload, so both live outside the
     * components. A tab body is unmounted and mounted again when the pane
     * rebuilds its view, when the session changes, and whenever the seat
     * remounts its entry, and React state does not survive any of that: the
     * reader's choice would silently return to the default series on the next
     * update. Reported from the running app.
     *
     * The series map is keyed by session id when the seat passes one, with ''
     * for a body rendered without one, so two sessions cannot fight over a
     * single choice. The window map is keyed by series tag, because a window is
     * only meaningful for the series it was drawn on.
     */
    const chosenSeriesBySession = new Map()
    const windowByTag = new Map()

    /** What the reader has chosen for one session, or null for the default. */
    function rememberedSeries(sessionId) {
      return chosenSeriesBySession.get(sessionId ?? '') ?? null
    }

    /** Remember, or forget with a null tag, the reader's choice for one session. */
    function rememberSeries(sessionId, tag) {
      if (tag === null || tag === undefined) chosenSeriesBySession.delete(sessionId ?? '')
      else chosenSeriesBySession.set(sessionId ?? '', tag)
    }

    /** The window one series was left at, or null for the whole run. */
    function rememberedWindow(tag) {
      return windowByTag.get(tag) ?? null
    }

    /** Remember, or forget with a null window, where one series was left. */
    function rememberWindow(tag, range) {
      if (range === null || range === undefined) windowByTag.delete(tag)
      else windowByTag.set(tag, range)
    }

    /**
     * Which series to draw, given what the reader chose and what the payload has.
     *
     * A chosen tag that is NOT in this snapshot is reported as `missing` rather
     * than treated as a reason to draw a different curve. The distinction is the
     * whole point: the snapshot is rebuilt from logs on disk on every refresh, so
     * a series can drop out of it for a revision (a rotated log, a pruned exam
     * file), and quietly falling back to the first series moves the reader onto a
     * curve they did not ask for while looking exactly like a redraw.
     *
     * @param offered - the chips the payload offers, best first.
     * @param chosen - the tag the reader chose, or null for the default.
     * @returns the spec to draw (null when there is nothing to draw) and whether
     *   the reader's choice is missing from this payload.
     */
    function resolveSelection(offered, chosen) {
      if (offered.length === 0) return { spec: null, missing: false }
      if (chosen === null) return { spec: offered[0], missing: false }
      const found = offered.find((item) => item.tag === chosen)
      return found === undefined ? { spec: null, missing: true } : { spec: found, missing: false }
    }

    /** The last point of a tag, or null. */
    function lastPoint(payload, tag) {
      const item = seriesIndex(payload).get(tag)
      if (item === undefined || item.points.length === 0) return null
      return item.points[item.points.length - 1]
    }

    /**
     * The held-out reading, from the best source the payload carries.
     *
     * The leg-end reading first, and the curve's rounded copy only when that is
     * all there is, so the header and the default chart cannot disagree about
     * which series the number came from.
     * @param payload - the snapshot body.
     * @returns the newest point and the tag it came from, or null for neither.
     */
    function headlineReading(payload) {
      for (const tag of HEADLINE_TAGS) {
        const point = lastPoint(payload, tag)
        if (point !== null) return { point, tag }
      }
      return null
    }

    /** The chip label for one tag, falling back to the tag, or to the reading's own name. */
    function seriesLabel(tag) {
      if (tag === null || tag === undefined) return 'held-out bpb'
      const spec = INTERESTING.find((item) => item.tag === tag)
      return spec === undefined ? tag : spec.label
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

    /**
     * Format one value for a KPI tile or an axis label.
     *
     * The scale tiers matter for throughput: a leg's units per second is tens of
     * thousands, and `digits: 0` on that renders `65538` where `65.5k` is what a
     * reader takes in at a glance. The `M` tier was already here for the bpb-era
     * numbers; `k` is its counterpart for a rate.
     */
    function formatValue(value, digits) {
      if (!Number.isFinite(value)) return '—'
      const places = Number.isFinite(digits) ? digits : 3
      const magnitude = Math.abs(value)
      if (value !== 0 && magnitude >= 1e6) {
        return `${(value / 1e6).toFixed(1)}M`
      }
      if (value !== 0 && magnitude >= 1e4) {
        return `${(value / 1e3).toFixed(1)}k`
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

    // ----------------------------------------------------------------------
    // Break markers and the frontier.
    //
    // The chart used to carry ONE break: the producer's `break_leg`. A snapshot
    // can now carry `breaks`, a list of markers the producer derived from its
    // own artifacts, each with a KIND — and the kinds do not mean the same
    // thing, which is the whole reason to draw them differently:
    //
    //   corpus      the DATA changed, so a rise here is expected
    //   instrument  the READ changed, so the joint is a level shift with no
    //               slope across it
    //   arithmetic  the numbers changed, so the series is not comparable at all
    //   shape       the leg's geometry changed with its volume held constant
    //   restart     the process restarted
    //
    // NOTHING HERE INVENTS A MEANING. Every sentence a marker shows — its short
    // label, its reason and the meaning of its kind — is the producer's own
    // text, carried through exactly. This half chooses where it sits and how it
    // reads, never what it says; a paraphrase here would be a second statement
    // of one fact, free to disagree with the producer's own view of the run.
    // ----------------------------------------------------------------------

    /**
     * The five kinds the producer's markers use, in the order the chart lists
     * them at one leg. An unknown kind is NOT dropped: it keeps its own word and
     * is drawn in a neutral colour. A new kind is the producer's business, and a
     * tab that silently hid it would be hiding a break.
     */
    const KIND_ORDER = ['corpus', 'instrument', 'arithmetic', 'shape', 'restart']

    /** The kind word shown when the snapshot serves a marker with no kind. */
    const UNKNOWN_KIND = 'unknown'

    /** The kind word for the producer's own `break_leg`, which carries no kind. */
    const DECLARED_KIND = 'break'

    /**
     * The shape each kind of break is drawn as on the chart.
     *
     * The chart carries the kind as a SHAPE, and the colour is a second channel
     * for the same fact rather than the only one: a kind encoded by hue alone is
     * invisible to a reader who cannot separate the hues, and these kinds do
     * different things to the curve, so an unreadable kind invites exactly the
     * comparison the register exists to prevent. The WORD for the kind lives in
     * the register under the chart, where there is room for it; the chart carries
     * the shape, the colour, and the leg number that joins the two. The
     * assignment is fixed for the life of the tab, so a kind never changes shape
     * under a reader who has learned it.
     *
     * A kind this tab has never seen still gets a shape, because a marker drawn
     * without one is worse than no marker.
     */
    const MARKER_SHAPES = {
      corpus: 'circle',
      instrument: 'square',
      arithmetic: 'triangle',
      shape: 'diamond',
      restart: 'triangle-down',
      [DECLARED_KIND]: 'bar',
      [UNKNOWN_KIND]: 'plus',
    }

    /** The shape one hand of kinds is drawn as; an unseen kind is a plus. */
    function markerShape(kind) {
      return MARKER_SHAPES[kind] ?? MARKER_SHAPES[UNKNOWN_KIND]
    }

    /** Side of the marker swatch, in chart units. */
    const MARKER_SWATCH_SIZE = 7

    /** The gap between a marker's swatch and its leg number. */
    const MARKER_SWATCH_GAP = 3

    /** How much of a marker's own label fits on the chart before it is cut. */
    const MARKER_LABEL_CHARS = 22

    /**
     * Estimated width of one character at the marker label's font size, and the
     * gap between a marker's line and its label.
     *
     * An estimate, because SVG text is measured by the browser and this is
     * arithmetic a test can pin. It is deliberately generous (the label font is
     * proportional, and these tags are digit- and capital-heavy): an
     * over-estimate costs a lane, an under-estimate lets two labels touch.
     */
    const MARKER_CHAR_WIDTH = 5.2
    const MARKER_LABEL_PAD = 8

    /** The vertical step between two marker labels that would otherwise collide. */
    const MARKER_LANE_HEIGHT = 12

    /** The chart tag for a marker with no label of its own. */
    function markerKindWord(kind) {
      return typeof kind === 'string' && kind.trim() !== '' ? kind.trim().toLowerCase() : UNKNOWN_KIND
    }

    /** A string field of a served marker, or '' when it is absent or not text. */
    function markerText(value) {
      return typeof value === 'string' ? value : ''
    }

    /**
     * Cut `text` to at most `limit` characters, on a word boundary, with `…`.
     *
     * The chart has room for a few words and the register has room for all of
     * them, so the cut is visible rather than silent: the ellipsis says the
     * sentence continues, and the marker's own tooltip and register row carry it
     * whole. Cutting mid-word is what this avoids.
     */
    function clipWords(text, limit = MARKER_LABEL_CHARS) {
      const words = String(text ?? '').trim()
      if (words.length <= limit) return words
      const head = words.slice(0, limit)
      const lastSpace = head.lastIndexOf(' ')
      return `${(lastSpace > 0 ? head.slice(0, lastSpace) : head).trimEnd()}…`
    }

    /** One served marker, normalized; every field the chart reads is a string or a number. */
    function markerFrom(entry) {
      return {
        leg: entry.leg,
        kind: markerKindWord(entry.kind),
        label: markerText(entry.label),
        reason: markerText(entry.reason),
        meaning: markerText(entry.meaning),
        support: markerText(entry.support),
        contradiction: markerText(entry.contradiction),
        // The producer's own statement about where the marker came from. A
        // marker whose leg is a constant in the producer's code says so; one
        // derived from artifacts says nothing, because there is nothing to warn
        // about. Absent is NOT read as "declared": that would put a warning on
        // every marker of a producer too old to serve the field.
        declaredInCode: entry.derived === false,
        declared: false,
      }
    }

    /**
     * The producer's own `break_leg`, as a marker.
     *
     * Kept, and kept distinct: it is the one joint the snapshot declares without
     * deriving it, and it is what a producer that serves no `breaks` array has.
     * It carries no kind, and this tab does not guess one — the register says so
     * in as many words rather than colouring it like a corpus change.
     */
    function declaredLegMarker(leg) {
      return {
        leg,
        kind: DECLARED_KIND,
        label: '',
        reason: '',
        meaning: '',
        support: '',
        contradiction: '',
        declaredInCode: false,
        declared: true,
      }
    }

    /**
     * The markers a snapshot serves, oldest leg first, and what could not be used.
     *
     * `payload.breaks` is the producer's derived list; `payload.break_leg` is the
     * older single-break key, folded in as its own marker so a producer that
     * still writes only that one keeps working. A marker with no readable leg
     * cannot be placed on an axis at all, so it is counted and reported rather
     * than dropped in silence.
     *
     * @returns `{ markers, skipped }`.
     */
    function readBreakMarkers(payload) {
      const served = payload !== null && typeof payload === 'object' && Array.isArray(payload.breaks)
        ? payload.breaks : []
      const markers = []
      let skipped = 0
      for (const entry of served) {
        if (entry === null || typeof entry !== 'object' || !Number.isFinite(entry.leg)) {
          skipped += 1
          continue
        }
        markers.push(markerFrom(entry))
      }
      const declaredLeg = payload !== null && typeof payload === 'object' ? payload.break_leg : null
      if (Number.isFinite(declaredLeg)) markers.push(declaredLegMarker(declaredLeg))
      markers.sort((left, right) => left.leg - right.leg)
      return { markers, skipped }
    }

    /** The kind word a marker shows, upper case, for a badge or a chart tag. */
    function markerKindLabel(marker) {
      return marker.kind.toUpperCase()
    }

    /**
     * One marker's chart tag: its leg number, and nothing else.
     *
     * The chart label is the JOIN KEY to the register under it, not a summary of
     * it. Drawing the kind's word and the first words of the reason on the chart
     * repeated what the register row below already says in full, and it cost the
     * reader the curve: six joints inside fifty legs stacked into six lanes of
     * prose across the plot. The kind stays visible on the chart as a shape, the
     * leg number says which register row to read, and the register carries the
     * words — which is also what the marker's own tooltip carries.
     */
    function markerTagText(marker) {
      return String(marker.leg)
    }

    /**
     * Everything a marker has to say, for its SVG tooltip.
     *
     * The same three parts the producer's own chart text carries — what it is,
     * what it does to the curve, and where it was read from — so a reader who
     * hovers the marker gets the record's words and not this file's.
     */
    function markerTooltip(marker) {
      const head = `LEG ${marker.leg} — ${markerKindLabel(marker)}`
      const lines = [marker.label === '' ? head : `${head}: ${marker.label}`]
      if (marker.reason !== '') lines.push('', marker.reason)
      if (marker.meaning !== '') {
        lines.push('', `WHAT THIS ${markerKindLabel(marker)} CHANGE DOES TO THE CURVE: ${marker.meaning}.`)
      }
      if (marker.contradiction !== '') lines.push('', `THE LEGS CONTRADICT THIS: ${marker.contradiction}`)
      if (marker.support !== '') lines.push('', `READ FROM: ${marker.support}`)
      if (marker.declaredInCode) {
        lines.push('', "THIS MARKER'S LEG IS A CONSTANT IN THE CODE, not a reading: see the READ FROM "
          + 'line for why no artifact carries it.')
      }
      return lines.join('\n')
    }

    /**
     * The swatch that carries one marker's kind on the chart.
     *
     * Filled shapes rather than outlines, so the colour has something solid to
     * sit in at 7 chart units and the shape still reads when the colour does not.
     * @param shape - a name from MARKER_SHAPES.
     * @param cx - centre x, in chart units.
     * @param cy - centre y, in chart units.
     * @param key - React key.
     * @returns the SVG element for the swatch.
     */
    function markerSwatch(shape, cx, cy, key, className = CLASS.markerSwatch) {
      const radius = MARKER_SWATCH_SIZE / 2
      const common = { key, className }
      const points = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')
      if (shape === 'circle') return React.createElement('circle', { ...common, cx, cy, r: radius })
      if (shape === 'square') {
        return React.createElement('rect', {
          ...common, x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2,
        })
      }
      if (shape === 'diamond') {
        return React.createElement('polygon', { ...common, points: points([
          [cx, cy - radius], [cx + radius, cy], [cx, cy + radius], [cx - radius, cy],
        ]) })
      }
      if (shape === 'triangle') {
        return React.createElement('polygon', { ...common, points: points([
          [cx, cy - radius], [cx + radius, cy + radius], [cx - radius, cy + radius],
        ]) })
      }
      if (shape === 'triangle-down') {
        return React.createElement('polygon', { ...common, points: points([
          [cx - radius, cy - radius], [cx + radius, cy - radius], [cx, cy + radius],
        ]) })
      }
      if (shape === 'plus') {
        const arm = radius / 3
        return React.createElement('polygon', { ...common, points: points([
          [cx - arm, cy - radius], [cx + arm, cy - radius], [cx + arm, cy - arm],
          [cx + radius, cy - arm], [cx + radius, cy + arm], [cx + arm, cy + arm],
          [cx + arm, cy + radius], [cx - arm, cy + radius], [cx - arm, cy + arm],
          [cx - radius, cy + arm], [cx - radius, cy - arm], [cx - arm, cy - arm],
        ]) })
      }
      // The bar: the declared joint, whose kind the snapshot never stated.
      return React.createElement('rect', {
        ...common, x: cx - radius, y: cy - radius / 3, width: radius * 2, height: (radius * 2) / 3,
      })
    }

    /**
     * Where each visible marker's label sits, so no two labels overlap.
     *
     * Labels are placed left to right into the lowest lane whose last label has
     * already ended, which stacks a cluster of markers into a readable cascade
     * instead of drawing six sentences on top of one another. A label near the
     * right edge is placed to the LEFT of its line, because a label that runs
     * off the frame is a label nobody reads.
     *
     * @param markers - markers inside the window, ascending in leg.
     * @param projectX - chart-space x of a leg.
     * @param plot - the frame's own left and right columns.
     * @returns one `{ marker, x, lane, text, anchor }` per marker, in order.
     */
    function layoutMarkerLabels(markers, projectX, plot) {
      const laneEnds = []
      const placed = []
      for (const marker of markers) {
        const x = projectX(marker.leg)
        const text = markerTagText(marker)
        const width = MARKER_SWATCH_SIZE + MARKER_SWATCH_GAP
          + text.length * MARKER_CHAR_WIDTH + MARKER_LABEL_PAD
        const fitsStart = x + width <= plot.right
        const fitsEnd = x - width >= plot.left
        const anchor = fitsStart || !fitsEnd ? 'start' : 'end'
        const span = anchor === 'start'
          ? { lo: x, hi: Math.min(x + width, plot.right) }
          : { lo: Math.max(x - width, plot.left), hi: x }
        let lane = laneEnds.findIndex((end) => end <= span.lo)
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(span.hi) } else { laneEnds[lane] = span.hi }
        placed.push({ marker, x, lane, text, anchor, width })
      }
      return placed
    }

    /** The baseline y of the labels in one lane. */
    function markerLaneY(lane) {
      return CHART.padTop + 9 + lane * MARKER_LANE_HEIGHT
    }

    /**
     * The frontier as this tab reads it: the next expected transition, in the
     * producer's own words plus the numbers the compact line needs.
     *
     * `null` when the snapshot serves none, which is not the same as a frontier
     * with nothing ahead of it: the register says which of the two it is.
     */
    function readFrontier(payload) {
      const raw = payload !== null && typeof payload === 'object' ? payload.frontier : null
      if (raw === null || typeof raw !== 'object') return null
      return {
        phaseNow: markerText(raw.phase_now),
        nextPhase: markerText(raw.next_phase),
        boundaryLeg: Number.isFinite(raw.boundary_leg) ? raw.boundary_leg : null,
        nextLeg: Number.isFinite(raw.next_leg) ? raw.next_leg : null,
        legsInPhase: Number.isFinite(raw.legs_in_phase) ? raw.legs_in_phase : null,
        legsRemaining: Number.isFinite(raw.legs_remaining) ? raw.legs_remaining : null,
        raiseExpected: raw.expected_to_raise_bpb === true,
        imminent: raw.imminent === true,
        sentence: markerText(raw.sentence),
      }
    }

    /**
     * The leg the frontier's dashed line sits on: where the change is expected.
     *
     * One statement of the rule, read by the chart, by the frontier's own line
     * of text and by the register's note about why the line is not on screen.
     * An imminent transition is at the producer's boundary leg — the next leg
     * trained — and a predicted one is at its own projected leg.
     */
    function frontierLeg(frontier) {
      if (frontier === null) return null
      const leg = frontier.imminent
        ? (frontier.boundaryLeg ?? frontier.nextLeg)
        : frontier.nextLeg
      return Number.isFinite(leg) ? leg : null
    }

    /**
     * The frontier's one line, as an EXPECTATION and never as a fact.
     *
     * The leg the producer names is where its own budget says the current
     * corpus runs out, so this reads "expected around leg N"; when the producer
     * says the transition is imminent — the next leg to train is the new corpus
     * — the wording moves to "at leg N", because there is nothing left to
     * predict. A frontier with no corpus after it says exactly that, rather
     * than leaving a leg number with nothing behind it.
     */
    function frontierTagText(frontier) {
      if (frontier === null) return ''
      const named = frontierLeg(frontier)
      if (frontier.imminent && named !== null) {
        return `the corpus changes AT LEG ${named} — the next leg trained is the new one`
      }
      if (frontier.nextPhase === '') return 'no further corpus change is scheduled ahead'
      if (named === null) return `the next corpus change is ${frontier.phaseNow} to ${frontier.nextPhase}, leg not stated`
      const pair = frontier.phaseNow === '' ? frontier.nextPhase : `${frontier.phaseNow} to ${frontier.nextPhase}`
      return `next corpus change expected around leg ${named} · ${pair}`
    }

    /**
     * Why the frontier's leg is a direction and not a measurement.
     *
     * Stated on screen rather than left to the reader, because a predicted leg
     * with no caveat reads as a schedule and a predicted rise reads as a
     * measurement. Both are expectations: the leg comes from a budget divided by
     * one leg's volume, and the direction of the rise is registered from the
     * record — no sealed read exists for a corpus before its first leg, so how
     * far the level moves cannot be told from it.
     */
    const FRONTIER_CAVEAT = 'EXPECTED, NOT OBSERVED: this is where the producer\'s own budget says the '
      + 'current corpus runs out, and its controller may end a visit early. It is a DIRECTION and not a '
      + 'magnitude — whether bits per byte rises at the change is registered from the record, and by how '
      + 'much is not known, because no sealed read exists for a corpus before its first leg.'

    /** Everything the chart and the register need from one snapshot body. */
    function breakView(payload) {
      const read = readBreakMarkers(payload)
      return { markers: read.markers, skipped: read.skipped, frontier: readFrontier(payload) }
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
     *
     * `payload` is the whole snapshot body, so the markers and the frontier come
     * from the SAME read as the series they annotate: taking them from the
     * polled state route instead would let the lines be one revision ahead of
     * the curve they sit on.
     */
    function SeriesChart({ spec, payload }) {
      const points = spec.series.points
      const bounds = React.useMemo(() => fullRange(points), [points])
      const breaks = React.useMemo(() => breakView(payload), [payload])
      // `null` IS the whole run, so "never zoomed" and "reset" are one state and
      // the readout cannot disagree with the picture. A window the reader left
      // is restored on the next mount, per series, for the same reason the series
      // choice is: this component is remounted by the pane, not by the reader.
      const [view, setView] = React.useState(() => rememberedWindow(spec.tag))
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

      /**
       * Show a window, clamped; the whole run collapses back to the null state.
       *
       * The settled window is remembered per series before it is applied, so a
       * remount comes back to the same place. `Reset` forgets it, which is what
       * makes reset and "never zoomed" the same state.
       */
      const showWindow = React.useCallback((next) => {
        const settled = next === null ? null : clampRange(next, bounds)
        const applied = settled === null
          || (settled.lo <= bounds.lo && settled.hi >= bounds.hi) ? null : settled
        rememberWindow(spec.tag, applied)
        setView(applied)
      }, [bounds, spec.tag])

      const zoomBy = React.useCallback((factor, anchor) => {
        showWindow(zoomRange(range, factor, anchor))
      }, [range, showWindow])

      // `zoomRange` multiplies the window's SPAN by the factor, so a factor below
      // one narrows and a factor above one widens. Naming the two directions is
      // not decoration: the buttons and the keys were wired the other way round,
      // so `+` widened and `-` narrowed. Reported by the end-to-end check, not by
      // the unit tests, which is why the check presses every control.
      const zoomIn = (anchor) => zoomBy(ZOOM_FACTOR, anchor)
      const zoomOut = (anchor) => zoomBy(1 / ZOOM_FACTOR, anchor)

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
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomIn(centre) }
        else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomOut(centre) }
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

      // The break markers: on the chart itself, because a joint that is only
      // explained in a footnote is a joint the reader will fit across. Each one
      // is a vertical line labelled with its leg, its KIND and the first words of
      // its own reason, and the register under the chart carries the rest.
      //
      // LINES FIRST, THEN LABELS, in two passes over one placement list. A label
      // sits on an opaque chip, and a line drawn after that chip would be drawn
      // across the text: with the cluster this run has — six joints inside fifty
      // legs — that is the common case and not the corner. The whole group is
      // clipped to the plot, so a label near the right edge cannot draw outside
      // the frame where nobody would read it.
      const visibleMarkers = breaks.markers.filter(
        (marker) => marker.leg >= range.lo && marker.leg <= range.hi)
      const markerLayout = layoutMarkerLabels(visibleMarkers, projectX, plot)
      for (const [index, entry] of markerLayout.entries()) {
        const { marker } = entry
        children.push(React.createElement('g', {
          key: `marker-${marker.leg}-${index}`,
          className: CLASS.marker,
          'data-kind': marker.kind,
          'data-leg': String(marker.leg),
          'data-declared': marker.declared ? 'true' : 'false',
          clipPath: `url(#${CLIP_ID})`,
        },
        React.createElement('line', {
          x1: entry.x, x2: entry.x, y1: CHART.padTop, y2: CHART.padTop + innerHeight,
        }),
        React.createElement('title', null, markerTooltip(marker))))
      }

      // The frontier, drawn as an expectation and not as a fact: a dashed line in
      // the label colour rather than a kind's colour, in a lane of its own, and
      // labelled with the word "expected".
      const expectedLeg = frontierLeg(breaks.frontier)
      const frontierInWindow = expectedLeg !== null && expectedLeg >= range.lo && expectedLeg <= range.hi
      if (frontierInWindow) {
        children.push(React.createElement('g', {
          key: 'frontier', className: CLASS.frontierMark,
          'data-expectation': 'true', 'data-leg': String(expectedLeg),
          clipPath: `url(#${CLIP_ID})`,
        },
        React.createElement('line', {
          x1: projectX(expectedLeg), x2: projectX(expectedLeg),
          y1: CHART.padTop, y2: CHART.padTop + innerHeight,
        }),
        React.createElement('title', null,
          breaks.frontier.sentence === '' ? frontierTagText(breaks.frontier) : breaks.frontier.sentence)))
      }

      // The labels, over every line: one chip per marker, so the text is never
      // crossed by a line, and the frontier's own label in the lane below them.
      const frontierLane = markerLayout.length === 0
        ? 0 : Math.max(...markerLayout.map((entry) => entry.lane)) + 1
      for (const [index, entry] of markerLayout.entries()) {
        const { marker } = entry
        const haloX = entry.anchor === 'start' ? entry.x : entry.x - entry.width
        const labelY = markerLaneY(entry.lane)
        children.push(React.createElement('g', {
          key: `markerlabel-${marker.leg}-${index}`,
          className: CLASS.markerLabel,
          'data-kind': marker.kind,
          'data-leg': String(marker.leg),
          clipPath: `url(#${CLIP_ID})`,
        },
        React.createElement('rect', {
          className: CLASS.markerHalo,
          x: haloX, y: labelY - 9, width: entry.width, height: 11,
        }),
        markerSwatch(markerShape(marker.kind), haloX + MARKER_SWATCH_SIZE / 2, labelY - 3, 'swatch'),
        React.createElement('text', {
          x: haloX + MARKER_SWATCH_SIZE + MARKER_SWATCH_GAP, y: labelY,
        },
        React.createElement('tspan', { className: CLASS.markerLegText }, String(marker.leg)))))
      }
      if (frontierInWindow) {
        const x = projectX(expectedLeg)
        const text = String(expectedLeg)
        const width = MARKER_SWATCH_SIZE + MARKER_SWATCH_GAP
          + text.length * MARKER_CHAR_WIDTH + MARKER_LABEL_PAD
        const haloX = x + width <= CHART.width - CHART.padRight ? x : x - width
        children.push(React.createElement('g', {
          key: 'frontierlabel', className: CLASS.markerLabel,
          'data-kind': 'frontier', 'data-leg': String(expectedLeg),
          'data-expectation': 'true', clipPath: `url(#${CLIP_ID})`,
        },
        React.createElement('rect', {
          className: CLASS.markerHalo, x: haloX, y: markerLaneY(frontierLane) - 9, width, height: 11,
        }),
        // The one UNFILLED swatch: an expectation is not a joint read from an
        // artifact. Its sentence, and the caveat that its leg is a direction, are
        // in the register under a heading that says both.
        markerSwatch('diamond', haloX + MARKER_SWATCH_SIZE / 2, markerLaneY(frontierLane) - 3,
          'frontier-swatch', CLASS.frontierSwatch),
        React.createElement('text', {
          className: CLASS.frontierLabel,
          x: haloX + MARKER_SWATCH_SIZE + MARKER_SWATCH_GAP, y: markerLaneY(frontierLane),
        }, text)))
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
          onClick: () => { zoomOut((range.lo + range.hi) / 2) },
        }, '−'),
        React.createElement('button', {
          type: 'button', className: CLASS.windowButton, disabled: atFloor,
          title: 'Zoom in ( + )', 'aria-label': 'Zoom in',
          onClick: () => { zoomIn((range.lo + range.hi) / 2) },
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
        // The markers are part of what the picture says, so they are part of
        // what its accessible name says: a screen reader gets the count.
        'aria-label': `${spec.label}. ${rangeLabel(range, bounds)}. `
          + `${inside.length} of ${points.length} points in view. `
          + `${visibleMarkers.length} of ${breaks.markers.length} break markers in this window.`,
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
      // Every marker gets a tick on the strip as well, so the joints are visible
      // on the whole run even when the reader has zoomed somewhere else.
      const overviewMarks = points.length < 2 ? [] : breaks.markers
        .filter((marker) => marker.leg >= bounds.lo && marker.leg <= bounds.hi)
        .map((marker, index) => React.createElement('line', {
          key: `ovmark-${marker.leg}-${index}`,
          className: CLASS.markerTick,
          'data-kind': marker.kind,
          'data-leg': String(marker.leg),
          x1: projectOverviewX(marker.leg), x2: projectOverviewX(marker.leg),
          y1: OVERVIEW.padTop, y2: OVERVIEW.padTop + overviewHeight,
        }))
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
      ...overviewMarks,
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

      return React.createElement(React.Fragment, null,
        windowRow, chart, overview, breakRegister(breaks, { range, bounds }))
    }

    /** The kinds present in a marker list, in the registered order, unknown last. */
    function kindsPresent(markers) {
      const present = []
      for (const kind of KIND_ORDER) {
        if (markers.some((marker) => marker.kind === kind)) present.push(kind)
      }
      for (const marker of markers) {
        if (!present.includes(marker.kind)) present.push(marker.kind)
      }
      return present
    }

    /**
     * One marker's row in the register: what it is, what it does to the curve,
     * where it was read from, and any contradiction the producer attached.
     *
     * EVERY SENTENCE HERE IS THE PRODUCER'S. The kind's meaning is served as
     * `meaning`, the reason as `reason`, the evidence as `support`, and the
     * warning about a leg that is a constant in code is the producer's own. The
     * two views therefore cannot disagree: this one has no words of its own to
     * disagree with. The only text this half writes is the one row for the
     * snapshot's `break_leg`, which carries no kind for anyone to quote.
     */
    function breakRow(marker, index) {
      const kindLabel = markerKindLabel(marker)
      const headline = marker.declared
        ? "declared by the snapshot's own break_leg"
        : marker.label
      const reason = marker.declared
        ? 'This joint comes from `break_leg`, which names a leg and no kind. This tab therefore claims '
          + 'none: it cannot tell from `break_leg` alone whether the data, the reading, the arithmetic, '
          + "the leg's shape or the process changed here, and a guess would put a kind on the chart that "
          + 'the snapshot never stated.'
        : marker.reason
      const parts = [
        React.createElement('div', { key: 'head', className: CLASS.breakRowHead },
          React.createElement('span', { className: CLASS.swatch, 'data-kind': marker.kind }),
          React.createElement('span', { className: CLASS.breakBadge }, kindLabel),
          React.createElement('span', { className: CLASS.breakLegText }, `LEG ${marker.leg}`),
          headline === '' ? null : React.createElement('span', { className: CLASS.breakWhat }, headline)),
      ]
      if (reason !== '') {
        parts.push(React.createElement('div', { key: 'reason', className: CLASS.breakReason }, reason))
      }
      if (marker.meaning !== '') {
        parts.push(React.createElement('div', { key: 'meaning', className: CLASS.breakMeaning },
          `WHAT THIS ${kindLabel} CHANGE DOES TO THE CURVE: ${marker.meaning}.`))
      }
      if (marker.contradiction !== '') {
        parts.push(React.createElement('div', { key: 'contradiction', className: CLASS.breakContradiction },
          `THE LEGS CONTRADICT THIS: ${marker.contradiction}`))
      }
      if (marker.support !== '') {
        parts.push(React.createElement('div', { key: 'support', className: CLASS.breakSupport },
          `READ FROM: ${marker.support}`))
      }
      if (marker.declaredInCode) {
        parts.push(React.createElement('div', { key: 'declared', className: CLASS.breaksNote },
          "THIS MARKER'S LEG IS A CONSTANT IN THE CODE, not a reading: see the READ FROM line for why "
          + 'no artifact carries it.'))
      }
      return React.createElement('div', {
        key: `row-${marker.leg}-${marker.kind}-${index}`,
        className: CLASS.breakRow,
        'data-kind': marker.kind,
        'data-leg': String(marker.leg),
        'data-declared': marker.declared ? 'true' : 'false',
      }, ...parts)
    }

    /**
     * The frontier block: the producer's own sentence, under this tab's caveat.
     *
     * The dashed line can only be drawn when the expected leg is on the axis on
     * screen, which on a live run it usually is not — the transition is AHEAD of
     * the last point. A block that showed the number and no line, and said
     * nothing about the missing line, would leave a reader hunting for a marker
     * that is not there, so the absence is stated with its reason.
     */
    function frontierBlock(frontier, chart) {
      if (frontier === null) return null
      const head = frontierTagText(frontier)
        + (frontier.raiseExpected ? ' · a rise in bits per byte is EXPECTED there' : '')
      const parts = [
        React.createElement('div', { key: 'title', className: CLASS.frontierTitle },
          'Frontier — the next corpus change, as an expectation'),
        React.createElement('div', { key: 'head', className: CLASS.frontierHead }, head),
      ]
      if (frontier.sentence !== '') {
        parts.push(React.createElement('div', { key: 'sentence', className: CLASS.frontierSentence },
          frontier.sentence))
      }
      const expectedLeg = frontierLeg(frontier)
      if (chart !== undefined && expectedLeg !== null) {
        if (expectedLeg > chart.bounds.hi) {
          parts.push(React.createElement('div', { key: 'absence', className: CLASS.frontierCaveat },
            `Its dashed line is not on the chart yet: leg ${expectedLeg} is past the last point of the `
            + `series on screen (leg ${Math.round(chart.bounds.hi)}). The line appears when the axis `
            + 'reaches it.'))
        } else if (expectedLeg < chart.range.lo || expectedLeg > chart.range.hi) {
          parts.push(React.createElement('div', { key: 'absence', className: CLASS.frontierCaveat },
            `Its dashed line is outside the window on screen (leg ${expectedLeg}); press Reset to see `
            + 'the whole run.'))
        }
      }
      parts.push(React.createElement('div', { key: 'caveat', className: CLASS.frontierCaveat },
        FRONTIER_CAVEAT))
      return React.createElement('div', {
        className: CLASS.frontier, 'data-expectation': 'true',
      }, ...parts)
    }

    /**
     * The register under the chart: every marker, readable, whether or not it is
     * in the window the reader is looking at.
     *
     * The chart can only carry a few words per marker, and a marker scrolled out
     * of the window carries none. This is where they all read in full, and it is
     * deliberately BELOW the chart rather than beside it: a joint explained in a
     * tooltip alone is a joint the reader has to already suspect in order to
     * find.
     *
     * @param breaks - `breakView(payload)`.
     * @param chart - `{ range, bounds }` of the chart this register sits under.
     * @returns the block, or null when the snapshot serves no markers and no
     *   frontier — an empty box would be chrome.
     */
    function breakRegister(breaks, chart) {
      const frontier = breaks.frontier
      if (breaks.markers.length === 0 && frontier === null && breaks.skipped === 0) return null
      const visible = chart === undefined ? breaks.markers.length
        : breaks.markers.filter((marker) => marker.leg >= chart.range.lo && marker.leg <= chart.range.hi).length
      const parts = []
      parts.push(React.createElement('div', { key: 'head', className: CLASS.breaksHead },
        React.createElement('span', null, 'Break markers'),
        React.createElement('span', { className: CLASS.breaksNote },
          `${breaks.markers.length} in the snapshot · ${visible} in this window`
          + (breaks.markers.length > 0 ? ' · drag on the chart to zoom to one' : ''))))
      if (breaks.markers.length > 0) {
        parts.push(React.createElement('div', { key: 'key', className: CLASS.breaksKey },
          ...kindsPresent(breaks.markers).map((kind) => React.createElement('span', {
            key: `key-${kind}`, className: CLASS.keyItem,
          },
          React.createElement('span', { className: CLASS.swatch, 'data-kind': kind }),
          kind.toUpperCase()))))
      }
      if (breaks.skipped > 0) {
        parts.push(React.createElement('div', { key: 'skipped', className: CLASS.breakContradiction },
          `${breaks.skipped} marker(s) in this snapshot carry no readable leg, so they cannot be placed `
          + 'on the axis and are not drawn. The rest of the list is unaffected.'))
      }
      for (const [index, marker] of breaks.markers.entries()) {
        parts.push(breakRow(marker, index))
      }
      const block = frontierBlock(frontier, chart)
      if (block !== null) parts.push(React.createElement('div', { key: 'frontier' }, block))
      return React.createElement('div', { className: CLASS.breaks }, ...parts)
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
    function Panel({ sessionId } = {}) {
      const [state, setState] = React.useState(null)
      const [payload, setPayload] = React.useState(null)
      // The reader's choice is restored rather than defaulted, because this
      // component is remounted by the pane on events the reader did not cause.
      const [chosen, setChosen] = React.useState(() => rememberedSeries(sessionId))
      const [failure, setFailure] = React.useState(null)
      const revisionRef = React.useRef(null)

      React.useEffect(() => { rememberSeries(sessionId, chosen) }, [sessionId, chosen])

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
      const selection = React.useMemo(() => resolveSelection(offered, chosen), [offered, chosen])
      const activeSpec = selection.spec
      const { primary, more } = React.useMemo(() => splitOffered(offered), [offered])
      const [showMore, setShowMore] = React.useState(false)
      const moreOpen = showMore || disclosureForced(chosen, more)

      const age = describeAge(state)
      const headline = headlineReading(payload)
      const latestReading = headline === null ? null : headline.point
      const headlineTag = headline === null ? null : headline.tag
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
          value: latestReading === null ? '—' : String(Math.round(latestReading[0])),
        }),
        React.createElement(Kpi, {
          label: seriesLabel(headlineTag),
          value: latestReading === null ? '—' : formatValue(latestReading[1], 4),
          title: headlineTag === null
            ? 'no held-out reading in this snapshot'
            : `${headlineTag}, the held-out reading the run is steered by`,
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

      // A series the reader chose that this revision does not carry keeps its
      // chip, marked and explained, so the selection stays visible instead of
      // silently becoming a different curve.
      const missingChip = selection.missing
        ? [React.createElement('button', {
          key: `missing:${chosen}`, type: 'button', className: CLASS.chip,
          'data-on': 'true', 'data-missing': 'true',
          title: `${chosen} is not in the snapshot being read now`,
          onClick: () => setChosen(null),
        }, `${chosen} · not in this snapshot`)]
        : []

      /**
       * One chip. `data-on` marks the charted series, so the disclosure does not
       * hide which one is on screen.
       */
      const chipFor = (item) => React.createElement('button', {
        key: item.tag, type: 'button', className: CLASS.chip,
        'data-on': activeSpec !== null && activeSpec.tag === item.tag ? 'true' : 'false',
        onClick: () => setChosen(item.tag),
        title: item.series.source ? `${item.tag} — ${item.series.source}` : item.tag,
      }, item.label)

      // The leads are the chips; everything else is one click away. The snapshot
      // carries sixty series, and a chip for every one of them is a wall of
      // controls over a chart that draws one curve.
      const moreChip = more.length === 0 ? null : React.createElement('button', {
        key: 'more-series', type: 'button', className: CLASS.moreChip,
        'data-open': moreOpen ? 'true' : 'false',
        'aria-expanded': moreOpen ? 'true' : 'false',
        onClick: () => setShowMore((open) => !open),
        title: moreOpen ? 'Hide the other series this snapshot carries' : 'Show every series this snapshot carries',
      }, moreOpen ? 'fewer series' : `${more.length} more series`)

      const chips = offered.length === 0 && missingChip.length === 0 ? null
        : React.createElement('div', { className: CLASS.chips },
          ...missingChip,
          ...primary.map(chipFor),
          moreChip,
          ...(moreOpen ? more.map(chipFor) : []))

      const chart = activeSpec === null
        ? (selection.missing
          ? React.createElement('div', { className: CLASS.notice },
            React.createElement('div', { className: CLASS.noticeTitle }, 'That series is not in this snapshot'),
            React.createElement('div', { className: CLASS.noticeBody },
              `${chosen} is still the series you chose, and the snapshot being read now does not carry it. `
              + 'That usually means the log or file it is derived from was rotated or pruned for this '
              + 'revision, so the next one may have it back. Pick another series above, or click it again '
              + 'to go back to the default.'))
          : null)
        : React.createElement('div', { className: CLASS.chartWrap },
          // The whole snapshot body goes in, so the break markers and the
          // frontier are read from the SAME snapshot as the curve under them.
          React.createElement(SeriesChart, { spec: activeSpec, payload }),
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
      ctx.effect(() => ctx.slots.inject(TRIGGER_SLOT, () => ctx.slots.register({
        name: TRIGGER_SLOT,
        id: 'train-dashboard-trigger',
        order: 55,
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
      resolveSelection,
      splitOffered,
      disclosureForced,
      headlineReading,
      seriesLabel,
      HEADLINE_TAGS,
      INTERESTING,
      markerShape,
      MARKER_SHAPES,
      markerTagText,
      rememberedSeries,
      rememberSeries,
      rememberedWindow,
      rememberWindow,
      plotGeometry,
      clampChartPixel,
      valueAt,
      brushRange,
      rangeLabel,
      breakView,
      readBreakMarkers,
      readFrontier,
      markerKindWord,
      markerKindLabel,
      markerTagText,
      markerTooltip,
      clipWords,
      layoutMarkerLabels,
      markerLaneY,
      frontierTagText,
      frontierLeg,
      FRONTIER_CAVEAT,
      KIND_ORDER,
      UNKNOWN_KIND,
      DECLARED_KIND,
      MARKER_LABEL_CHARS,
      MARKER_CHAR_WIDTH,
      MARKER_LABEL_PAD,
      MARKER_LANE_HEIGHT,
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
      breakRegister,
      breakRow,
      frontierBlock,
    }
    return module.exports
  },
})
