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
      // The disclosure that keeps a register row one readable line. The prose a
      // row carries (why the joint is there, what the kind does to the curve,
      // where it was read from) is real and belongs on screen - behind a control
      // the reader opens, not laid out under every joint as a wall.
      why: 'dshtd-why',
      whySummary: 'dshtd-why-summary',
      whyBody: 'dshtd-why-body',
      line: 'dshtd-line',
      dot: 'dshtd-dot',
  familyLine: 'dshtd-family-line',
  familyLineSparse: 'dshtd-family-line-sparse',
      // The chain a rollback discarded, drawn dimmed and dashed on the SAME axis:
      // see `rollbackPoint`.
      ghostLine: 'dshtd-ghost-line',
      ghostOverlay: 'dshtd-ghost-overlay',
      ghostSwatch: 'dshtd-ghost-swatch',
      overlayLine: 'dshtd-overlay-line',
      overlayDot: 'dshtd-overlay-dot',
      overlayGridline: 'dshtd-overlay-gridline',
      overlayAxis: 'dshtd-overlay-axis',
      overlayLegend: 'dshtd-overlay-legend',
      overlaySwatch: 'dshtd-overlay-swatch',
      overlayChip: 'dshtd-overlay-chip',
      currentValue: 'dshtd-current',
      currentRail: 'dshtd-current-rail',
      currentPrimary: 'dshtd-current-primary',
      currentOverlay: 'dshtd-current-overlay',
      hint: 'dshtd-hint',
      toggle: 'dshtd-toggle',
      toggleIcon: 'dshtd-toggle-icon',
      toggleOff: 'dshtd-toggle-off',
      windowRow: 'dshtd-window-row',
      windowButton: 'dshtd-window-button',
      windowReadout: 'dshtd-window-readout',
      windowNote: 'dshtd-window-note',
      //: The rail: the value axis' own overview, standing to the left of the frame, with the window
      //: drawn on it and a brush while the reader drags.
      rail: 'dshtd-rail',
      railFrame: 'dshtd-rail-frame',
      railWindow: 'dshtd-rail-window',
      railBrush: 'dshtd-rail-brush',
      brush: 'dshtd-brush',
      brushEdge: 'dshtd-brush-edge',
      overview: 'dshtd-overview',
      overviewLine: 'dshtd-overview-line',
      // The older pass on the strip under the chart. Its own class and not the
      // chart's ghost class: the strip is a second view of the same values, and a
      // reader counting ghosts means the ones on the chart.
      overviewOlder: 'dshtd-overview-older',
      overviewWindow: 'dshtd-overview-window',
      empty: 'dshtd-empty',
      //: A series taken on a cadence rather than every leg, drawn as its readings: see SPARSE_COVERAGE.
      readingsLine: 'dshtd-readings-line',
      notice: 'dshtd-notice',
      noticeTitle: 'dshtd-notice-title',
      noticeBody: 'dshtd-notice-body',
      // The degraded-snapshot notice: the same notice box, shrunk to one line, naming the families the
      // producer could not read. See `faultNotice`.
      faults: 'dshtd-faults',
      code: 'dshtd-code',
      legend: 'dshtd-legend',
      legendItem: 'dshtd-legend-item',
      legendSwatch: 'dshtd-legend-swatch',
      footnote: 'dshtd-footnote',
    }

    /**
     * THE GEOMETRY LIVES HERE, ABOVE THE STYLESHEET, AND THAT PLACEMENT IS LOAD-BEARING.
     *
     * These were declared eight hundred lines further down, beside the rest of the chart's constants,
     * which is the natural home for them. The sheet could not read them there: `const CSS` is a
     * TEMPLATE LITERAL evaluated where it stands, and a constant declared after it is in its temporal
     * dead zone - interpolating one threw "Cannot access 'RAIL' before initialization" the moment the
     * bundle loaded. The first fix was to write the numbers into the sheet as literals, which then
     * needed a comment promising a test would keep them in step; moving the declarations is the fix
     * that needs no promise, because there is only one number.
     *
     * The rail's own size is the case that made this matter: a sheet that cannot read RAIL's width had
     * to hardcode it, and the hardcoded width is what the rail is DRAWN at.
     */

    /**
     * The room the LEFT margin needs, in chart units.
     *
     * Four columns share it, from the far edge inward: the axis' rotated unit
     * title, the floating CURRENT VALUE of each line (its text, then its rail),
     * and the primary axis' tick labels against the plot. The reading has a
     * column of its own rather than a row in the numbers' column, because on the
     * right it shared theirs and the two were mistaken for one another.
     *
     * Measured at this frame's own font: the title takes 16, the reading's text
     * up to about 44 ending at the rail, the rail 2 more, and a five-character
     * tick label 28 against the plot. The rest is the gaps, which are what stop
     * the numbers and the readings reading as one column of figures.
     */
    const PAD_LEFT = 130

    /**
     * The frame, and the strip under it.
     *
     * `padLeft` is `PAD_LEFT` and not a literal, because the left margin's width
     * is decided by the four columns that share it - see PAD_LEFT - and two
     * numbers for one margin is how they drift apart.
     */
    const CHART = { width: 720, height: 240, padLeft: PAD_LEFT, padRight: 14, padTop: 12, padBottom: 26 }
    /** The strip under the chart: one overview of the whole run and the window on it. */
    const OVERVIEW = { height: 30, padTop: 4, padBottom: 4 }
    /**
     * The RAIL: the value axis' own overview, standing to the LEFT of the frame.
     *
     * THE VERTICAL AXIS GETS THE HORIZONTAL AXIS' OVERVIEW RATHER THAN A BUTTON PER DIRECTION, which is
     * the user's correction of 11 October 2026: "instead of having +y -y buttons just show a vertical
     * window to the left of the graph that I can drag-select exactly like the x-axis zoom feature".
     * The strip below the chart is the pattern and this is it turned on its side - the whole extent with
     * the window drawn on it, click to move and drag to select - so a reader who has used one has used
     * the other.
     *
     * `gap` is the space between the rail and the y axis' tick labels; without it the rail butts against
     * the labels and the two read as one column of marks.
     *
     * `height` is `CHART.height` because the rail stands BESIDE the frame and the two must be the same
     * height for a value to be read across a level line from one to the other.
     */
    const RAIL = { width: 26, height: CHART.height, padLeft: 3, padRight: 3, gap: 6 }

    const CSS = `
/* ==========================================================================
   THE PLUGIN'S OWN COLOUR TOKENS, AND WHY THEY ARE SCOPED TO THE PANEL.

   MEASURED, 16 October 2026, and this is the defect the block exists for: every fallback in this sheet was
   a DARK-THEME value - #1d1d1d for a surface, #f0f0f0 for a label, #111 for the deepest layer - and the
   plugin read no theme mode at all. **A fallback is what a token resolves to WHEN THE HOST DOES NOT DEFINE
   IT**, and that is not hypothetical here: this session has already watched
   \`--dsw-alias-brand-primary\` fail to resolve and draw a chart line in the browser's default stroke. In
   light mode with absent tokens the plugin rendered a near-black panel with near-white text on it: legible
   by luck in the theme it was written in, and wrong in the other.

   SO EVERY COLOUR THE PLUGIN OWNS IS DECLARED TWICE, and the two declarations are the dark and light values
   of the same name. \`prefers-color-scheme\` chooses between them, and the panel's \`data-mode\` attribute
   overrides it - see \`themeMode\` and \`THEME_ATTRIBUTE\`, which let a reader pin the mode rather than
   following the operating system.

   SCOPED TO \`.\${CLASS.panel}\` AND NOT TO \`:root\`, deliberately: a plugin that writes custom properties onto
   the document root is writing into a page it does not own. The trigger button is a SEPARATE root - it is
   mounted into the session header's action row, not into the panel - so it takes its colours from the host's
   tokens alone and declares none of its own.
   ========================================================================== */
.${CLASS.panel} {
  --dshtd-ink-train: #8AB4F8;
  --dshtd-ink-overlay: #d9a441;
  --dshtd-ink-history: #8E9BAE;
  --dshtd-ink-heldout: #F48FB1;
  --dshtd-ink-sealed: #80DEEA;
  --dshtd-ink-corpus-0: #81C995;
  --dshtd-ink-corpus-1: #C58AF9;
  --dshtd-ink-corpus-2: #FDD663;
  --dshtd-ink-corpus-3: #4aa3d9;
  --dshtd-ink-corpus-4: #d95fa8;
  --dshtd-ink-corpus-5: #8a86c8;
  /* AND THE SURFACES, so a host that defines none of its own still gets a readable panel. */
  --dshtd-surface: var(--dsw-alias-bg-layer-1, #1d1d1d);
  --dshtd-surface-raised: var(--dsw-alias-bg-layer-2, #262626);
  --dshtd-line: var(--dsw-alias-border-l1, #2e2e2e);
  --dshtd-text: var(--dsw-alias-label-primary, #f0f0f0);
  --dshtd-text-dim: var(--dsw-alias-label-secondary, #b0b0b0);
  --dshtd-text-faint: var(--dsw-alias-label-tertiary, #8a8a8a);
}
/* THE LIGHT VALUES. The inks are DARKER and more saturated rather than merely different: a #4d6bfe line on
   a white card is legible, and the SAME hue at the same weight is what keeps the legend swatch matching the
   line - see \`lineDress\`, which is the one place a line's ink is decided. The corpus palette is re-picked
   rather than reused for the same reason: #2f9e6f and #a855c8 are tuned against a dark surface and go
   muddy, not invisible, on a light one, which is the worse failure because it looks deliberate. */
@media (prefers-color-scheme: light) {
  .${CLASS.panel} {
    --dshtd-ink-train: #1A73E8;
    --dshtd-ink-overlay: #9a6f14;
    --dshtd-ink-history: #5A6478;
    --dshtd-ink-heldout: #AD1457;
    --dshtd-ink-sealed: #00838F;
    --dshtd-ink-corpus-0: #137333;
    --dshtd-ink-corpus-1: #9334E6;
    --dshtd-ink-corpus-2: #E37400;
    --dshtd-ink-corpus-3: #1f6f9c;
    --dshtd-ink-corpus-4: #a83878;
  --dshtd-ink-corpus-5: #6f6bb0;
    --dshtd-surface: var(--dsw-alias-bg-layer-1, #ffffff);
    --dshtd-surface-raised: var(--dsw-alias-bg-layer-2, #f5f5f5);
    --dshtd-line: var(--dsw-alias-border-l1, #d8d8d8);
    --dshtd-text: var(--dsw-alias-label-primary, #1a1a1a);
    --dshtd-text-dim: var(--dsw-alias-label-secondary, #4a4a4a);
    --dshtd-text-faint: var(--dsw-alias-label-tertiary, #6b6b6b);
  }
}
/* AND AN EXPLICIT PIN WINS OVER THE OPERATING SYSTEM, in both directions. A reader who asks for dark on a
   light desktop must get dark, which is why these come AFTER the media query and carry the same specificity
   on a more specific selector. */
.${CLASS.panel}[data-mode='dark'] {
  --dshtd-ink-train: #8AB4F8;
  --dshtd-ink-overlay: #d9a441;
  --dshtd-ink-history: #8E9BAE;
  --dshtd-ink-heldout: #F48FB1;
  --dshtd-ink-sealed: #80DEEA;
  --dshtd-ink-corpus-0: #81C995;
  --dshtd-ink-corpus-1: #C58AF9;
  --dshtd-ink-corpus-2: #FDD663;
  --dshtd-ink-corpus-3: #4aa3d9;
  --dshtd-ink-corpus-4: #d95fa8;
  --dshtd-ink-corpus-5: #8a86c8;
  --dshtd-surface: var(--dsw-alias-bg-layer-1, #1d1d1d);
  --dshtd-surface-raised: var(--dsw-alias-bg-layer-2, #262626);
  --dshtd-line: var(--dsw-alias-border-l1, #2e2e2e);
  --dshtd-text: var(--dsw-alias-label-primary, #f0f0f0);
  --dshtd-text-dim: var(--dsw-alias-label-secondary, #b0b0b0);
  --dshtd-text-faint: var(--dsw-alias-label-tertiary, #8a8a8a);
}
.${CLASS.panel}[data-mode='light'] {
  --dshtd-ink-train: #1A73E8;
  --dshtd-ink-overlay: #9a6f14;
  --dshtd-ink-history: #5A6478;
    --dshtd-ink-heldout: #AD1457;
    --dshtd-ink-sealed: #00838F;
  --dshtd-ink-corpus-0: #137333;
  --dshtd-ink-corpus-1: #9334E6;
  --dshtd-ink-corpus-2: #E37400;
  --dshtd-ink-corpus-3: #1f6f9c;
  --dshtd-ink-corpus-4: #a83878;
  --dshtd-ink-corpus-5: #6f6bb0;
  --dshtd-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --dshtd-surface-raised: var(--dsw-alias-bg-layer-2, #f5f5f5);
  --dshtd-line: var(--dsw-alias-border-l1, #d8d8d8);
  --dshtd-text: var(--dsw-alias-label-primary, #1a1a1a);
  --dshtd-text-dim: var(--dsw-alias-label-secondary, #4a4a4a);
  --dshtd-text-faint: var(--dsw-alias-label-tertiary, #6b6b6b);
}
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
.${CLASS.marker}[data-kind='corpus'], .${CLASS.markerLabel}[data-kind='corpus'], .${CLASS.breakRow}[data-kind='corpus'], .${CLASS.swatch}[data-kind='corpus'], .${CLASS.toggle}[data-kind='corpus'] { --dshtd-kind: #3fa06b; }
.${CLASS.marker}[data-kind='instrument'], .${CLASS.markerLabel}[data-kind='instrument'], .${CLASS.breakRow}[data-kind='instrument'], .${CLASS.swatch}[data-kind='instrument'], .${CLASS.toggle}[data-kind='instrument'] { --dshtd-kind: #8f7ff0; }
.${CLASS.marker}[data-kind='arithmetic'], .${CLASS.markerLabel}[data-kind='arithmetic'], .${CLASS.breakRow}[data-kind='arithmetic'], .${CLASS.swatch}[data-kind='arithmetic'], .${CLASS.toggle}[data-kind='arithmetic'] { --dshtd-kind: #e05252; }
.${CLASS.marker}[data-kind='shape'], .${CLASS.markerLabel}[data-kind='shape'], .${CLASS.breakRow}[data-kind='shape'], .${CLASS.swatch}[data-kind='shape'], .${CLASS.toggle}[data-kind='shape'] { --dshtd-kind: #e0a13f; }
.${CLASS.marker}[data-kind='restart'], .${CLASS.markerLabel}[data-kind='restart'], .${CLASS.breakRow}[data-kind='restart'], .${CLASS.swatch}[data-kind='restart'], .${CLASS.toggle}[data-kind='restart'] { --dshtd-kind: #5aa9e6; }
.${CLASS.marker}[data-kind='rollback'], .${CLASS.markerLabel}[data-kind='rollback'], .${CLASS.breakRow}[data-kind='rollback'], .${CLASS.swatch}[data-kind='rollback'], .${CLASS.toggle}[data-kind='rollback'] { --dshtd-kind: #d1567e; }
.${CLASS.marker}[data-kind='growth'], .${CLASS.markerLabel}[data-kind='growth'], .${CLASS.breakRow}[data-kind='growth'], .${CLASS.swatch}[data-kind='growth'], .${CLASS.toggle}[data-kind='growth'] { --dshtd-kind: #2ec4b6; }
.${CLASS.marker}[data-kind='break'], .${CLASS.markerLabel}[data-kind='break'], .${CLASS.breakRow}[data-kind='break'], .${CLASS.swatch}[data-kind='break'], .${CLASS.toggle}[data-kind='break'],
.${CLASS.marker}[data-kind='unknown'], .${CLASS.markerLabel}[data-kind='unknown'], .${CLASS.breakRow}[data-kind='unknown'], .${CLASS.swatch}[data-kind='unknown'], .${CLASS.toggle}[data-kind='unknown'] { --dshtd-kind: #9aa0a6; }
.${CLASS.marker}, .${CLASS.markerLabel}, .${CLASS.breakRow}, .${CLASS.swatch}, .${CLASS.toggle} { --dshtd-kind: #9aa0a6; }
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
.${CLASS.swatch}[data-kind='rollback'] { clip-path: polygon(100% 0, 0 50%, 100% 100%, 67% 100%, 33% 50%, 67% 0); }
/* The rollback chevron turned on its side, which is chevron-up in MARKER_SHAPES
   and the same six points as the SVG there: the register's key and the chart's
   mark have to be one shape or the reader cannot decode a marker from the key.
   Its ink is the teal above, and MISSING UNTIL 13 OCTOBER 2026 - the kind was
   added to MARKER_SHAPES and KIND_INK and to neither rule here, so a growth's
   swatch fell to the sheet's grey fallback while the element carried its own
   colour, and no rule meant the key drew no shape at all. */
.${CLASS.swatch}[data-kind='growth'] { clip-path: polygon(50% 0, 100% 100%, 67% 100%, 50% 33%, 33% 100%, 0 100%); }
.${CLASS.swatch}[data-kind='break'] { clip-path: inset(35% 0 35% 0); }
.${CLASS.swatch}[data-kind='unknown'] {
  clip-path: polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%,
    35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%);
}
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
/* THE ONE CONTROL THAT KEEPS THE REGISTER READABLE. A row states its leg, its
   kind and what changed, and nothing else until the reader asks: the reason, the
   meaning, the evidence and the caveats are the answer to "why", which is a
   question a reader has AFTER reading the line, not before. Native details
   rather than React state, so the disclosure works without a render cycle and
   is keyboard- and screen-reader-standard for free. */
.${CLASS.why} { font-size: 10px; }
.${CLASS.whySummary} {
  cursor: pointer; color: var(--dsw-alias-label-tertiary, #8a8a8a);
  list-style: none; width: fit-content;
}
.${CLASS.whySummary}::-webkit-details-marker { display: none; }
.${CLASS.whySummary}::before { content: '▸ '; }
.${CLASS.why}[open] > .${CLASS.whySummary}::before { content: '▾ '; }
.${CLASS.whySummary}:hover { color: var(--dsw-alias-label-secondary, #b0b0b0); }
.${CLASS.whyBody} {
  display: flex; flex-direction: column; gap: 4px; padding: 4px 0 0 12px;
  border-left: 1px solid var(--dsw-alias-border-l2, #3a3a3a);
}
.${CLASS.line} { fill: none; stroke: var(--dshtd-ink-train, #7d92f0); stroke-width: 1.6; stroke-linejoin: round; }
/* THE CHAIN A ROLLBACK THREW AWAY. The values are real and they are on the same
   leg axis, so they stay on the chart - dimmed and dashed, which is what a ghost
   is - and the live chain starts where the controller rewound to. The axis is
   untouched by the split, so a reader comparing the two chains is comparing them
   on one x. The colour is the same hue as the line it ghosts, because it is the
   same series: only its LIFE is different.
   AT HALF OPACITY AND NOT A THIRD, and this is a correction rather than a taste:
   shipped at 0.30 with a 2-3 dash, a 200-leg ghost over a wide axis read as NOT
   THERE at all - "the pre rollback values are completely gone ... they should
   simply be ghosted out so the latest run can appear distinct" (the user, 10
   October 2026). A ghost has to be visible enough to be recognised as one. */
.${CLASS.ghostLine} {
  fill: none; stroke: var(--dshtd-ink-train, #7d92f0); stroke-width: 1.4;
  stroke-dasharray: 5 3; opacity: 0.5; stroke-linejoin: round;
}
.${CLASS.ghostOverlay} {
  fill: none; stroke: var(--dshtd-ink-overlay, #d9a441); stroke-width: 1.3;
  stroke-dasharray: 5 3; opacity: 0.5; stroke-linejoin: round;
}
.${CLASS.ghostSwatch} { stroke: var(--dshtd-ink-history, #8f8f8f); stroke-width: 1.4; stroke-dasharray: 5 3; }
/* **A FAMILY LINE: THE HELD-OUT READING, THE SEALED READING OR A CORPUS'S OWN.**
   MEASURED 16 October 2026, the user: *"for the other series ... in the graph it is actually a dashed line,
   whereas the legend seems to suggest that it should be a solid line."* **The family lines were drawn with
   the ghost line's class, whose stroke-dasharray is 5 3 at half opacity** - correct for a chain a rollback
   threw away, and wrong for these: a held-out or corpus reading is a MEASUREMENT THAT IS STILL CURRENT, not
   history, and dashing it said the opposite. So a family line is SOLID at full opacity, and its colour is set
   inline from 'familyInk' because these lines are keyed on the corpus and cannot come from one variable.
   THE DASH MOVES TO THE ONE CASE THAT HAS EARNED IT, below. */
.${CLASS.familyLine} {
  fill: none; stroke-width: 1.4; stroke-linejoin: round; opacity: 0.85;
}
/* **AND THE SEALED READ IS THE ONE FAMILY LINE THAT IS GENUINELY SPARSE**, so it gets the dash the cadence
   deserves: one eval of a saved checkpoint every twelve legs, so the segments between its readings are
   interpolation and not measurement. Same reasoning as 'readingsLine', same 2-3 dash, and it is decided by
   the line's own ROLE rather than by how many points it happens to have - **a series is sparse because of
   what was measured, not because of how much of it is on screen.** */
.${CLASS.familyLineSparse} {
  fill: none; stroke-width: 1.4; stroke-linejoin: round; opacity: 0.85; stroke-dasharray: 2 3;
}
.${CLASS.dot} { fill: var(--dshtd-ink-train, #7d92f0); }
/* A SERIES TAKEN ON A CADENCE RATHER THAN EVERY LEG: the sealed read is one eval of the saved
   checkpoint every twelve legs, so the segments between its readings are interpolation and not
   measurement. Same ink and same weight as the line it is - it is the same series, and only the
   resolution differs - with a dash that says the value between two circles was not taken. Its dash
   is 2 3 against the ghost's 5 3, and the two never appear on one chart: a ghost is a chain a
   rollback threw away, which is a series that WAS sampled every leg and is now history. */
.${CLASS.readingsLine} {
  fill: none; stroke: var(--dshtd-ink-train, #7d92f0); stroke-width: 1.6;
  stroke-dasharray: 2 3; stroke-linejoin: round;
}
/* THE SECOND LINE, AND WHY IT IS DRESSED DIFFERENTLY. It is drawn on the SAME
   frame as the selected series but against the axis on the RIGHT, because the
   two carry different units and one axis cannot be true for both. So the two
   curves must not be confusable for one another: this one is a lighter weight,
   dashed, in its own registered colour, and the legend under the chart names
   it, its unit and which side of the frame its scale is on. The colour is a
   SECOND channel and never the only one - the dash pattern and the legend
   carry the same fact. */
.${CLASS.overlayLine} { fill: none; stroke: var(--dshtd-ink-overlay, #d9a441); stroke-width: 1.3; stroke-dasharray: 5 3; stroke-linejoin: round; }
.${CLASS.overlayDot} { fill: var(--dshtd-ink-overlay, #d9a441); }
.${CLASS.overlayGridline} { stroke: var(--dshtd-ink-overlay, #d9a441); stroke-width: 1; opacity: 0.22; }
.${CLASS.overlayAxis} { fill: var(--dshtd-ink-overlay, #d9a441); font-size: 9px; }
.${CLASS.overlaySwatch} {
  display: inline-block; width: 14px; height: 0; flex: none;
  border-top: 2px dashed var(--dshtd-ink-overlay, #d9a441);
}
/* The first line's key in the legend: a solid rule in the brand colour, the
   counterpart of the overlay's dashed one, so the pair reads as a pair. */
.${CLASS.legendSwatch} {
  display: inline-block; width: 14px; height: 0; flex: none;
  border-top: 2px solid var(--dshtd-ink-train, #7d92f0);
}
.${CLASS.overlayLegend} { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 10px; }
/* THE CURRENT VALUE OF EACH LINE, IN THE LEFT MARGIN. Written in its own line's
   colour, which is the one place on this frame where colour carries the whole
   meaning of a number - and still a second channel, because each reading sits at
   the height its line was drawn at and rides a rail in the same colour. The fill
   is set on the elements as well as here, because an SVG text with no fill is
   BLACK and a reader saw exactly that when these first shipped: a fill that lives
   only in this sheet is a fill that is absent whenever the sheet is not applied. */
.${CLASS.currentValue} { font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
.${CLASS.currentPrimary} { fill: var(--dshtd-ink-train, #7d92f0); }
.${CLASS.currentOverlay} { fill: var(--dshtd-ink-overlay, #d9a441); }
.${CLASS.hint} { color: var(--dsw-alias-label-caption, #8a8a8a); font-size: 10px; }
/* The reader's own switch for the marker categories. A real button with a
   label, so the categories are reachable by keyboard and by touch, and the
   SWATCH KEEPS ITS SHAPE when switched off: the chip is dimmed and its word
   struck through rather than recoloured, because a kind read as "off" by hue
   alone is invisible to a reader who cannot separate the hues. */
.${CLASS.toggle} {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, #3a3a3a); border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-secondary, #b0b0b0);
  font-size: 10px; padding: 1px 8px 1px 6px; line-height: 16px;
}
.${CLASS.toggle}:hover { border-color: var(--dsw-alias-border-l1, #4a4a4a); color: var(--dsw-alias-label-primary, #f0f0f0); }
.${CLASS.toggle}[data-on='false'] { opacity: 0.6; }
.${CLASS.toggle}[data-on='false'] .${CLASS.toggleLabel} { text-decoration: line-through; }
.${CLASS.toggleIcon} { flex: none; display: inline-block; }
.${CLASS.toggleIcon} * { fill: var(--dshtd-kind); }
.${CLASS.toggleOff} {
  border-style: dashed; border-color: var(--dsw-alias-border-l2, #5a5a5a);
  color: var(--dsw-alias-label-tertiary, #8a8a8a);
}
.${CLASS.legend} { display: flex; flex-wrap: wrap; gap: 10px; color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 10px; }
.${CLASS.legendItem} { display: inline-flex; align-items: center; gap: 4px; }
.${CLASS.notice} {
  border: 1px solid var(--dsw-alias-state-warn-secondary, #7a5520); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1d1d1d); padding: 10px 12px;
}
.${CLASS.noticeTitle} { font-weight: 600; margin-bottom: 4px; }
.${CLASS.noticeBody} { color: var(--dsw-alias-label-secondary, #b0b0b0); }
/* THE DEGRADED-SNAPSHOT NOTICE: the panel's own notice box, shrunk to one line so it sits beside the head
   rather than pushing the chart down. It introduces NO COLOURS of its own - the border, the background and
   the text all come from the notice rules above, which are written against the theme tokens - so dark and
   light stay decided where every other notice's palette is decided. */
.${CLASS.faults} {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px;
  padding: 6px 10px; font-size: 10.5px;
}
.${CLASS.faults} .${CLASS.noticeTitle} { margin-bottom: 0; }
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
/* THE RAIL: the value axis' overview, to the LEFT of the frame.
   The strip under the chart is the pattern and this is it turned on its side, so it borrows that
   strip's ink and its cursor rather than inventing a second visual language for the same object: a
   spine down the axis' middle, the window drawn on it, and a brush while the reader drags.
   THE GAP IS A LITERAL AND NOT THE RAIL CONSTANT'S FIELD, which was the first version and threw
   "Cannot access 'RAIL' before initialization": this stylesheet is built while the module's own
   constants are still in their temporal dead zone, because it is installed before the chart's
   geometry is read. The two numbers agree and a test compares them, so the literal cannot drift. */
.${CLASS.railFrame} { display: flex; align-items: flex-start; gap: ${RAIL.gap}px; }
/* THE RAIL MUST BE GIVEN ITS WIDTH, and the first version was not, which is why it took the screen.
   A rule above sets a width of 100% on the CHART, for the reason that rule gives - the frame should
   fill its lane - and as a sibling in this flex row the rail inherited nothing to stop it, so a
   26-unit strip was asked to be a full lane wide and the browser scaled its 26:240 aspect ratio up to
   match: a bar hundreds of pixels across, with the chart pushed off screen behind it.
   THE FIGURES ARE THE VIEWBOX UNITS - RAIL.width and RAIL.height themselves, which is why the geometry
   is declared above this sheet - so one CSS pixel is one viewBox unit and the strip is drawn at the
   size its own coordinates describe. A flex basis of 0 0 auto stops the row stretching it, and a
   minimum width of 0 stops the flex basis growing past the width. */
.${CLASS.rail} {
  touch-action: none; user-select: none; cursor: crosshair;
  flex: 0 0 auto; min-width: 0;
  width: ${RAIL.width}px; height: ${RAIL.height}px;
}
.${CLASS.railWindow} {
  fill: var(--dsw-alias-label-tertiary, #8a8a8a); fill-opacity: 0.22;
  stroke: var(--dsw-alias-label-secondary, #b0b0b0); stroke-width: 1;
}
.${CLASS.railBrush} {
  fill: var(--dsw-alias-label-secondary, #b0b0b0); fill-opacity: 0.28;
  stroke: var(--dsw-alias-label-secondary, #b0b0b0); stroke-width: 1;
}
/* The chart takes pointer drags for the window, so the browser must not claim
   them for scrolling or text selection. */
.${CLASS.chart} { touch-action: none; user-select: none; cursor: crosshair; }
.${CLASS.chart}:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary, #4d6bfe); }
.${CLASS.brush} { fill: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 0.16; }
.${CLASS.brushEdge} { stroke: var(--dsw-alias-brand-primary, #4d6bfe); stroke-width: 1; }
.${CLASS.overview} { touch-action: none; user-select: none; cursor: crosshair; }
.${CLASS.overviewLine} { fill: none; stroke: var(--dsw-alias-label-tertiary, #8a8a8a); stroke-width: 1; }
.${CLASS.overviewOlder} {
  fill: none; stroke: var(--dsw-alias-label-tertiary, #8a8a8a); stroke-width: 1;
  stroke-dasharray: 4 3; opacity: 0.5;
}
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
    /**
     * **THE METRIC FAMILIES, IN THE USER'S ORDER - AND EVERY TAG NAMED HERE IS ONE THE PRODUCER WRITES.**
     *
     * THE DEFECT THIS REPLACES, MEASURED 16 October 2026. The list named `train/bpb_legval`,
     * `train/bpb_sealed`, `sealed/ppl` and `sealed/ppl_log`, and the producer emits NONE of them: it writes
     * `train/bpb`. **Five of the seven named chips were therefore UNREACHABLE, their `fallbackFor`
     * suppression could never fire, and every other series fell through to `chipSeriesLabel`, WHICH RETURNS
     * THE RAW TAG** - so the header showed strings like `phase/wiki_en/heldout_ppl_log`. It was never a
     * styling problem; it was a lookup that missed.
     *
     * THE ORDER IS THE USER'S, 16 October 2026: *"what I would like instead is something as follows: bpb,
     * ppl, wall_seconds, units/s, gnorm, read layers, VRAM peak, vocab_size - in that particular order."*
     * **The order is the whole point of the request** - the list is what the header draws left to right, and
     * the previous order led with a reading, then throughput, then memory, then a metric the producer does not
     * emit at all.
     *
     * AND THE LEGACY NAMES ARE KEPT, BEHIND THE LEAD. `train/bpb_sealed` and `train/bpb_legval` were the
     * producer's two SOURCES for the held-out curve - the phase curve and the leg-end reading - and
     * `client.cjs`'s own note records the measurement that separated them: *"the curve carries 688 readings
     * over legs 1..689 and the leg reading 730 over 1..731, IDENTICAL on all 688 shared legs."* **The producer
     * has since collapsed both into `train/bpb`**, so those entries no longer LEAD - but a snapshot from an
     * older producer, or one written by another tool, still resolves to a labelled chip rather than a raw tag.
     * **`test/client.test.mjs` pins them, and that is why they stay.**
     */
    const INTERESTING = [
      { tag: 'train/bpb', label: 'bpb', unit: 'bpb', digits: 4 },
      { tag: 'train/ppl', label: 'ppl', unit: 'ppl', digits: 1 },
      { tag: 'train/wall_seconds', label: 'wall_seconds', unit: 's', digits: 1 },
      { tag: 'train/units_per_second', label: 'units/s', unit: 'u/s', digits: 1 },
      { tag: 'train/gnorm', label: 'gnorm', unit: '', digits: 3 },
      { tag: 'train/read_layers', label: 'read layers', unit: '', digits: 0 },
      { tag: 'memory/vram_peak_gib', label: 'VRAM peak', unit: 'GiB', digits: 2 },
      { tag: 'train/vocab_size', label: 'vocab_size', unit: '', digits: 0 },
      // **THIS LIST IS THE WHOLE HEADER, AND THE USER SAID SO TWICE.**
      //
      // 16 October 2026, the second time, after the first correction had been read as a request to reorder
      // rather than to delete: *"I only want the following chips/tabs in the dashboard. everything else
      // needs to be removed. bpb, ppl, wall_seconds, units/s, gnorm, read layers, VRAM peak, vocab_size. And
      // these will combine train/heldout + historical greyed out into one graph."*
      //
      // **"EVERYTHING ELSE NEEDS TO BE REMOVED" IS THE INSTRUCTION, AND IT IS NOT A REORDERING.** Every
      // entry that stood below this line has been deleted outright - the family-only held-out and sealed
      // bpb chips, the exam accuracy chip, and the legacy `train/bpb_legval` / `train/bpb_sealed` pair.
      // **They were all defensible individually and the aggregate was the complaint**: a header of thirteen
      // chips where eight were asked for, and near-duplicates among them.
      //
      // **WHAT REPLACES THEM IS THE FAMILY, NOT A CHIP.** `familyMembers` puts the held-out, sealed and
      // per-corpus readings of a metric ON that metric's own chart, greyed where they are history - which is
      // what *"combine train/heldout + historical greyed out into one graph"* asks for. **So the series are
      // not lost, and they are not chips either.** The removal of `availableSeries`'s fall-through matters
      // as much as this list: see there for why an unlisted tag no longer gets a chip of its own.
      //
      // **AND THE LEGACY PAIR WAS REMOVED WITH THEM.** An older snapshot's `train/bpb_legval` no longer
      // resolves to a labelled chip - it falls to the disclosure under its raw tag, or to nothing. **That is
      // a deliberate loss of a transition affordance in exchange for a header the user can read**, and it is
      // recorded here rather than discovered later: the alias chain existed for a producer that has since
      // moved twice, and no snapshot on this machine still serves those names.
    ]

    /**
     * The held-out reading, best source first.
     *
     * The tab's headline number, and the one the KPI header and the default chart
     * both read. Named once here so the two cannot disagree about which series the
     * reading comes from.
     *
     * THE PRODUCER RENAMED BOTH LEGACY NAMES, and the KPI row is where it showed.
     * Until 11 October 2026 this producer emitted `train/bpb_sealed` for the curve
     * JSONL's own bpb and `train/bpb_legval` for the leg-end reading. On that date
     * it renamed them to `train/bpb` and `train/heldout_bpb`, because "sealed" was
     * the wrong word - the SEALED read is a different instrument with its own
     * stores, and a reader who saw `bpb_sealed` had no way to know it was the
     * leg's own in-loop validation reading. This list was not moved with them.
     *
     * THE SYMPTOM IS A DASH AND THE CAUSE IS NOT THE DATA. `resolveHeadline` finds
     * no member of this list, the headline is null, and the KPI row's first two
     * tiles - leg and held-out bpb - render `—` while wall, throughput, VRAM and
     * the model's size render normally, because those four are read BY NAME and
     * survived the rename. Measured on the live snapshot, 13 October 2026:
     * `train/heldout_bpb` carried 48 points ending at 2.09 and the headline tile
     * read `—`.
     *
     * Both the CURRENT names and the LEGACY ones are listed: an old snapshot on
     * disk still carries the old tags, and a reader must not lose a chart because
     * a producer moved a name. Order is preference, not history - `heldout_bpb`
     * goes furthest, the curve stops at the phase boundary, and the legacy pair
     * sits last so a snapshot carrying both resolves to the current spelling.
     */
    const HEADLINE_TAGS = [
      // **`train/bpb` LEADS BECAUSE IT IS THE CHIP THAT LEADS.** MEASURED 16 October 2026: this list led with
      // `train/heldout_bpb` while `INTERESTING` leads with `train/bpb`, so the tab's headline number came
      // from one series and its default chart drew another - two readings of the same metric, one of them
      // the training batch and one of them held out, presented as though they were the same fact. **The
      // held-out reading is a LINE on that chart now, so the headline names the chart's own series.**
      'train/bpb',               // the training reading, and the series the bpb chip draws
      'train/heldout_bpb',       // the leg-end held-out reading
      'train/bpb_legval',        // the same series, name used before 11 October 2026
      'train/bpb_sealed',        // the curve JSONL's own copy, name used before 11 October 2026
      // **AND THE SEALED READ, WHICH IS THE ONLY bpb A bpb-LESS CORPUS PRODUCES.** MEASURED 18
      // October 2026: the `books` phase writes `sealed/bpb` (a real leg-17 reading, 2.2159) and no
      // `train/bpb`; without this entry the KPI's held-out tile read `—` while a sealed bpb was on
      // disk. It is last so a snapshot carrying both still headlines the per-leg training reading.
      'sealed/bpb',
    ]

    /**
     * The series drawn as a SECOND LINE on the main chart, best source first.
     *
     * THE SEED MODEL'S OWN SIZE, AND WHY IT IS AN OVERLAY RATHER THAN A CHIP.
     * The tab draws one series at a time on its own axis, because series carry
     * different units and one axis cannot be true for two of them. This one is
     * the exception the reader asked for: the growth ladder is the point of the
     * run, so how big the model has become has to be visible AT THE SAME TIME as
     * the reading it buys - a chip would make the reader choose between the
     * curve and the size, which is exactly the comparison they are trying to
     * make. It is therefore drawn on the same frame against the axis on the
     * RIGHT, dashed and in its own colour, with a legend naming its unit and its
     * side. The rule the chip design protects is not broken but made explicit:
     * the two curves are on different scales, and the frame says so in words.
     *
     * These tags are kept OUT of the chip list by `availableSeries`: a chip that
     * selects a series already drawn underneath the curve would be a second way
     * to ask for one picture, and the one already on screen would win.
     *
     * Sizing the first entry is the total, in parameters. The other two are the
     * tables it is made of, which are chartable in their own right when a
     * producer serves no total - see `resolveOverlay`.
     */
    const OVERLAY_TAGS = ['train/seed_model_params', 'train/seed_read_rows']

    /** The prefix every seed-size tag shares, kept out of the chip list. */
    const OVERLAY_TAG_PREFIX = 'train/seed_'

    /**
     * The two y scales a series can be drawn on, named once.
     *
     * WHY THE SIZE AXIS IS LOGARITHMIC, and it is a measurement rather than a
     * preference. The size is the product of the growth ladder, and the ladder
     * multiplies: this run steps 17.05M -> 22.22M, which is 1.30x, and a linear
     * axis anchored at zero draws that as a nearly flat line near the top of the
     * frame - the growth is in the numbers but the picture does not show it. On a
     * log axis the same readings are 0.115 decades of travel, and each growth
     * step is the same fraction of the height however big the model already is,
     * which is what "the size of the seed model as it grows" has to mean.
     *
     * WHAT "FROM 0" CANNOT MEAN HERE, stated rather than fudged: a log axis has
     * no zero. log(0) is negative infinity, so a floor of 0 is not a setting this
     * axis can honour, and a chart that drew one would be lying about its own
     * scale. The floor is instead a quarter of the series' own maximum (see
     * LOG_FLOOR_FRACTION), which is low enough that the line uses the frame and
     * high enough that it is a scale the data actually occupies. The part of the
     * request that DOES start from zero is carried by the series beside this one:
     * `train/seed_read_rows` is 0 rows at leg 1 and 7,471 now, and it is one
     * switch away.
     */
    const LOG_SCALE = 'log'
    const LINEAR_SCALE = 'linear'

    /**
     * Whether a series spec asks for a logarithmic y axis.
     *
     * The field is `axis` and not `scale`, because `scale` on these specs is
     * already taken: it is the numeric factor that turns a raw reading into the
     * unit the axis is written in (parameters into millions). Two meanings for
     * one name is how a log axis ends up reading `1e-6` as its scale kind.
     */
    function isLogScale(spec) {
      return spec !== null && spec !== undefined && spec.axis === LOG_SCALE
    }

    /** Whether a tag is part of the seed-size overlay family. */
    function isOverlayTag(tag) {
      return typeof tag === 'string' && tag.startsWith(OVERLAY_TAG_PREFIX)
    }

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
    /**
     * The chip label for a series this tab has no table entry for.
     *
     * WHY THIS IS THE TAG AGAIN. Until 13 October 2026 this appended a sentence to three tags: the
     * sealed family's, which explained that the sealed read runs on a cadence rather than every leg,
     * and the two leg-validation families, which said that they run every leg. The intent was to stop
     * a reader taking a sparse line for a stopped one - reported three times on 12 October 2026 - and
     * the effect was a chip whose NAME was a paragraph, quoting a cadence it had baked in:
     * `sealed/bpb (the sealed read: one reading every 12 legs, next by leg 48, so it moves 12 times
     * more slowly than the leg curve)`. The user's report of 13 October 2026 is that sentence read
     * back: "currently it has these weird series in the chart called: sealed/bpb (the sealed read:
     * one reading every 12 legs, next by leg 48, so it moves 12 times more slowly than the leg
     * curve)". A cadence stated inside a display name is also a copy that cannot keep up with the
     * controller, which moves it to 6 when retention is cautious.
     *
     * The two facts that sentence carried are both still on screen, and both are now where a fact
     * about a series belongs rather than in its name: the CADENCE, served by the producer in
     * `counts.sealed` and shown in this chip's own title, and the SPARSENESS, drawn - a series taken on
     * a cadence is rendered as its readings, with a circle on each one (see `SPARSE_COVERAGE`). So a
     * tag this file has never heard of keeps its own name, exactly as every other chip does.
     */
    function chipSeriesLabel(tag) {
      return tag
    }

    function availableSeries(payload) {
      const index = seriesIndex(payload)
      const offered = []
      // A series another entry defers to its better source entirely: `bpb_sealed`
      // is a strict prefix of `bpb_legval`, so where both exist the truncated one
      // is not offered at all, not even behind the disclosure.
      const suppressed = new Set(INTERESTING
        .filter((spec) => spec.fallbackFor !== undefined && index.has(spec.fallbackFor))
        .map((spec) => spec.tag))
      for (const spec of INTERESTING) {
        if (suppressed.has(spec.tag)) continue
        const own = index.get(spec.tag)
        if (own !== undefined) {
          offered.push({ ...spec, primary: true, series: own })
          continue
        }
        // **A METRIC CAN OUTLIVE ITS TRAIN READING, AND THE FAMILY IS WHAT KEEPS IT REACHABLE.**
        // MEASURED 18 October 2026: the `books` phase prints no per-leg bpb (its corpus spools no
        // per-unit charges), so `train/bpb` did not exist - but `sealed/bpb` DID, a real sealed
        // reading of leg 17, and the six history curves carried bpb too. **The bpb chip was not
        // offered at all, so a reader could not see any of them and reported "still can't see the
        // bpb values".** A chip whose primary is absent but whose family has members is offered with
        // an EMPTY primary: the chart's own line is not drawn, and the family's sealed/corpus/history
        // lines are. `primaryMissing` is what tells the chart and the legend not to name a train line
        // that does not exist.
        const family = familyMembers(spec.tag, index)
        if (family.length === 0) continue
        const familyPointCount = family.reduce(
          (total, member) => total + member.series.points.length, 0)
        offered.push({
          ...spec,
          primary: true,
          primaryMissing: true,
          familyPointCount,
          series: {
            tag: spec.tag,
            points: [],
            source: `no per-leg ${spec.label} in this snapshot; the chart draws `
              + family.map((member) => member.tag).join(', ')
              + ' instead, because this corpus does not produce the per-leg reading',
          },
        })
      }
      // **AND NOTHING ELSE. THE FALL-THROUGH IS DELETED, AND THAT DELETION IS THE FIX.**
      //
      // This loop used to walk EVERY series the host serves and offer each one that `INTERESTING` had not
      // already named, labelled by `chipSeriesLabel` - which returns the tag itself. **That is where the
      // header's thirteen chips came from, and it is why fixing the list alone was not enough**: removing an
      // entry from `INTERESTING` did not remove its chip, it moved the chip to the disclosure and stripped
      // its name to a raw tag. `held-out bpb`, `sealed bpb`, `eval/exam_accuracy`, the three
      // `phase/wiki_en/*` series, `train/seed_read_rows` and `train/seed_trainable_rows` were all reaching
      // the header through HERE, not through the list.
      //
      // **THE USER'S INSTRUCTION IS THE WHOLE HEADER, TWICE STATED**: *"I only want the following chips/tabs
      // in the dashboard. everything else needs to be removed."* **A chip that exists because the producer
      // happened to write a series is not a chip this tab chose to show**, and there is no way to honour
      // "everything else needs to be removed" while a loop re-adds everything else.
      //
      // **WHAT IS NOT LOST**: every series still reaches a reader, because a metric's held-out, sealed and
      // per-corpus readings are drawn as LINES on that metric's own chart by `familyMembers`. The fall-through
      // was offering them as separate charts of a quantity already charted.
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
     * **THE LINES THAT BELONG TO ONE METRIC, WHICH IS WHAT MAKES A CHIP A FAMILY.**
     *
     * The user's design, 16 October 2026: *"each metric's graph will have the following lines at the same
     * time - left axis: train and held out metric (color coded to metric) + grayed out historical runs +
     * corpus/metric (e.g phase/wiki_en/bpb) in the timeslot where that value was present (color coded to
     * corpus); right axis: params + grayed out historical runs."*
     *
     * **THE ONE-AXIS RULE IS NOT BROKEN BY THIS, AND THAT IS THE POINT OF THE FUNCTION'S SHAPE.** The
     * client's own note (lines 17-21) says one series is drawn at a time because *"accuracy, counts - and
     * drawing them on one axis would invite exactly the comparison the axis cannot support."* **Every member
     * returned here is the SAME QUANTITY measured a different way or over a different slice** - the training
     * batch, the held-out surface, and each corpus's own held-out surface for the legs that trained it. **A
     * family can never mix `bpb` with `ppl`, because the members are found by suffix and the metric is the
     * suffix.** That is the whole safety argument, and it is why this is a pure function of the tag and the
     * index rather than a table somebody maintains.
     *
     * THE `role` SAYS WHICH LINE IT IS, so the chart can colour it and the reader can tell them apart:
     *
     *   `train`    - the metric's own training reading, and the chip's whole series when it is the only one
     *   `heldout`  - the leg-end held-out reading (`train/heldout_bpb`)
     *   `corpus`   - one corpus's own held-out reading (`phase/<corpus>/heldout_bpb`), which exists only for
     *                the legs that trained that corpus - hence the user's *"in the timeslot where that value
     *                was present"*
     *
     * **THE MEMBERS ARE ABSENT FOR A FAMILY THAT HAS ONLY ITSELF, and that is deliberate**: a chip with one
     * line must draw exactly what it drew before, so this change cannot move a single-series chart.
     */
    function familyMembers(tag, index) {
      const members = []
      // **A MISSING TAG IS A SHAPE THIS CODE MUST TOLERATE, NOT ONE IT MAY ASSUME AWAY.** MEASURED: a test
      // mounts the chart with `spec: { label, digits, unit, series: { tag, points } }` - the tag inside the
      // series - while `availableSeries` builds chips whose tag sits on the spec. **Both shapes are in the
      // suite's fixtures**, so a `tag.startsWith` here threw `Cannot read properties of undefined` and the
      // chart died rather than drawing one line.
      if (typeof tag !== 'string' || tag === '') return members
      const stem = tag.startsWith('train/') ? tag.slice('train/'.length) : tag
      // the chip's own series first, so the primary line is the one the reader selected
      const own = index.get(tag)
      if (own !== undefined && own.points.length > 0) {
        members.push({ tag, role: 'train', series: own })
      }
      // the leg-end held-out reading, when the family has one
      //
      // **BOTH `train/heldout_<stem>` AND THE PLAIN `train/<stem>` ARE TRIED FOR `bpb`, because the two
      // registers are named differently by the producer and BOTH belong on this chart.** MEASURED: the
      // snapshot carries `train/heldout_bpb` (the leg's own validation read) and `train/bpb` (the training
      // read), and the user asked for those two to be ONE graph: *"combine the train + sealed/heldout into a
      // single graph for each metric."* For `ppl` the held-out twin is `phase/<corpus>/heldout_ppl`, which
      // the corpus loop below finds; a `train/heldout_ppl` would be found here if the producer ever writes
      // one.
      const held = `train/heldout_${stem}`
      const heldItem = index.get(held)
      if (heldItem !== undefined && heldItem.points.length > 0) {
        members.push({ tag: held, role: 'heldout', series: heldItem })
      }
      // **AND THE SEALED READ, WHICH IS A THIRD REGISTER OF THE SAME METRIC AND NOT A SECOND CHART.**
      // MEASURED: `sealed/bpb` carries 9 points against the training series' 24, because the sealed read
      // runs on a cadence rather than every leg - so it draws as a shorter line across the same axis, which
      // is exactly the user's *"sealed/heldout ... in a single graph."* **It is deliberately allowed to be
      // SPARSE**: a line of nine real readings is the honest picture of a quantity measured every twelfth
      // leg, and the chart already dashes a series taken on a cadence (`isSparseReadings`).
      const sealed = `sealed/${stem}`
      const sealedItem = index.get(sealed)
      if (sealedItem !== undefined && sealedItem.points.length > 0) {
        members.push({ tag: sealed, role: 'sealed', series: sealedItem })
      }
      // AND ONE LINE PER CORPUS, colour-coded by corpus.
      //
      // **BOTH NAMES A CORPUS LINE CAN WEAR ARE ACCEPTED, because the producer's own naming is not
      // uniform.** `phase/<corpus>/heldout_bpb` is what it writes today, and the user wrote
      // `phase/wiki_en/bpb` when describing what they wanted on the chart. The second form is
      // **unambiguous inside a family and only inside one**: the name must EQUAL the stem, so a `bpb`
      // family can never annex `phase/wiki_en/ppl`, while the `heldout_` form is matched as a prefix so a
      // corpus reading is still found if the producer renames the leg-end one.
      //
      // **AND THE LOG COPY IS EXCLUDED IN BOTH FORMS.** `phase/<corpus>/heldout_ppl_log` is the SAME POINTS
      // as `heldout_ppl` on a log axis, and this file's own history records what charting that family
      // three times produced: *"three near-identical, sentence-long chips."*
      for (const [otherTag, item] of index) {
        const match = /^phase\/([^/]+)\/(.+)$/.exec(otherTag)
        if (match === null) continue
        const [, corpus, name] = match
        if (name !== `heldout_${stem}` && name !== stem) continue
        if (item.points.length === 0) continue
        members.push({ tag: otherTag, role: 'corpus', corpus, series: item })
      }
      // **AND THE FAN: THE OTHER ARCS' CURVES, ONE MUTED LINE EACH, BEHIND THE LIVE ARC.**
      //
      // The user's picture, 16 October 2026: *"something akin to a Monte Carlo graph where we have an initial
      // starting point, which would be 0 in this case, the leg 0, and from there we explore the different
      // possibilities, and in this case we want only the live arc to be solid color and obvious and
      // everything else to be muted/grayed out and in the background."*
      //
      // **THE PRODUCER SERVES THESE AS `history/<arc>/<stem>`, AND THE ARC IS IN THE TAG SO THE LEGEND CAN
      // NAME IT.** Which arcs are served is the producer's decision and not this file's - see its
      // `discover_history_curves`, where a curve is admitted by the controller log or state a real run
      // left beside it and a probe's curve is refused. **NO PROPERTY OF A CURVE ALONE SAYS WHETHER IT IS
      // A PREDECESSOR OF THIS RUN**: the run directory has held `arc1` and `fixrun15`, so a bare glob
      // would draw an experiment as history and a hard-coded list went stale the day a new arc ran.
      //
      // **THEY ARE ORDINARY MEMBERS WITH `role: 'history'`**, so `lineDress` dresses them grey and dashed,
      // the legend names each arc, and the history switch takes them off the chart with everything else -
      // there is no second drawing path for them and therefore nothing to keep in step.
      for (const [otherTag, item] of index) {
        const match = /^history\/([^/]+)\/(.+)$/.exec(otherTag)
        if (match === null) continue
        const [, arc, name] = match
        if (name !== `heldout_${stem}` && name !== stem) continue
        if (item.points.length === 0) continue
        const role = arc.includes('-discarded-') ? 'discarded' : 'history'
        members.push({ tag: otherTag, role, arc, series: item })
      }
      return members
    }

    /** Whether a member set is more than the chip's own line - the test for "this is a family". */
    function isFamily(members) {
      return Array.isArray(members) && members.length > 1
    }

    //: The colours a corpus line can wear. **THE USER ASKED FOR THE CORPUS LINES TO BE *"color coded to
    //: corpus"*, AND FIVE IS THE NUMBER OF PHASES THIS RUN HAS.** They are distinct from the metric inks -
    //: blue for the reading, amber for the overlay - and from the grey of a line the history switch has
    //: taken off, so no two lines on one chart can be confused for each other.
    //: **THE LINE INKS ARE CSS VARIABLE REFERENCES, NOT HEX LITERALS, AND THAT IS WHAT MAKES THEM THEME
    //: AWARE.** MEASURED, 16 October 2026: these were chosen against a dark card and written as literals,
    //: so on a light one a `#2f9e6f` corpus line went muddy rather than legible - **a worse failure than an
    //: invisible line, because it looks deliberate.** The value now lives in the stylesheet twice, once per
    //: theme (see the panel's token block; `[data-mode]` pins it and `prefers-color-scheme` follows the
    //: system), and everything that drew a line, a dot, a swatch or a value label reads it from there.
    //:
    //: **THE FALLBACK IS THE DARK VALUE AND IT IS NOT DECORATION.** A renderer with no stylesheet - which is
    //: what the test environment is - resolves nothing, and a `stroke` of `var(--x)` with no fallback is an
    //: invalid paint, which is the white-line defect this file already carries a note about. Every reference
    //: below therefore names the dark value as its own fallback, so the worst case is the theme the plugin
    //: was designed in rather than no colour at all.
    const CORPUS_INK = [
      'var(--dshtd-ink-corpus-0, #3fb98a)',
      'var(--dshtd-ink-corpus-1, #b57ae0)',
      'var(--dshtd-ink-corpus-2, #ae4747)',
      'var(--dshtd-ink-corpus-3, #4aa3d9)',
      'var(--dshtd-ink-corpus-4, #d95fa8)',
      // **THE SIXTH IS A REAL COLOUR, NOT A WRAP.** See `familyInk` for the measurement that made this
      // necessary: the previous modulo sent a sixth corpus back to `corpus-0`, putting two identically
      // inked lines on one chart. Hue 250 sits in the violet-blue gap the first five leave open, and it
      // clears 3:1 on both surfaces (6.03:1 dark, 3.06:1 light) while holding 22 dE from every register.
      'var(--dshtd-ink-corpus-5, #8a86c8)',
    ]

    //: **THE DRESS OF A LINE THAT IS NOT FROM THE LIVE ARC.** Grey, faint and dashed, because a fan is read
    //: by following the one line that is still going. **These are the values a reader must be able to see
    //: THROUGH**, unlike the live arc's own registers, which are lightened but still in their metric's
    //: colour - see `lineDress`, where the distinction is stated once.
    const HISTORY_INK = 'var(--dshtd-ink-history, #8f8f8f)'
    const HELDOUT_INK = 'var(--dshtd-ink-heldout, #F48FB1)'
    const SEALED_INK = 'var(--dshtd-ink-sealed, #80DEEA)'

    //: The panel's attribute the stylesheet keys its two palettes on.
    const THEME_ATTRIBUTE = 'data-mode'

    /**
     * **WHICH PALETTE THE PANEL WEARS: `auto`, `dark` or `light`.**
     *
     * `auto` IS THE DEFAULT AND IT MEANS THE OPERATING SYSTEM'S PREFERENCE, not the host's tokens - because
     * the tokens are what the plugin reads when they exist, and this is what it does when they do not, which
     * is the whole case this block exists for. MEASURED, 16 October 2026: every fallback in the sheet was a
     * dark-theme value and nothing read a mode, so a light desktop with absent tokens got a near-black panel
     * with near-white text on it.
     *
     * **`auto` IS DELIBERATELY THE ABSENCE OF THE ATTRIBUTE.** The stylesheet's base block IS the dark
     * palette and its `prefers-color-scheme: light` block overrides it, so a panel carrying no attribute
     * follows the system by construction - and the attribute is written only when a reader PINS a mode.
     * **That keeps ONE source of truth for "follow the system"**: a mode string of `auto` handled in
     * JavaScript would be a second place that has to agree with the media query, and two places drift.
     *
     * @param raw - whatever the host's config carried: any case, any surrounding space.
     * @returns `'auto'`, `'dark'` or `'light'`. Anything unrecognised is `auto`, because **a typo in a config
     *   row should leave a reader with the system's theme rather than with no palette at all.**
     */
    function themeMode(raw) {
      const word = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
      return word === 'dark' || word === 'light' ? word : 'auto'
    }

    /** The `data-mode` value for a mode, or `undefined` so React writes no attribute at all. */
    function themeAttribute(mode) {
      return themeMode(mode) === 'auto' ? undefined : themeMode(mode)
    }

    /**
     * **THE DRESS OF ONE LINE: ITS INK, ITS OPACITY AND WHETHER IT IS DASHED.**
     *
     * ONE FUNCTION DECIDES ALL THREE, AND THAT IS THE POINT. The user reported the mismatch twice - *"the
     * primary series is actually white ... whereas the legend suggests blue"*, then *"in the graph it is
     * actually a dashed line, whereas the legend suggests solid"* - **and both times the swatch and the line
     * were styled in different places by different mechanisms.** A single source for ink, weight and dash
     * means the legend cannot describe a line the frame does not draw.
     *
     * **AND THE RULE THE USER SET IS THE ONE THE DASH CARRIES: SOLID MEANS LIVE ARC, DASHED MEANS HISTORY.**
     * See the note in the body for why the sealed line is solid and what the fan is for.
     *
     * @returns `{ink, opacity, dash}` - everything needed to draw the line AND its swatch.
     */
    function lineDress(role) {
      // **THE DASH IS THE MARK OF NOT-CURRENT, AND THAT IS THE WHOLE RULE.**
      //
      // CORRECTED 16 October 2026, and it reverses a decision made an hour earlier. The user: *"I would
      // actually prefer all values in series from the live arc, meaning something not historical but the
      // current arc, to be solid lines instead of dashed ones. So we should use some grayed out or muted
      // colors plus dashed lines for historical values that are not from the current arc."*
      //
      // **THE SEALED LINE WAS DASHED ON THE REASONING THAT IT IS TAKEN ON A CADENCE**, one eval every twelve
      // legs, and that reasoning was wrong on the substance: **a sealed read of the live arc's own checkpoint
      // is as current as a reading gets.** The dash does not mean "sparse" - the chart already says a series
      // is sparse by drawing a CIRCLE on every reading it has - **it means "this did not come from the arc
      // you are training."** So the sealed line is SOLID, like every other live-arc line.
      //
      // **AND THE SHAPE THIS SERVES IS A FAN.** The user's picture: *"something akin to a Monte Carlo graph
      // where we have an initial starting point, which would be 0 in this case, the leg 0, and from there we
      // explore the different possibilities, and in this case we want only the live arc to be solid color and
      // obvious and everything else to be muted/grayed out and in the background."* **Every line the live
      // arc produced is solid and coloured; a line from another arc will be muted grey and dashed**, and
      // `HISTORY_DRESS` below is that second dress waiting for the series that need it.
      //
      // The opacity still separates the REGISTERS of the live arc - the training reading full, the held-out
      // and sealed readings lighter - because they are the same quantity on different data and the thing a
      // reader looks for is how far the lighter line sits above the darker one. **Lighter is not muted**: a
      // muted line is grey and dashed, and none of these are.
      if (role === 'heldout') return { ink: HELDOUT_INK, opacity: 0.55, dash: null }
      if (role === 'sealed') return { ink: SEALED_INK, opacity: 0.55, dash: null }
      // **A CORPUS LINE IS DOTTED, AND THAT IS AN ACCESSIBILITY DECISION RATHER THAN A STYLE ONE.**
      //
      // MEASURED, 16 October 2026: with five corpus inks plus the three registers, every pair that shares a
      // chart was checked for perceptual distance under normal vision AND under simulated deuteranopia,
      // protanopia and tritanopia. **Most pairs clear dE 10 comfortably, and a handful land between 7 and 10 -
      // and that is a PROPERTY OF HUE, not a defect in the palette.** The literature's own figure is that
      // dichromats resolve roughly three to four categorical colours; five corpora plus three registers is
      // more than hue can carry, and no amount of tuning changes that.
      //
      // **SO THE CHART MUST NOT RELY ON HUE, WHICH IS WCAG 1.4.1 ANYWAY** - *"colour is not used as the only
      // visual means of conveying information."* Every role now differs in DASH as well:
      //
      //     train    solid, full weight      heldout/sealed  solid, 0.55 weight
      //     corpus   dotted 1 3              history         dashed 4 4, 0.35 weight
      //
      // Four distinguishable line styles, so a reader who cannot separate the hues can still follow which
      // line is which by shape and weight alone. **The legend swatch reads the same three properties from this
      // function**, so it cannot describe a line the frame does not draw - which is what makes this a real
      // channel rather than a claim about one.
      // **AND ITS OWN WEIGHT, WHICH IS THE FIX FOR THE ONE PAIR THAT WAS TOO CLOSE.** MEASURED: the blue
      // training ink and the blue-cyan `corpus-3` ink fell to 5.1 dE under protanopia - the worst pair on the
      // chart - and **no replacement hue fixes it**: a search over the whole wheel found that the best
      // single-hue candidate (magenta at hue 300, 16.1 dE) collides with the existing `corpus-4`. Five corpus
      // inks plus three registers is simply more than hue can carry. So the corpus line takes 0.80 weight
      // against the registers' 1.0 and 0.55, which is a channel that does not depend on hue at all.
      if (role === 'corpus') return { ink: null, opacity: 0.80, dash: '1 3' }
      // AND A LINE FROM ANOTHER ARC: muted, dashed, and drawn behind everything.
      if (role === 'history') return { ink: HISTORY_INK, opacity: 0.35, dash: '4 4' }
      if (role === 'discarded') {
        return { ink: `color-mix(in srgb, ${PRIMARY_INK} 55%, ${HISTORY_INK})`, opacity: 0.6, dash: null }
      }
      return { ink: PRIMARY_INK, opacity: 1, dash: null }
    }


    /**
     * The colour one family line is drawn in, and the reason a legend can name it.
     *
     * **KEYED ON THE CORPUS'S POSITION IN THE SORTED LIST OF THE CORPORA PRESENT**, and not on the order the
     * payload happens to serve them. **A colour that moves when the producer reorders its series is worse
     * than no colour at all**, because a reader learns "green is wiki_en" and is then lied to. Sorting makes
     * the mapping stable while the set of corpora is, and it changes only when a corpus is genuinely added.
     *
     * **AND A CORPUS BEYOND THE FIFTH GETS A DERIVED COLOUR RATHER THAN A WRAPPED ONE.** MEASURED: this read
     * `CORPUS_INK[at % CORPUS_INK.length]`, so **a sixth corpus wrapped onto `corpus-0` and two lines on one
     * chart wore the same ink** - the one failure a categorical palette must never have. The sixth entry
     * below is a real colour with its own hue, placed in the violet-blue gap none of the first five occupies,
     * and the modulo is gone: a seventh corpus falls back to the first ink and **SAYS SO**, because beyond
     * six the palette is genuinely exhausted and a silent wrap is how the defect above went unnoticed.
     *
     * @param member - one entry from `familyMembers`.
     * @param index - the payload's series index, used to find which corpora are present.
     * @returns a CSS colour for the line, or `null` to leave it to the stylesheet.
     */
    function familyInk(member, index) {
      if (member === null || member === undefined) return null
      if (member.role === 'heldout') return HELDOUT_INK
      if (member.role === 'sealed') return SEALED_INK
      // **A LINE FROM ANOTHER ARC IS GREY, AND THIS BRANCH WAS MISSING FOR AN HOUR.** MEASURED: the four
      // history paths rendered with NO STROKE AT ALL - `stroke: null` - because this function knew only the
      // corpus role and returned `null` for anything else, and an SVG path with no stroke colour is the
      // white-line defect this session already fixed once. **The legend swatch was grey throughout**, because
      // it reads `lineDress` directly - so for one round the fan would have drawn four invisible lines under
      // a legend that named them. The two must agree, which is why `lineDress` is the source and this only
      // fills in the one role whose colour is keyed on something else.
      if (member.role === 'history') return HISTORY_INK
      if (member.role === 'discarded') return `color-mix(in srgb, ${PRIMARY_INK} 55%, ${HISTORY_INK})`
      if (member.role !== 'corpus') return null
      const corpora = []
      for (const [tag] of index) {
        const match = /^phase\/([^/]+)\//.exec(tag)
        if (match !== null && !corpora.includes(match[1])) corpora.push(match[1])
      }
      corpora.sort()
      const at = corpora.indexOf(member.corpus)
      if (at === -1) return null
      // **NO MODULO: THE PALETTE IS EXHAUSTED RATHER THAN WRAPPED.** A seventh corpus reuses the first ink,
      // and that is a documented fallback rather than a silent collision - the difference being that the
      // first six are genuinely distinct.
      return at < CORPUS_INK.length ? CORPUS_INK[at] : CORPUS_INK[0]
    }

    /**
     * **WHAT THE LEFT AXIS IS CARRYING, NAMED. THE USER'S FIRST REPORT OF 16 OCTOBER 2026.**
     *
     * *"The legend shows only bpb(bpb) for the left axis. it should show all series present for the left
     * axis."* MEASURED: the legend rendered `activeSpec.label` and `activeSpec.unit` - **one entry, for the
     * chip's own series** - so a chart drawing a training curve, a held-out curve, a sealed curve and a
     * corpus curve named one of the four and left a reader to guess what the other three lines were.
     *
     * **THE NAME IS THE REGISTER OR THE CORPUS, WHICH IS WHAT THE COLOUR ALREADY MEANS.** `train`,
     * `heldout` and `sealed` name themselves; a corpus line is named for its corpus, because that is the
     * thing its colour is keyed on. **The chip's own line is named by its label**, which is the metric - so a
     * reader sees `bpb`, `heldout`, `sealed`, `wiki_en` and can read the chart.
     *
     * @param spec - the chip's own spec, whose series is the chart's main line.
     * @param members - the family EXCLUDING the chip's own line, from `familyMembers`.
     * @param index - the payload's series index, for the corpus colours.
     * @returns `[{key, label, ink, unit, points}]` - one entry per line drawn on the left axis.
     */
    function legendEntries(spec, members, index) {
      // the chip's own line is the TRAINING reading, and it wears the train dress - see `lineDress`
      const own = lineDress('train')
      // **A CHIP WITHOUT A PRIMARY LINE NAMES NO TRAIN LINE.** The family-only chip (`primaryMissing`)
      // draws the sealed/corpus/history members and nothing on the train register; an entry saying
      // "train, 0 points" would name a line the reader cannot see. The legend's count logic below
      // already treats `legendEntries` as the number of lines on the frame, so leaving it out is the
      // correct count as well as the correct name.
      const entries = spec.primaryMissing === true ? [] : [{
        key: typeof spec.tag === 'string' ? spec.tag : 'primary',
        // **THE CHIP'S OWN LINE IS NAMED FOR ITS ROLE, LIKE EVERY OTHER LINE. THE USER'S FIFTH REPORT,
        // 16 October 2026: *"bpb / heldout (bpb) / sealed (bpb) - the bpb (chip name in legend) is still
        // there."***
        //
        // MEASURED, and the inconsistency was structural rather than cosmetic: this entry carried
        // `spec.label` - THE METRIC'S NAME, which is also the chip's name and the tab's title - while every
        // sibling carried its ROLE. **So the legend read `bpb`, `heldout`, `sealed`: one name repeating the
        // thing already written above the chart, beside two that actually explain which line is which.**
        // A reader looking at four curves learned what three of them were and was told the fourth was the
        // metric, which the tab had already said.
        //
        // **`train` IS THE ROLE AND IT IS THE WORD THAT MATCHES ITS SIBLINGS**, so the legend now reads
        // `train`, `heldout`, `sealed`, `wiki_en` - four answers to the same question, "which line is this?"
        // - and the metric's name stays where it belongs, on the chip and the tab.
        label: 'train',
        ink: own.ink,
        opacity: own.opacity,
        // the chart's own line is dashed only when it is a cadence, and the swatch must say the same
        dash: spec.series !== undefined && isSparseReadings(spec.series.points) ? '2 3' : own.dash,
        unit: spec.unit,
        points: spec.series === undefined ? null : spec.series.points.length,
      }]
      for (const member of members) {
        const dress = lineDress(member.role)
        entries.push({
          key: member.tag,
          // **A FAN LINE IS NAMED FOR ITS ARC**, because the arc is the whole difference between it and the
          // live curve - `c5` and `c3` are the useful words, and `history` is not. A corpus line is named for
          // its corpus for the same reason: the name is whatever the line's colour and dress are keyed on.
          label: member.role === 'corpus' ? member.corpus
            : (member.role === 'history' ? member.arc : member.role),
          ink: dress.ink === null ? familyInk(member, index) : dress.ink,
          opacity: dress.opacity,
          // **THE SWATCH WEARS THE LINE'S OWN DRESS - ink, weight and dash - WHICH IS BOTH HALVES OF THE
          // USER'S REPORT.** *"the legend seems to suggest that it should be some blue shade"* while the
          // line was white, and *"in the graph it is actually a dashed line, whereas the legend seems to
          // suggest that it should be a solid line."* **The dash is decided by the line's ROLE, the same
          // call the chart makes, so the two cannot disagree.**
          dash: dress.dash,
          // **A FAN LINE CARRIES NO UNIT, WHICH IS THE LAST OF THE REDUNDANCIES THE USER NAMED.**
          // MEASURED: the legend read `bpb`, then `c5 (bpb)`, `c3 (bpb)`, `c4 (bpb)`, `c7 (bpb)` - **the
          // metric's own name repeated on every arc line, when the summary beneath already says the lines on
          // the left axis share one scale.** The arc is the only thing that distinguishes these lines, so the
          // arc is the whole label: `c5`, `c3`, `c4`, `c7`. **A unit belongs on the entry that establishes
          // the scale, not on every line drawn against it.**
          unit: member.role === 'history' ? null : spec.unit,
          points: member.series.points.length,
        })
      }
      return entries
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

    /**
     * The marker categories each session last had switched off.
     *
     * A third piece of state that belongs to the READER, kept here for the same
     * reason the other two are: the pane unmounts and mounts a tab body again on
     * events the reader did not cause, and a switch that resets itself on a
     * poll is worse than no switch - the reader turns a category off to read a
     * curve, the next refresh puts it back, and the chart silently returns to
     * the state they were trying to get away from.
     *
     * A LIST OF HIDDEN KINDS and not a set of shown ones, so a kind this tab has
     * never seen is DRAWN by default: a producer's new kind, or a marker served
     * with no kind, must not be hidden by a preference the reader expressed
     * before it existed.
     */
    const hiddenKindsBySession = new Map()
    const hideOlderBySession = new Map()

    /** The categories one session has switched off, or [] for none. */
    function rememberedHiddenKinds(sessionId) {
      // A COPY, so a caller that sorts or splices what it is handed cannot reach
      // back into the store and change what the next render reads.
      return [...(hiddenKindsBySession.get(sessionId ?? '') ?? [])]
    }

    /** Remember the categories one session has switched off. */
    function rememberHiddenKinds(sessionId, kinds) {
      hiddenKindsBySession.set(sessionId ?? '', [...(kinds ?? [])])
    }

    /** Whether one session had the older run's values switched off. */
    function rememberedHideOlder(sessionId) {
      return hideOlderBySession.get(sessionId ?? '') === true
    }

    /** Remember whether one session has the older run's values switched off. */
    function rememberHideOlder(sessionId, hidden) {
      hideOlderBySession.set(sessionId ?? '', hidden === true)
    }

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
     * The key the VERTICAL window is stored under for one series.
     *
     * ONE STORE, TWO WINDOWS, AND NO COLLISION. The vertical window travels in the same map as the
     * horizontal one because both are the same kind of thing - a range the reader chose, restored on
     * remount - and a separate map would be a second place for the same behaviour to drift. The suffix
     * is what keeps them apart: a series tag cannot itself end in `/y` and still be a tag, because a
     * tag's last segment names the metric.
     */
    function yTag(tag) {
      return `${tag}/y`
    }

    /** The vertical window one series was left at, or null for auto. */
    function rememberedYWindow(tag) {
      return windowByTag.get(yTag(tag)) ?? null
    }

    /** Remember, or forget with a null window, the vertical window one series was left at. */
    function rememberYWindow(tag, range) {
      if (range === null || range === undefined) windowByTag.delete(yTag(tag))
      else windowByTag.set(yTag(tag), range)
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

    /**
     * The newest leg any LIVE series carries, or null.
     *
     * **THE LEG TILE IS NOT A PROPERTY OF THE HEADLINE METRIC.** MEASURED 18 October 2026: the
     * `books` phase prints no bpb (its corpus spools no per-unit charges), so `headlineReading`
     * returned null for the run that was training and the KPI row's `leg` tile rendered `—` beside
     * nine legs of wall clock and perplexity. The chart was not empty; the tile was reading the
     * wrong series for its own question.
     *
     * Only `train/*` is eligible: those are the live leg-axis families. `history/*` carries another
     * run's legs (a 124-leg predecessor would outrank today's leg 10), and `vram_trace/*` is a STEP
     * axis whose last point is step 1024, not a leg.
     */
    function latestLeg(payload) {
      let newest = null
      for (const [tag, item] of seriesIndex(payload)) {
        if (!tag.startsWith('train/')) continue
        if (item.points.length === 0) continue
        const point = item.points[item.points.length - 1]
        if (newest === null || point[0] > newest[0]) newest = point
      }
      return newest
    }

    /** The chip label for one tag, falling back to the tag, or to the reading's own name. */
    function seriesLabel(tag) {
      if (tag === null || tag === undefined) return 'held-out bpb'
      // **THE HEADLINE CAN NAME A SERIES NO CHIP NAMES.** `sealed/bpb` is a family member, not one of
      // the eight chips, and `train/heldout_bpb` is the leg-end register of the bpb chip. Both can be
      // the headline reading, so both get a human label rather than falling through to the raw tag.
      if (tag === 'sealed/bpb') return 'sealed bpb'
      if (tag === 'train/heldout_bpb') return 'held-out bpb'
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

    /**
     * The room the second axis needs on the right, in chart units.
     *
     * Two things share this gutter: the overlay's tick labels, and the axis'
     * own UNIT drawn rotated at the outer edge. A unit written flat beside the
     * top tick is what this replaced: `22.00 M params` is far wider than any
     * gutter worth taking out of the plot, so the unit stands up the side
     * instead, where the chart's HEIGHT pays for it and the curve keeps its
     * columns. See `axisUnitTitle`.
     *
     * The current-value readings used to be written here too, sharing a column
     * with the tick labels until a reader could not tell them apart. They are in
     * the left margin now, which is why this is 74 rather than 100.
     */
    const OVERLAY_GUTTER = 74

    /** How far a tick label sits from the axis it belongs to. */
    const AXIS_LABEL_GAP = 6

    /** The width reserved at the outer edge of an axis for its rotated unit. */
    const AXIS_UNIT_WIDTH = 16

    /** The width of the band a current-value reading occupies. */
    const CURRENT_VALUE_WIDTH = 50

    /** The rail down a reading's inner edge: where it starts, and how thick. */
    const CURRENT_VALUE_RAIL_X = 96
    const CURRENT_VALUE_RAIL_WIDTH = 2

    /**
     * How far below a reading's value its text baseline sits, and the least room
     * that may be left between two readings.
     *
     * **`LABEL_BASELINE` IS THE TEXT'S OWN HALF-HEIGHT, AND THAT IS THE WHOLE POINT.** MEASURED, the user, 16
     * October 2026: *"they don't seem to line up properly with the actual value of the actual position in the
     * graph. It seems to be either above or below where it should be."* The reading was drawn 16 pixels above
     * its line by a constant named for an offset rather than for a measurement, so the number floated about
     * two text-heights clear of the value it named. **A baseline offset of half the glyph height puts the
     * glyphs' CENTRE on the value**, which is what a reader compares against the line.
     *
     * The separation is measured against the band each reading occupies, so the two RAILS cannot meet either.
     */
    const LABEL_BASELINE = 4
    const CURRENT_VALUE_MIN_SEPARATION = 13

    /**
     * How far inside the frame's RIGHT edge the reading column's right edge sits.
     *
     * **THE THIRD CORRECTION OF 16 October 2026, AND IT SETTLES WHERE THE COLUMN LIVES.** The user first asked
     * that the readings be *"within the graph itself, not outside of the graph"*; then that they be
     * *"right aligned"*; and then, seeing where that put them: *"the live hovering number (currently 1.4660
     * etc) should be aligned to the right edge of the chart, not at the 6th leg boundary."*
     *
     * **THAT LAST PHRASE IS A PLACE ON THE CHART, NOT A LEG COUNT, AND I MISREAD IT AS THE LATTER.** The frame
     * is 502 px wide, so on a ~52-leg run the sixth leg falls about 12 percent in - which is exactly where
     * `plot.left + 64` put the column. **The user was describing my own placement back to me, in the units the
     * chart is drawn in.**
     *
     * So the column's right edge is `CURRENT_VALUE_INSET` from `plot.right` and its text is anchored `end`: the
     * numbers grow LEFTWARD from the frame's right edge, their digits line up as a column, and **the column now
     * sits where the live values actually are** - the newest point of every line, at the right-hand end, which
     * is the end a reader watching a run is looking at.
     *
     * **AND IT RECOVERS THE ROOM THE LEFT-EDGE VERSION COST.** That version sat over the oldest data points,
     * because every line begins at leg 1. The newest leg is where the lines END, so a column at the right edge
     * covers the tail of the curve only where a reading is written - and it is written at the height of its own
     * line, which is the one place a reader is already looking.
     */
    const CURRENT_VALUE_INSET = 10

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
    /**
     * The VERTICAL window's own floor: how narrow it may become, as a fraction of the auto extent.
     *
     * THE X AXIS' `MIN_WINDOW_FRACTION` IS NOT REUSED, and the reason is the units. That one is a
     * fraction of the run's LENGTH, so 0.002 of a 500-leg run is a one-leg window. The vertical axis
     * has no equivalent absolute floor - a value's meaningful resolution depends entirely on the
     * series - so this is the same idea expressed only in the ratio that does transfer: the window may
     * not be narrower than a fraction of what auto would have shown. Clamping to the AUTO EXTENT rather
     * than to a data bound matters too: auto already carries the padding, so a reader who zooms fully
     * in still sees the padded frame rather than a line.
     */
    const Y_MIN_WINDOW_FRACTION = 0.01
    /**
     * Below this share of the legs it spans, a series is drawn as its READINGS and not as a curve.
     *
     * WHY A SHARE OF THE SPAN AND NOT A GAP SIZE. A producer's series is either per-leg — a reading on
     * every step the run took, so it covers its whole span — or per-INSTRUMENT, taken on a cadence,
     * which is what the sealed read is: one eval of the saved checkpoint every `read_cadence` legs
     * (12 here) against a leg curve that moves every leg. Measured on the live run, 13 October 2026:
     * `sealed/bpb` carried 4 readings over legs 7..36 while every other family carried 42 over 42.
     * Drawing the sparse one as a continuous line claims a value at every leg between the readings,
     * and a reader who takes that claim seriously reads the instrument as smoother and slower-moving
     * than it is. So the line is dashed, and every reading it HAS gets a circle. The share is what
     * separates the two, and it separates them by a factor of four on the run that produced this:
     * the sparse family covers 0.14 of its span and the densest per-leg family covers 1.0. A series
     * that stops early — a truncated per-leg family, or one the producer has only just begun writing —
     * still has consecutive readings and is NOT sparse, which is the property that keeps a short curve
     * drawn as a curve. 0.5 is the midpoint of the two populations and is a registered constant so it
     * can be moved with its reason rather than tuned in an expression.
     */
    const SPARSE_COVERAGE = 0.5
    /**
     * The radius of a circle marking one READING rather than the end of a curve.
     *
     * It is the same 2.6 the newest-point dot has always used, named here because it is now drawn on
     * every point of a sparse series as well as on the newest point of any series: the two marks mean
     * the same thing - a value the instrument actually took - and a second radius for the same mark
     * would read as a second kind of mark.
     */
    const READING_DOT_RADIUS = 2.6
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
     * Whether a series is taken on a cadence rather than every leg.
     *
     * The test is COVERAGE: how many of the legs between its first and last reading it actually
     * carries. See `SPARSE_COVERAGE` for the two populations this separates and the measurement
     * behind the threshold. It reads the series' own points and nothing else, so a producer that
     * serves a sparse family this file has never heard of gets the honest rendering without having
     * to declare anything — and no producer can declare a densely-sampled series into it.
     *
     * @param points - the series' points, ascending in x.
     * @returns true when the readings are a cadence apart rather than a leg apart.
     */
    function isSparseReadings(points) {
      if (!Array.isArray(points) || points.length < 2) return false
      const span = Math.abs(points[points.length - 1][0] - points[0][0])
      if (!(span > 0)) return false
      return points.length / (span + 1) < SPARSE_COVERAGE
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

    /**
     * The frame's x mapping: which data values its left and right edges hold.
     *
     * `padRight` is a parameter because the frame WIDENS when a second line is
     * drawn against an axis on its right: the overlay's tick labels need a
     * gutter, and a label drawn outside the plot's own columns would either be
     * clipped away or land on top of the curve. Omitted, the frame is the one
     * this tab has always drawn, so a caller that knows nothing about the
     * overlay gets exactly the geometry it got before.
     */
    function plotGeometry(range, padRight = CHART.padRight) {
      return { left: CHART.padLeft, right: CHART.width - padRight, lo: range.lo, hi: range.hi }
    }

    /**
     * Clamp a chart-space x to a frame's plot columns.
     *
     * The right edge comes from the frame when the caller has one, so a drag on
     * a chart with a second axis stops at the axis rather than under its labels.
     */
    function clampChartPixel(px, right = CHART.width - CHART.padRight) {
      return Math.min(Math.max(px, CHART.padLeft), right)
    }

    /** The data value at one x pixel of the frame. */
    function valueAt(px, plot) {
      const fraction = (px - plot.left) / (plot.right - plot.left)
      return plot.lo + fraction * (plot.hi - plot.lo)
    }

    /**
     * The window two pixels select, under a given pixel-to-value mapping, ordered.
     *
     * `brushRange` BELOW IS THIS FUNCTION, and the vertical axis is this function too. It was two
     * lines of `valueAt` against an x plot, which is why the vertical axis could not reuse it without
     * a copy; taking the mapping as an argument is what makes one function serve both rails and keeps
     * a fix to either from being a fix to one of them.
     */
    function brushRangeAt(fromPx, toPx, at) {
      const a = at(fromPx)
      const b = at(toPx)
      return a <= b ? { lo: a, hi: b } : { lo: b, hi: a }
    }

    /** The window two x pixels select, ordered. */
    function brushRange(fromPx, toPx, plot) {
      return brushRangeAt(fromPx, toPx, (px) => valueAt(px, plot))
    }

    /**
     * The VALUE under one y pixel, for a given vertical window - `valueAt` one axis over.
     *
     * The vertical axis is INVERTED against the screen: `CHART.padTop` is the window's TOP and holds
     * its `hi`. That inversion is the only thing this does that `valueAt` does not, and it lives here
     * rather than in each caller so the wheel and anything added later cannot each get it wrong in
     * their own way.
     */
    function valueAtY(py, range) {
      const top = CHART.padTop
      const height = CHART.height - CHART.padTop - CHART.padBottom
      const fraction = (py - top) / height
      return range.hi - fraction * (range.hi - range.lo)
    }

    /**
     * The y pixel of one event, in the drawn frame's own coordinates.
     *
     * `chartPixelFromEvent` clamps to the plot's columns; this clamps to its rows, and they are
     * separate because one clamp cannot serve both axes without lying about one of them.
     */
    function chartPixelFromEventY(event, element) {
      const rect = element.getBoundingClientRect()
      if (rect.height === 0) return CHART.padTop
      const raw = ((event.clientY - rect.top) / rect.height) * CHART.height
      const bottom = CHART.height - CHART.padBottom
      return Math.min(Math.max(raw, CHART.padTop), bottom)
    }

    /**
     * The chart-space x of a pointer event over an element that draws the frame.
     * @param event - a pointer event.
     * @param element - the element the frame is drawn in.
     * @param plot - the frame, when the caller has one with a widened right edge.
     * @returns the clamped chart-space x.
     */
    function chartPixelFromEvent(event, element, plot = null) {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0) return CHART.padLeft
      const right = plot === null ? CHART.width - CHART.padRight : plot.right
      return clampChartPixel(((event.clientX - rect.left) / rect.width) * CHART.width, right)
    }

    /** "steps 120–480 · 360 of 1200 shown", for the visible readout. */
    function rangeLabel(range, bounds, fromPassStart = false) {
      const lo = Math.round(range.lo)
      const hi = Math.round(range.hi)
      const total = Math.round(bounds.hi - bounds.lo)
      const whole = range.lo <= bounds.lo && range.hi >= bounds.hi
      // A RE-BASED X IS NAMED, not left to be inferred from numbers that no longer
      // match the legs in the register: on a run that has rolled back, x is the
      // distance from each pass's own first leg, and "steps 12–60" would be read as
      // legs 12 to 60 of a run whose live pass has not reached either.
      const unit = fromPassStart ? "legs from each pass's start" : `${X_AXIS_LABEL}s`
      return whole
        ? `${unit} ${lo}–${hi} · all ${total} shown`
        : `${unit} ${lo}–${hi} · ${Math.round(range.hi - range.lo)} of ${total} shown`
    }

    /**
     * Whether two windows mean the same thing, to within the noise of how they were computed.
     *
     * THE TOLERANCE IS RELATIVE TO THE WINDOW'S OWN SPAN and not an absolute figure, because a window's
     * meaningful resolution depends entirely on the series: a tolerance of 1e-9 is tight for a value in
     * the thousands and loose for one in the thousandths, and the same Epsilon cannot be both. A window
     * whose ends agree to a millionth of its span is the same window for any purpose a reader has.
     *
     * It exists because `valueRange` pads by a fraction of the span, so two extents computed over the
     * same points at slightly different widths differ in their last bits - which would make a reset
     * control flicker enabled on a poll that changed nothing.
     */
    function sameWindow(left, right) {
      if (left === null || left === undefined || right === null || right === undefined) return false
      const span = Math.max(Math.abs(left.hi - left.lo), Math.abs(right.hi - right.lo), 1e-12)
      const tolerance = span * 1e-6
      return Math.abs(left.lo - right.lo) <= tolerance
        && Math.abs(left.hi - right.hi) <= tolerance
    }

    /**
     * The rail's window rectangle, in the rail's own viewBox coordinates.
     *
     * THE INVERSION IS THE WHOLE FUNCTION. SVG's y grows downward while the value axis grows upward, so
     * the window's TOP edge is its `hi`. Getting that backwards puts the window at the wrong end of the
     * rail while the chart's axis stays where it was, which reads as a rail that ignores the reader
     * rather than as an inversion - so it is computed in one place and pinned by a test.
     *
     * @returns `{ y, height }` in viewBox pixels, height floored at 1 so a fully-zoomed window is still
     *   a visible line rather than a zero-height rect that draws nothing at all.
     */
    function railWindowPixels(range, extent, innerHeight, top = CHART.padTop) {
      const span = extent.hi - extent.lo
      const project = (value) => top + innerHeight - ((value - extent.lo) / span) * innerHeight
      const yHi = project(range.hi)
      const yLo = project(range.lo)
      return { y: Math.min(yHi, yLo), height: Math.max(1, Math.abs(yLo - yHi)) }
    }

    /**
     * The value axis' own readout: which two values the frame's top and bottom hold.
     *
     * NOT `rangeLabel`, because these are not counts. A leg number is an integer and rounding it is
     * free; a bits-per-byte value lives between 2.14 and 2.15 on the run this was written for, so
     * rounding it to an integer would print the same window at every zoom level - "2 to 2" is not a
     * window. The figures come from the series' own `formatValue` with extra digits, exactly as the
     * chart's tick labels do, so a readout and the ticks beside it cannot disagree about precision.
     */
    function valueWindowLabel(range, digits = 3) {
      if (range === null || range === undefined) return 'the whole extent'
      // `+ 3` is the same allowance `axisTickLabels` makes when it needs to tell two near-identical
      // ticks apart: three more decimals than the series asks for is enough that a window whose ends
      // differ are printed as differing.
      const show = (value) => formatValue(value, digits + 3)
      return `${show(range.lo)} to ${show(range.hi)}`
    }


    // ----------------------------------------------------------------------
    // Break markers.
    //
    // The chart used to carry ONE break: the producer's `break_leg`, a constant.
    // A snapshot carries `breaks` instead, a list of markers the producer derived
    // from its own artifacts, each with a KIND — and the kinds do not mean the
    // same thing, which is the whole reason to draw them differently:
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
    //
    // AND NOTHING HERE PREDICTS ONE. The tab used to draw a FRONTIER: the corpus
    // change the producer expected next, as a dashed line at the leg its budget
    // put it at, with a block of text under the register. Removed on 13 October
    // 2026 at the user's instruction — "next corpus change prediction should be
    // removed. it's unnecessary and wrong as well" — because the projection
    // divided a phase's budget by one leg's volume while a visit actually ends
    // when its read goes FLAT, so it printed a leg 686 ahead of the run as a
    // fact. What a reader still needs to know about a corpus change — that it
    // raises the reading and is not a regression — is said at each change that
    // HAPPENED, by the marker's own reason and meaning.
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
      // A left-pointing band, because a rollback is a REWIND: the one kind whose
      // joint the leg numbers do not order, since the weights on the right of it
      // are older than the weights on the left.
      rollback: 'chevron',
      // AN UPWARD BAND, which is the rollback's chevron turned on its side: the
      // only two kinds that move the MODEL rather than the reading, one taking
      // capacity away by rewinding and the other adding it. A growth is drawn on
      // EVERY chart, including the ones whose own quantity it does not move, so
      // it has to be recognisable where nothing else on the frame changed.
      growth: 'chevron-up',
      [UNKNOWN_KIND]: 'plus',
    }

    /** The shape one hand of kinds is drawn as; an unseen kind is a plus. */
    function markerShape(kind) {
      return MARKER_SHAPES[kind] ?? MARKER_SHAPES[UNKNOWN_KIND]
    }

    /**
     * The leg where the newest ROLLBACK happened, or null when the run has none.
     *
     * The values to the LEFT of it are a chain the controller threw away: on
     * 10 October 2026 the run rolled back to its START at leg 209 and carried on
     * numbering from 210, so the reading jumps at that joint for a reason that is
     * not the model. The chart draws those older values as a GHOST - dimmed and
     * dashed, on the same axis, because the axis is the record and dropping them
     * would make the run look shorter than it is - and the switch beside the key
     * lets the reader take them off the picture.
     *
     * READ FROM THE WHOLE MARKER LIST AND NOT THE VISIBLE ONE: a reader who
     * switches the ROLLBACK category off is asking not to see the marker, not to
     * be shown a chart where the discarded chain looks live again.
     */
    function rollbackPoint(markers) {
      let leg = null
      for (const marker of markers ?? []) {
        if (marker !== null && marker.kind === 'rollback' && Number.isFinite(marker.leg)) {
          leg = leg === null ? marker.leg : Math.max(leg, marker.leg)
        }
      }
      return leg
    }

    /** The older-run values and the live ones, split at a ghost leg. */
    function splitOlder(points, ghostLeg) {
      if (!Number.isFinite(ghostLeg)) return { older: [], live: [...(points ?? [])] }
      const older = []
      const live = []
      for (const point of points ?? []) {
        (point[0] <= ghostLeg ? older : live).push(point)
      }
      return { older, live }
    }

    /** Whether the older run's values are on the chart at all. */
    function olderIsShown(markers, hideOlder) {
      return rollbackPoint(markers) !== null && hideOlder !== true
    }

    /**
     * THE KIND'S COLOUR, WRITTEN ON THE ELEMENT AS WELL AS IN THE SHEET.
     *
     * WHY TWICE, and this is the second time this file has paid for it. The
     * stylesheet sets `--dshtd-kind` per kind and the elements that READ it are
     * the chart's mark, its swatch, the register's swatch and badge, and the
     * category switches' icons. A custom property that is never SET on an element
     * makes `fill: var(--dshtd-kind)` invalid at computed-value time, and an SVG
     * shape with no fill is BLACK — so the switches under the chart came out as
     * black diamonds and triangles with nothing to tell the kinds apart, exactly
     * the defect reported on 10 October 2026. The values here are the sheet's own
     * fallbacks (see the `--dshtd-kind` rules), so the two cannot name different
     * colours; a test reads both and fails if they drift.
     */
    const KIND_INK = {
      corpus: '#3fa06b',
      instrument: '#8f7ff0',
      arithmetic: '#e05252',
      shape: '#e0a13f',
      restart: '#5aa9e6',
      // Rose, and distinct from the arithmetic red on purpose: a rollback is not
      // a change to how the numbers are computed, it is the numbers themselves
      // going backwards.
      rollback: '#d1567e',
      // Teal, and the only ink that is not a warning: a growth is the run doing
      // the thing it is for, so it must not read as one of the four kinds that
      // say a measurement stopped being comparable.
      growth: '#2ec4b6',
      [UNKNOWN_KIND]: '#9aa0a6',
    }

    /** The ink for one kind of joint; an unseen kind takes the fallback grey. */
    function kindInk(kind) {
      return KIND_INK[kind] ?? KIND_INK[UNKNOWN_KIND]
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
      }
    }

    /**
     * The markers a snapshot serves, oldest leg first, and what could not be used.
     *
     * `payload.breaks` is the producer's list, every entry derived from an artifact the run wrote. THE
     * OLDER SINGLE-BREAK KEY IS NO LONGER FOLDED IN, and it was the "NO KIND" row the user asked to
     * remove on 13 October 2026: "also remove the NO KIND marker at leg 642 or whatever". That key was
     * `break_leg`, one constant naming a joint of an ARC the snapshot no longer charts, and because it
     * carried no kind the register could only say so - a marker whose whole content was that it
     * claimed nothing, drawn on a run that had not trained the leg. A marker with no readable leg
     * cannot be placed on an axis at all, so it is counted and reported rather than dropped in
     * silence.
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
     * @param ink - the fill to write ON THE SHAPE, or null to leave it to the
     *   sheet. `'none'` is a fill value like any other, and a presentation attribute loses to any CSS
     *   rule that applies, so the sheet still wins wherever it is applied and the
     *   shape is never black where it is not.
     * @param strokeInk - the outline, for a swatch drawn unfilled.
     * @returns the SVG element for the swatch.
     */
    function markerSwatch(shape, cx, cy, key, className = CLASS.markerSwatch,
                          ink = null, strokeInk = null) {
      const radius = MARKER_SWATCH_SIZE / 2
      const common = { key, className }
      if (ink !== null) common.fill = ink
      if (strokeInk !== null) common.stroke = strokeInk
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
      if (shape === 'chevron') {
        // A LEFT-POINTING BAND: the shape of a rewind, and distinct at 7 units
        // from every other kind's shape.
        const thick = (radius * 2) / 3
        return React.createElement('polygon', { ...common, points: points([
          [cx + radius, cy - radius], [cx - radius, cy], [cx + radius, cy + radius],
          [cx + radius - thick, cy + radius], [cx - radius + thick, cy],
          [cx + radius - thick, cy - radius],
        ]) })
      }
      if (shape === 'chevron-up') {
        // AN UPWARD BAND: the shape of a growth, and the rollback's chevron
        // turned on its side. Distinct at 7 units from every other kind's shape,
        // and the only one that needs no word beside it to be read as the model
        // getting bigger.
        const thick = (radius * 2) / 3
        return React.createElement('polygon', { ...common, points: points([
          [cx - radius, cy + radius], [cx, cy - radius], [cx + radius, cy + radius],
          [cx + radius - thick, cy + radius], [cx, cy - radius + thick],
          [cx - radius + thick, cy + radius],
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
      // The bar, which is the fallback shape: a marker whose kind this tab has no shape for still gets
      // a mark, and the register below names the kind in the producer's own word. It used to be the
      // DECLARED joint's shape, for the snapshot's `break_leg`; that marker is gone (see
      // `readBreakMarkers`), so the shape belongs to `UNKNOWN_KIND` alone.
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

    // THE FRONTIER IS GONE. This tab used to read `payload.frontier` — the next corpus change the
    // producer expected, the leg it put it at, and whether a rise was expected there — draw it as a
    // dashed line, switch it from the register's key, and set the producer's own sentence under this
    // tab's caveat. Removed on 13 October 2026 at the user's instruction: "next corpus change
    // prediction should be removed. it's unnecessary and wrong as well." It was wrong in its premise —
    // the projection divided a phase's budget by one leg's volume, while a visit actually ends when
    // its read goes FLAT, so a run four legs old was told its next corpus change was 686 legs away —
    // and a chart of what happened does not need to guess at what will. WHAT A READER STILL NEEDS is
    // that a corpus change raises the reading and is not a regression, and that is said at every
    // change that HAPPENED: by each CORPUS marker's own reason and meaning, and by the note the
    // producer serves as `BREAKS/what_was_expected`.
    /** Everything the chart and the register need from one snapshot body. */
    function breakView(payload) {
      const read = readBreakMarkers(payload)
      return { markers: read.markers, skipped: read.skipped }
    }

    // ----------------------------------------------------------------------
    // The second line: the seed model's size, on the axis on the right.
    // ----------------------------------------------------------------------

    /**
     * The label and unit one overlay tag is drawn with.
     *
     * A tag this file has never heard of keeps its OWN name and no unit, for the
     * same reason a chip does: a producer is free to emit whatever series names
     * its run uses, and a tab that renamed one would be telling the reader it
     * knew what the number was when it did not.
     */
    function overlayLabel(tag) {
      if (tag === 'train/seed_model_params') {
        return { label: 'seed model size', unit: 'M params', digits: 2, scale: 1e-6, axis: LOG_SCALE }
      }
      if (tag === 'train/seed_read_rows') {
        return { label: "seed read's live rows", unit: 'rows', digits: 0, scale: 1, axis: LINEAR_SCALE }
      }
      if (tag === 'train/seed_trainable_rows') {
        return { label: 'seed trainable rows', unit: 'rows', digits: 0, scale: 1, axis: LINEAR_SCALE }
      }
      return { label: tag, unit: '', digits: 3, scale: 1, axis: LINEAR_SCALE }
    }
    /**
     * The series drawn as the second line, or null when the payload has none.
     *
     * Best source first: the TOTAL parameter count is the headline number, and
     * the read's row count is the fallback for a producer that serves only the
     * table growth moves. One line and never two - the whole point of putting
     * this on the chart is that the reader does not have to choose - so the
     * first tag the payload actually carries wins and the rest are not drawn.
     *
     * A series with no usable point is not an overlay: an empty scale on the
     * right of the frame would be a second axis with no numbers to put on it.
     */
    function resolveOverlay(payload) {
      const index = seriesIndex(payload)
      for (const tag of OVERLAY_TAGS) {
        const item = index.get(tag)
        if (item !== undefined && item.points.length > 0) {
          // `series` keeps the shape a chip's spec has, so the chart reads the
          // overlay's points the same way it reads the selected series' points.
          return { tag, series: item, ...overlayLabel(tag) }
        }
      }
      return null
    }

    /**
     * One series' value at an x, linearly interpolated, or null outside it.
     *
     * The two lines do not share an x sampling: the curve is one reading a leg
     * and the size is one reading a leg, but the two logs do not cover the same
     * legs, and a growth is a STEP. Interpolating between the bracketing samples
     * draws that step as a slope one leg wide, which is the honest reading of a
     * quantity that is only ever measured at a leg boundary. Outside the
     * series' own extent the answer is null rather than the nearest value,
     * because carrying the last size forward would draw a line claiming the
     * model was that size at legs nobody measured.
     *
     * @param points - the overlay's points, ascending in x.
     * @param x - the x to read at.
     * @returns the value, or null when x is off either end.
     */
    function valueAtX(points, x) {
      if (!Array.isArray(points) || points.length === 0) return null
      if (x < points[0][0] || x > points[points.length - 1][0]) return null
      for (let at = 1; at < points.length; at += 1) {
        const [hiX, hiY] = points[at]
        if (hiX >= x) {
          const [loX, loY] = points[at - 1]
          if (hiX === loX) return hiY
          const fraction = (x - loX) / (hiX - loX)
          return loY + fraction * (hiY - loY)
        }
      }
      return points[points.length - 1][1]
    }

    /**
     * The samples to draw for the second line, in the main chart's own x space.
     *
     * The overlay is resampled onto the SELECTED series' x values, so the two
     * lines are drawn in one coordinate system: the curve steps where it has
     * readings and the size line steps where IT has readings, and neither is
     * stretched onto the other's grid. A run of x values the overlay does not
     * cover breaks the path, so the line stops where the measurements stop
     * instead of cutting a chord across legs nobody measured.
     *
     * @param points - the overlay's points, ascending in x.
     * @param xs - the x values to sample at, ascending.
     * @returns an array of segments, each an array of `[x, value]` pairs.
     */
    function resampleOnto(points, xs) {
      const segments = []
      let run = []
      for (const x of xs) {
        const value = valueAtX(points, x)
        if (value === null) {
          if (run.length > 0) segments.push(run)
          run = []
        } else {
          run.push([x, value])
        }
      }
      if (run.length > 0) segments.push(run)
      return segments
    }

    /**
     * The gridlines the frame draws, in the CHART's own coordinates.
     *
     * ONE SET OF HORIZONTAL LINES, AND ITS SPACING IS THE SCALE'S. When the
     * second line is on a log axis the gridlines are at that axis' marks, which
     * are equal RATIOS apart in value and so land at exponential intervals;
     * when no second line is drawn they are the primary axis' regular ones.
     * BOTH axes then LABEL the same lines, which is what makes the frame read as
     * one frame rather than as two charts sharing a rectangle.
     *
     * The interval comes out exponential for free, and that is worth stating
     * because it looks like an even ladder on screen: on a log axis a constant
     * distance IS a constant ratio, so marks a quarter of the frame apart are
     * values 1.09x apart, then 1.10x, then 1.12x - equal heights, unequal
     * additions. The other axis quotes those same lines in its own terms.
     *
     * WHY NOT ONE SET PER AXIS. Two sets would put lines at two different
     * spacings over one another, and half of each would be a line no label sits
     * on - which is not a grid but a texture. So every line is a mark that BOTH
     * scales quote a value for, and the reader reads each one twice, once per
     * side.
     *
     * The lines are placed by the caller's own projection functions, the ones
     * the series are drawn with, so a line lands exactly where a sample of that
     * value lands. Laying them out separately is how a gridline drifts a pixel
     * off the value it names.
     *
     * @param primary - the primary axis' own ticks, for a linear overlay.
     * @param overlayTicks - the overlay axis' ticks, which rule when it is log.
     * @param overlayIsLog - whether the overlay is the axis whose marks rule.
     * @param projectPrimary - value to chart-space y, on the primary axis.
     * @param projectOverlay - value to chart-space y, on the overlay axis.
     * @returns `{ lines, extra }`: every line, with the primary axis' own value
     *   and the overlay's beside it; and the overlay ticks that fall between
     *   those lines, which the overlay axis still has to label.
     */
    function sharedGridlines(primary, overlayTicks, overlayIsLog,
      projectPrimary, projectOverlay) {
      const onLogGrid = (value) => {
        if (!(value > 0) || typeof projectOverlay !== 'function') return false
        const exponent = Math.log10(value)
        const distance = Math.abs(exponent - Math.round(exponent * 10) / 10)
        return distance < 1e-9
      }
      if (overlayIsLog && overlayTicks.length > 0) {
        const placed = overlayTicks.map((value) => ({ value, y: projectOverlay(value) }))
          .filter((entry) => entry.y !== null && Number.isFinite(entry.y))
        if (placed.length > 0) {
          // The primary axis reads the same lines, so its value at one is the
          // inverse of its own projection - asked of the projection itself, so
          // the two can never be computed from different frames.
          const lines = placed.map((entry) => ({
            y: entry.y,
            overlayValue: entry.value,
            primaryValue: inverseOf(projectPrimary, entry.y),
          }))
          return { lines, extra: [] }
        }
      }
      const lines = primary.map((value) => {
        const y = projectPrimary(value)
        // A primary tick that lands on an overlay mark is that same line, and is
        // written once, with both values on it. `onLogGrid` is the test, because
        // the overlay's marks are exactly the powers of ten on its own grid.
        const overlayValue = overlayIsLog && onLogGrid(value) ? value : null
        return { y, primaryValue: value, overlayValue }
      })
      const extra = overlayIsLog
        ? overlayTicks
          .filter((value) => onLogGrid(value))
          .filter((value) => !lines.some((line) => line.overlayValue === value))
          .map((value) => ({ value, y: projectOverlay(value) }))
          .filter((entry) => entry.y !== null && Number.isFinite(entry.y))
        : []
      return { lines, extra }
    }

    /**
     * The value an axis' own projection puts at a chart-space y.
     *
     * Solved by bisection on the projection rather than by an algebra written
     * out again here: a second formula would be free to disagree with the
     * drawing, and then a gridline's label would name a value the line is not on.
     */
    function inverseOf(project, y) {
      if (typeof project !== 'function' || !Number.isFinite(y)) return null
      // A generous bracket, then sixty halvings - well past the precision of a
      // 240-unit plot, and cheap because nothing here is called per sample.
      let low = 0
      let high = 1
      for (let grow = 0; grow < 200; grow += 1) {
        const atLow = project(low)
        const atHigh = project(high)
        if (atLow === null || atHigh === null) return null
        if ((atLow - y) * (atHigh - y) <= 0) break
        if (Math.abs(atLow - y) < Math.abs(atHigh - y)) low -= (high - low)
        else high += (high - low)
      }
      for (let step = 0; step < 60; step += 1) {
        const middle = (low + high) / 2
        const at = project(middle)
        if (at === null) return null
        if ((at - y) * (project(low) - y) <= 0) high = middle
        else low = middle
      }
      return (low + high) / 2
    }

    /**
     * One axis tick's text: the number, and ONLY the number.
     *
     * The unit used to ride the top tick, which said the same thing on a line
     * meant for a value and cost the reading its width: `22.00 M params` is
     * wider than any gutter worth taking out of the plot, so it either ran out
     * of the frame or pushed the curve into a column. Each axis carries its unit
     * ONCE, rotated up its outer edge, where the height pays for it - see
     * `axisUnitTitle`. A scale whose marks already carry a suffix (`22.0 M`)
     * does not repeat it here either.
     */
    function axisLabelText(value, spec) {
      return formatValue(value, spec.digits)
    }

    /**
     * A unit with the scale mark the value formatter already writes taken off.
     *
     * `formatValue` writes 22 million as `22.2M`, so the `M` is already on the
     * label and a unit that LEAD WITH IT would write `22.2M M params`. The scale
     * mark stays with the numbers, where a reader comparing two of them needs
     * it; this returns the word it stands for. Shared with the rotated axis
     * title, which must not repeat the mark either.
     */
    function unitWithoutScale(unit) {
      const text = typeof unit === 'string' ? unit : ''
      const suffix = /^(k|M)\s+(.+)$/.exec(text)
      return suffix === null ? text : suffix[2]
    }

    /**
     * Where each current-value label sits, so no two overlap and none leaves the
     * frame.
     *
     * A label floats just above the newest reading of its own line, because a
     * number beside the line it belongs to needs no legend to be read, and the
     * two lines are the whole point of the frame. They are then pushed apart
     * where two lines end at nearly the same height - a size axis that barely
     * moves against a bpb curve that swings widely will do that often - and
     * clamped inside the frame so a line ending at the very top or bottom does
     * not write its reading off the edge.
     *
     * @param wanted - one `{ kind, y }` per line, `y` in chart coordinates.
     * @param top - the first row a label may occupy.
     * @param bottom - the last row a label may occupy.
     * @returns one `{ kind, y }` per label that can be placed, in the order
     *   given; a line with no position contributes nothing.
     */
    function currentValueLabels(wanted, top, bottom) {
      // **THE READING SITS ON ITS OWN LINE, AND THIS IS THE FIX FOR IT NOT DOING SO.**
      //
      // MEASURED, the user, 16 October 2026: *"On the left of the graph we see the actual numbers for the
      // currently selected metric as well as the parameter number of parameters. And they don't seem to line
      // up properly with the actual value of the actual position in the graph. It seems to be either above or
      // below where it should be."*
      //
      // The old expression was `entry.y - CURRENT_VALUE_OFFSET` with that constant at **16**: every reading
      // floated **sixteen pixels above the value it named** - about two text-heights - so a line at y=100 was
      // labelled at y=84. The offset existed for a good reason, stated in its own comment (*"a number written
      // over the curve is a number nobody can check"*), **but the reason was never a reason for 16.**
      //
      // **THE TEXT IS CENTRED ON THE LINE'S OWN PIXEL NOW.** `LABEL_BASELINE` is the half-height of the label
      // text, so `y + LABEL_BASELINE` puts the glyphs' vertical CENTRE on the value - which is the property a
      // reader is checking when they compare the number against the line.
      //
      // AND THE COLLISION PUSH STAYS, because two lines ending within a few pixels of each other would
      // otherwise write one reading over the other. **It is reported rather than silent**: a pushed label
      // carries `movedBy`, so the drawing code can keep its rail at the LINE's height while the number steps
      // aside - the mark stays true even when the text cannot.
      const placed = (wanted ?? [])
        .filter((entry) => entry !== null && entry !== undefined && Number.isFinite(entry.y))
        .map((entry) => ({
          ...entry,
          lineY: entry.y,
          y: Math.min(Math.max(entry.y + LABEL_BASELINE, top), bottom),
        }))
        .sort((left, right) => left.y - right.y)
      for (let at = 1; at < placed.length; at += 1) {
        const gap = placed[at].y - placed[at - 1].y
        if (gap < CURRENT_VALUE_MIN_SEPARATION) {
          placed[at].y = placed[at - 1].y + CURRENT_VALUE_MIN_SEPARATION
        }
      }
      // The push may have carried the lowest label past the frame; pull the whole
      // stack back up rather than letting it be clipped.
      const overflow = placed.length === 0 ? 0 : placed[placed.length - 1].y - bottom
      if (overflow > 0) {
        for (const entry of placed) entry.y = Math.max(entry.y - overflow, top)
      }
      return placed
    }

    /**
     * One axis tick's text: the number, and NOTHING ELSE.
     *
     * Each axis names its unit exactly ONCE, in the title rotated up its outer
     * edge, and the tick labels beside it are bare numbers. Writing the unit on
     * a label as well says it twice within a few pixels of itself - `params`
     * standing up at the edge and `17.4M params` lying beside the top tick - and
     * a frame that repeats itself is a frame with less room for its numbers. The
     * legend under the chart names both units in full for anyone who wants them
     * spelled out.
     *
     * The labels are still made DISTINCT of one another, because the gridlines
     * are shared between the two axes: a tick's value is whatever the series is
     * worth where the line falls, not a round number the axis chose, so two of
     * them can round to the same text. Two gridlines labelled alike is a scale
     * that cannot be read, so a colliding label takes one more decimal until it
     * does not.
     *
     * @param values - the tick values, in the order they are to be written.
     * @param spec - the series spec, for its `digits`.
     * @returns one label per value, in the same order.
     */
    function axisTickLabels(values, spec) {
      if (!Array.isArray(values) || values.length === 0) return []
      const digits = Number.isFinite(spec.digits) ? spec.digits : 3
      for (let extra = 0; extra <= 6; extra += 1) {
        const labels = values.map((value) => formatValue(value, digits + extra))
        if (new Set(labels).size === labels.length) return labels
      }
      // More precision than this and the label no longer fits the gutter; the
      // last attempt is returned so the axis is still drawn.
      return values.map((value) => formatValue(value, digits + 6))
    }

    /**
     * The unit of an axis, drawn ROTATED up its outer edge.
     *
     * An axis without its unit is a column of numbers a reader has to guess the
     * meaning of, and a unit written flat beside the top tick does not fit
     * beside a number: `22.00 M params` is wider than any gutter worth taking
     * out of the plot, which is how it came to run out of the window. So the
     * title stands up, and the chart's HEIGHT pays for it instead of the curve's
     * width. Reading it bottom-to-top is the convention for a right-hand axis;
     * the rotation is a TRANSFORM on one text element, so the rest of the frame
     * stays upright.
     *
     * THE SCALE MARK IS NOT REPEATED, which is the other half of the same fix.
     * `formatValue` already writes a value of 22 million as `22.0M`, so the
     * marks carry the `M` and this title carries the word it stands for: the
     * suffix is stripped here and said once, in the marks, where a reader
     * comparing two ticks needs it. A title repeating it would put `M` in both
     * places for one fact.
     *
     * @param unit - the unit string, from the series spec.
     * @param x - the x the text is anchored at.
     * @param top - the top of the plot.
     * @param height - the height of the plot.
     * @param side - `'left'` or `'right'`: which way the glyphs face.
     * @returns the text element, or null when there is no unit left to write.
     */
    function axisUnitTitle(unit, x, top, height, side) {
      // The scale mark belongs with the numbers, so the title carries only the
      // word it stands for - `unitWithoutScale` is the one rule for that, shared
      // with the topmost tick label so the axis cannot say it twice.
      const text = unitWithoutScale(unit)
      if (text === '') return null
      return React.createElement('text', {
        className: side === 'right' ? CLASS.overlayAxis : CLASS.axis,
        transform: `rotate(-90 ${x} ${top + height / 2})`,
        x, y: top + height / 2,
        textAnchor: 'middle',
        // The legend and the accessible name already carry the unit in full, so
        // a screen reader is not read a second copy of it per axis.
        'aria-hidden': 'true',
      }, text)
    }

    // ----------------------------------------------------------------------
    // The marker categories the reader can switch off.
    //
    // The chart used to draw every category unconditionally. On a run with
    // eight joints across fifty legs that is unreadable, and the reader's only
    // recourse was to zoom past the cluster they wanted to understand. So the
    // key under the chart is now also the switch: each category is a button,
    // and a switched-off category stops being drawn ON THE CHART, ON THE STRIP
    // and IN THE REGISTER.
    //
    // NOTHING IS HIDDEN SILENTLY. The register keeps saying how many markers
    // there are and how many the switch is holding back, and every count on
    // screen is stated twice - the markers of that category, and the markers on
    // screen - so a reader can always tell "there is nothing here" from "I
    // turned this off". That distinction is the whole reason the counts exist.
    // ----------------------------------------------------------------------

    /**
     * The second line's y scale is named by `LOG_SCALE` / `LINEAR_SCALE`, set
     * once in `overlayLabel` and read by `isLogScale`.
     */

    /**
     * Where a value sits on a log axis, as a fraction from the bottom.
     *
     * A value outside the axis returns null, which the caller draws as a GAP:
     * at or below the floor there is no place for it on a log axis, and above
     * the top it is off the frame. Clamping either would draw a reading at a
     * position the scale does not support.
     *
     * THE BELOW-THE-FLOOR CASE WAS MISSING, and it is the defect that hid a
     * whole stretch of this chart. The guard tested `lo > 0` - whether the axis
     * could be logged at all - and not whether the VALUE was above it, so a
     * reading below the floor came back as a negative fraction rather than null.
     * A negative fraction is a perfectly ordinary number to the projection, so
     * the reading was drawn BELOW the bottom of the plot rather than dropped as
     * a gap: the tab reported "769 of 769 readings drawn" while the early ones
     * were off the canvas, which is exactly the silent absence this module's
     * comments claim it does not do.
     */
    function logFraction(value, lo, hi) {
      if (!Number.isFinite(value) || !(value > 0)) return null
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(lo > 0) || !(hi > lo)) return null
      if (value < lo || value > hi) return null
      return (Math.log10(value) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))
    }

    /**
     * A range for a log axis: the readings' own span, with a band under it.
     *
     * SOLVED GEOMETRICALLY, because that is the only way to get the property
     * this axis exists for. The floor `f` is placed so that the axis' total
     * height is `span / (1 - LOG_FLOOR_PADDING)` decades, where `span` is the
     * data's own log-range - which puts the smallest reading exactly
     * `LOG_FLOOR_PADDING` of the height above the floor, and the whole run
     * across the remaining 92 percent of the frame.
     *
     * Two rules were tried here first and both were wrong in the same direction:
     * a floor at a fixed fraction of the MAXIMUM (a quarter) left a 1.30x run
     * drawn in the top 19 percent of the frame, and taking the lower of that and
     * the data's minimum pinned the floor to the minimum itself, so a window of
     * near-identical readings started at 81 percent of the height. In each case
     * the data sat in a corner of an axis that had been widened for no reason -
     * the flattening a log axis is chosen to avoid.
     *
     * A reading below the floor has no place on the axis and is dropped by
     * `logFraction`, which the caller draws as a gap.
     *
     * @param points - the overlay's samples in the window.
     * @param fallback - the range to keep when there is nothing to scale to.
     */
    function logRange(points, fallback) {
      if (!Array.isArray(points) || points.length === 0) return fallback
      const positive = points.map((point) => point[1]).filter((value) => value > 0)
      if (positive.length === 0) return fallback
      const top = Math.max(...positive)
      const bottom = Math.min(...positive)
      if (!(top > 0) || !(bottom > 0)) return fallback
      if (top === bottom) {
        // One reading, or a flat window: the band is the padding on its own.
        const decade = 1 / (1 - LOG_FLOOR_PADDING)
        return { lo: top / Math.pow(10, decade - 1), hi: top }
      }
      // `span` in decades, then the total height that puts the padding under it.
      const span = Math.log10(top) - Math.log10(bottom)
      const lo = Math.pow(10, Math.log10(bottom) - span * LOG_FLOOR_PADDING / (1 - LOG_FLOOR_PADDING))
      if (!(lo > 0) || !(top > lo)) return fallback
      return { lo, hi: top }
    }

    /**
     * Round tick values for a log axis, at EVEN intervals up the scale.
     *
     * One, two and five per decade are the numbers a reader recognises on a log
     * scale, so those are the candidates. But taking all of them inside a narrow
     * range puts marks at uneven POSITIONS: a range from 16.7M to 22.2M holds
     * 20M and 22M, which sit about 2M and 0.2M apart - nearly equal distances on
     * the frame for values a hundredth as far apart. A reader reads that as a
     * mistake in the data.
     *
     * So the candidates are thinned to a MULTIPLE OF ONE RATIO: `1/2^n` of a
     * decade, the finest that still fits `count` marks. Every adjacent pair is
     * then the same distance up the axis and the same ratio in value, which is
     * what a log scale's marks mean.
     *
     * Ticks outside the range are dropped rather than clamped - a tick at the
     * frame's edge that names a value the axis does not reach is a misreading
     * waiting to happen.
     */
    function logTicks(lo, hi, count = 5) {
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(lo > 0) || !(hi > lo)) return []
      const from = Math.log10(lo)
      const to = Math.log10(hi)
      // The mark budget is the tighter of what the caller asked for and what the
      // spacing floor allows: two marks closer than LOG_TICK_MIN_GAP of the
      // height are one blur.
      const budget = Math.min(count, Math.floor(1 / LOG_TICK_MIN_GAP) + 1)
      // The interval index runs over positions `step * LOG_TICK_STEPS` decades,
      // starting at the decade below the range - which is where a value like 20M
      // has to be reached from, since stepping from 16.6M's own decade at a half
      // decade at a time would never land on it.
      const firstStep = Math.round((Math.floor(from) - 1) * 2)
      const ticksFor = (interval) => {
        const ticks = []
        for (let step = firstStep; ; step += 1) {
          const exponent = step * interval / 2
          if (exponent > to + 1e-9) break
          const value = Math.pow(10, exponent)
          // A RELATIVE tolerance, because the marks are powers of ten and
          // `Math.pow` does not return them exactly: `Math.pow(10, 9)` is
          // 1000000000.0000001, which a bare `value <= hi` rejects - so every
          // interval quietly lost the mark on the axis' own top, and a range from
          // 1 to 1e9 came out with no marks at all.
          if (value >= lo * (1 - 1e-12) && value <= hi * (1 + 1e-12)) ticks.push(value)
        }
        return ticks
      }
      // THE FINEST INTERVAL THAT FITS THE BUDGET, walking the grid from fine to
      // coarse, so the axis carries as much of the scale as it has room for. The
      // grid must be NESTED for any of this to mean anything: each step below is
      // 1, 2 or 5 tens of the one before, so a coarser set is always a subset of
      // a finer one and "the most marks that fit" is well defined.
      const space = Math.log10(5)
      let interval = Math.pow(10, -Math.ceil(-Math.log10(to - from) / space) * space)
      for (let guard = 0; guard < 64; guard += 1) {
        const ticks = ticksFor(interval)
        if (ticks.length >= 2 && ticks.length <= budget) return ticks
        interval *= 2
        if (interval > (to - from) + 1e-9) break
      }
      // Nothing on the grid lands on two marks inside the budget. Take what the
      // floor's own allowance gives and thin it evenly, because an axis with a
      // crowded scale still beats an unmarked one.
      const finest = ticksFor(Math.pow(10, -Math.ceil(-Math.log10(to - from) / space) * space))
      if (finest.length < 2) return finest
      const room = Math.floor(1 / LOG_TICK_MIN_GAP) + 1
      const stride = Math.ceil(finest.length / room)
      const thinned = finest.filter((_tick, at) => at % stride === 0)
      const last = finest[finest.length - 1]
      if (thinned[thinned.length - 1] !== last) thinned.push(last)
      return thinned
    }

    /**
     * Marker categories: whether each is drawn, and how many markers it holds.
     */

    /**
     * The two line colours, as literal values, and why they are written twice.
     *
     * The stylesheet sets them with the theme tokens, and the theme tokens are
     * right: a renamed token degrades the look rather than breaking the render.
     * But a fill that exists ONLY in the stylesheet is a fill that is absent
     * whenever the sheet is not applied - and an SVG `text` with no fill is
     * BLACK, which is what a reader saw over a dark frame when the current-value
     * labels first shipped. So each element carries the same colour as a
     * presentation attribute as well, where nothing can take it away, and the
     * stylesheet keeps the token so a theme still wins.
     *
     * These are the fallbacks the stylesheet itself names, so the two cannot
     * drift apart into different colours.
     */
    const OVERLAY_INK = 'var(--dshtd-ink-overlay, #d9a441)'
    const PRIMARY_INK = 'var(--dshtd-ink-train, #7d92f0)'

    /**
     * How far below the data's own minimum a log axis puts its floor, as a
     * fraction of the axis' total height.
     *
     * EIGHT PERCENT, and both halves of that are deliberate. The floor must sit
     * BELOW the smallest reading, or the reading is off the axis and the line
     * starts somewhere other than its own beginning. And it must not sit far
     * below it, or the axis spends height on a scale the data does not use: a
     * floor at a quarter of the MAXIMUM - this function's first rule, and the
     * wrong one - leaves the whole 1.30x run drawn in the top 19 percent of the
     * frame, which is the same flattening a zero-anchored linear axis causes.
     * Eight percent below the minimum puts the run across 92 percent of the
     * height, and the band left under it is the visual "this is where it
     * started" that a linear axis gets from its zero.
     */
    const LOG_FLOOR_PADDING = 0.08

    /**
     * The closest two marks on a log axis may sit, as a fraction of its height.
     *
     * Eight percent, which is about sixteen chart units at this frame's plot
     * height - enough for two tick labels not to read as one. Marks closer than
     * this are dropped by widening the interval between them, never by thinning
     * an uneven set: see `logTicks`.
     */
    const LOG_TICK_MIN_GAP = 0.08

    /** Whether one marker's category is switched on. */
    function kindIsShown(hiddenKinds, kind) {
      return !(hiddenKinds ?? []).includes(kind)
    }

    /** The markers whose category is switched on, in leg order. */
    function shownMarkers(markers, hiddenKinds) {
      return (markers ?? []).filter((marker) => kindIsShown(hiddenKinds, marker.kind))
    }

    /**
     * The markers inside a window, in leg order.
     *
     * `at` MAPS A LEG TO THE X THE WINDOW IS IN, and defaults to the leg itself.
     * On a run that has rolled back the window is measured from each pass's own
     * first leg, so a marker on the live chain at leg 250 sits at x=40: comparing
     * its leg to the window would report it as out of a window it is inside.
     */
    function markersInWindow(markers, range, at = (leg) => leg) {
      if (range === null || range === undefined) return markers ?? []
      return (markers ?? []).filter((marker) => {
        const x = at(marker.leg)
        return x >= range.lo && x <= range.hi
      })
    }

    /**
     * The categories to offer a switch for, and each one's marker count.
     *
     * EVERY category present is offered, in the registered order and with an
     * unknown kind last and keeping its own name, because a category the reader
     * cannot switch off is a category they cannot get out of the way. A
     * category with no markers in this snapshot is not offered at all - a
     * switch for nothing is a control that does not work.
     *
     * @returns one `{ kind, word, count }` per category, in display order.
     */
    function markerCategories(markers) {
      const counts = new Map()
      for (const marker of markers ?? []) {
        counts.set(marker.kind, (counts.get(marker.kind) ?? 0) + 1)
      }
      const ordered = []
      for (const kind of KIND_ORDER) {
        if (counts.has(kind)) ordered.push(kind)
      }
      for (const kind of counts.keys()) {
        if (!ordered.includes(kind)) ordered.push(kind)
      }
      return ordered.map((kind) => ({
        kind,
        word: kind.toUpperCase(),
        count: counts.get(kind),
      }))
    }

    /** Whether any category is switched off, so the counts can say so. */
    function anyKindHidden(markers, hiddenKinds) {
      const categories = markerCategories(markers)
      return categories.some((entry) => !kindIsShown(hiddenKinds, entry.kind))
    }

    /** One category's switch label, and what it will do when pressed. */
    function toggleTitle(entry, shown) {
      // THE ROLLBACK'S SWITCH HIDES A RECORD AND NOT A LINE, and says so: since
      // both passes are drawn from one origin there is no line of its own to take
      // off the chart, and a reader who pressed it expecting the chart to change
      // would think the switch was broken.
      if (entry.kind === 'rollback') {
        return shown
          ? `${entry.count} rollback(s), recorded in the register below: the chart shows a rollback by `
            + 'drawing both passes from the same origin rather than by a line of its own. Press to '
            + 'hide the record.'
          : `${entry.count} rollback(s) hidden by you. Press to show them again.`
      }
      return shown
        ? `${entry.count} ${entry.word} marker(s) drawn. Press to hide this category.`
        : `${entry.count} ${entry.word} marker(s) hidden by you. Press to draw them again.`
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
     * `payload` is the whole snapshot body, so the markers come from the SAME
     * read as the series they annotate: taking them from the
     * polled state route instead would let the lines be one revision ahead of
     * the curve they sit on.
     */
    function SeriesChart({ spec, payload, overlay = null, hiddenKinds = [],
      hideOlder = false, onToggleKind = null,
      onToggleOlder = null }) {
      // AN EMPTY PRIMARY IS A REAL STATE: a bpb-less corpus still has a sealed bpb reading and the
      // history fan, and `availableSeries` offers the chip for those family lines. The chart's own
      // line is then empty on purpose - drawing the first family member here would duplicate it,
      // because `familyMembers` already draws it.
      const points = spec.primaryMissing === true ? [] : spec.series.points
      const breaks = React.useMemo(() => breakView(payload), [payload])
      // `null` IS the whole run, so "never zoomed" and "reset" are one state and
      // the readout cannot disagree with the picture. A window the reader left
      // is restored on the next mount, per series, for the same reason the series
      // choice is: this component is remounted by the pane, not by the reader.
      const [view, setView] = React.useState(() => rememberedWindow(spec.tag))
      //: The VERTICAL WINDOW, held exactly as the x window is and not as a factor on it.
      //:
      //: WHY A WINDOW AND NOT A SCALE FACTOR, which is what the first version of this used. A factor
      //: has to be multiplied against a base that the component RECOMPUTES on every render - the live
      //: chain's extent inside the current x window - so the same stored factor means a different
      //: axis each time the data or the x window moves. The reader drags the ruler, the axis jumps,
      //: and the control and the picture disagree about what was asked for. A window in the values'
      //: own units has no such coupling: it says which two values the frame's top and bottom hold,
      //: and it stays that statement until it is changed.
      //:
      //: IT ALSO LETS THE VERTICAL AXIS USE THE HORIZONTAL ONE'S OWN MECHANISM, which is what the user
      //: asked for: `zoomRange`, `panRange` and `clampRange` never mention the x data, so the buttons,
      //: the keys, the wheel and the drag below are the same code as the top-of-chart controls, aimed
      //: at a second window. `null` is auto, which is the same convention the x window uses.
      const [yView, setYView] = React.useState(() => rememberedYWindow(spec.tag))
      //: Whether the reader has asked for a value window that the default has since moved away from.
      //:
      //: `yView` ALONE CANNOT ANSWER THAT, which is the user's third correction of 11 October 2026: "the
      //: reset button should detect that the default has changed and it should become enabled." The
      //: default is not a constant - it is the live arc's span, and it MOVES as the arc trains - so a
      //: reader who touched the rail and then watched the run advance sits at a window that is still a
      //: legitimate choice but is no longer the default. This flag is set when they ask for something
      //: and cleared only when they ask for the default back.
      const [touchedY, setTouchedY] = React.useState(false)
      //: THE DEFAULT THE AXIS WORE WHEN THIS CHART OPENED, or null until the series' extents are known.
      //:
      //: A SNAPSHOT AND NOT A RUNNING VALUE, which is the whole difficulty: the default is the live
      //: arc's span, so a reference that tracked it could never detect that it had moved - it would be
      //: compared against itself and always agree. It is assigned once, below, at the first render that
      //: has an extent to record, and read only by the reset control's enablement.
      const [defaultAtMountY, setDefaultAtMountY] = React.useState(null)
      const [brush, setBrush] = React.useState(null)
      const hostRef = React.useRef(null)
      const brushRef = React.useRef(null)
      brushRef.current = brush
      // The seed model's size, when the snapshot carries it, drawn as a second
      // line against the axis on the right. Its own samples are resampled onto
      // this series' x values, so both lines live in one coordinate system.
      const second = overlay === null || overlay === undefined ? null : overlay
      // The markers whose category is switched on, in leg order.
      const markers = React.useMemo(() => shownMarkers(breaks.markers, hiddenKinds),
        [breaks, hiddenKinds])
      // Where the newest rollback stands, and whether the chain it threw away is
      // still on the chart. Read from `breaks.markers` - EVERY marker, not the
      // visible ones - because switching the ROLLBACK category off is a request
      // about the marker and not about whether the discarded values look live.
      const ghostAt = rollbackPoint(breaks.markers)
      const ghostIsShown = ghostAt !== null && hideOlder !== true
      // THE TWO PASSES SHARE AN ORIGIN, so a reader compares pass 2's third leg
      // with pass 1's third leg instead of hunting for the new chain at the far
      // right of an axis that starts at the run's first leg. The user's words,
      // twice: "start populating the latest value from the target point in the
      // graph so the x-axis remains consistent ... the new arc should start from
      // x=0, with the older arc ghosted". So on a run that has rolled back, a leg
      // is mapped to its distance from ITS OWN pass's first leg - the older chain
      // from the series' first leg, the live chain from the leg after the rollback
      // - and every point, marker and window below works in that x.
      // A run that has not rolled back keeps the leg number itself as x, byte for
      // byte as before.
      const origin = points.length > 0 ? points[0][0] : 0
      // NO ROLLBACK MEANS NO RE-BASING AT ALL: the offsets are 0 and a leg is its
      // own x, which is what every run before this one was drawn against.
      const olderOrigin = ghostAt === null ? 0 : origin
      const liveOrigin = ghostAt === null ? 0 : ghostAt + 1
      const chainX = (leg) => (ghostAt === null ? leg
        : (leg <= ghostAt ? leg - olderOrigin : leg - liveOrigin))
      // SPLIT BY LEG FIRST, THEN RE-BASE EACH CHAIN: the two chains OVERLAP in x
      // once they share an origin (legs 1..209 land on 0..208 and 210..213 on
      // 0..3), so they cannot be one array. Every helper below reads its input as
      // ASCENDING in x - bracketing a window, resampling, splitting at a joint -
      // and an array that jumps back to 0 in the middle of the run is not.
      const byLeg = React.useMemo(() => splitOlder(points, ghostAt), [points, ghostAt])
      const olderChain = React.useMemo(
        () => byLeg.older.map(([leg, value]) => [leg - olderOrigin, value]),
        [byLeg, olderOrigin])
      const liveChain = React.useMemo(
        () => byLeg.live.map(([leg, value]) => [leg - liveOrigin, value]), [byLeg, liveOrigin])
      // **AND THE FAMILY'S OTHER LINES JOIN THE EXTENT, so a corpus line the run left behind is still on the
      // picture rather than off the top of it.** The user's design asks for *"corpus/metric in the timeslot
      // where that value was present"* - by construction that is an EARLIER slot, when a previous phase was
      // training, and those values sit at a different height from the live curve. An axis scaled to the live
      // chain alone would draw them flat against an edge.
      //
      // THE MEMBERS ARE COMPUTED FROM THE PAYLOAD'S OWN INDEX, and `isFamily` keeps a one-line metric on
      // exactly the path it was on before this existed - which is the regression guard for every metric that
      // has no held-out and no corpus reading (`gnorm`, `read_layers`, `vocab_size`).
      const family = React.useMemo(() => {
        // **A MISSING PAYLOAD IS A NORMAL STATE AND NOT AN EXCEPTION.** The snapshot is written while this
        // reads it, and the component's own contract is that a missing, stale or mid-write snapshot shows
        // the last numbers it has rather than failing. MEASURED: without this guard two tests that mount the
        // chart with no payload threw inside `seriesIndex`, which is a crash a reader would see as a blank
        // pane rather than as a missing snapshot.
        if (payload === null || payload === undefined) return []
        // AND THE TAG MAY LIVE ON THE SERIES RATHER THAN ON THE SPEC - see `familyMembers`. MEASURED: a
        // fixture in this suite passes it that way, and reading `spec.tag` alone left the family unavailable
        // for a chart that had every line it needed.
        const tag = typeof spec.tag === 'string' && spec.tag !== ''
          ? spec.tag
          : (spec.series && typeof spec.series.tag === 'string' ? spec.series.tag : '')
        const index = seriesIndex(payload)
        const members = familyMembers(tag, index)
        // the chip's own line is already the main chain; the extras are what this adds
        return members.filter((member) => member.tag !== tag)
      }, [payload, spec.tag, spec.series])
      //: Every point this chart draws beside its own line, whether or not the history switch is showing them.
      //:
      //: **THE WINDOW IS SCALED TO THESE, WHICH IS A FIX RATHER THAN A DETAIL.** MEASURED by the user, 16
      //: October 2026: *"the y-axis zoom seems to only focus the training data, not the held out one. it
      //: should be both."* **`currentArc` was `valueRange(insideLive)` - the live chain and nothing else -
      //: so the held-out curve, which sits ABOVE the training curve on every leg of this run, was drawn
      //: above the top of the frame.** A reader saw one line and an empty upper half.
      //:
      //: **AND IT IS COMPUTED REGARDLESS OF `hideOlder`, deliberately**: the axis must not jump because a
      //: reader pressed a switch, and the values are still said to be *"in the window"* while hidden. The
      //: switch controls what is DRAWN, not what the frame is scaled to.
      const familyPoints = React.useMemo(
        () => family.flatMap((member) => member.series.points), [family])
      const bounds = React.useMemo(
        () => fullRange([...olderChain, ...liveChain, ...familyPoints]),
        [olderChain, liveChain, familyPoints])
      const range = view === null ? bounds : view
      // The seed line is split at the same joint and resampled in ABSOLUTE legs,
      // so a gap in it stays a gap, and re-based afterwards.
      const overlayChains = React.useMemo(() => {
        if (second === null) return { older: [], live: [] }
        const other = splitOlder(second.series.points, ghostAt)
        const rebase = (segments, offset) => segments
          .map((segment) => segment.map(([leg, value]) => [leg - offset, value]))
        return {
          older: rebase(resampleOnto(other.older, byLeg.older.map((point) => point[0])), olderOrigin),
          live: rebase(resampleOnto(other.live, byLeg.live.map((point) => point[0])), liveOrigin),
        }
      }, [second, byLeg, ghostAt, olderOrigin, liveOrigin])
      // How many markers the switches are holding back. It is a COUNT and not a
      // boolean because "no markers here" and "you hid the markers here" look
      // identical on a chart and mean opposite things.
      const hiddenMarkerCount = breaks.markers.length - markers.length
      // THE TWO CHAINS ARE WINDOWED SEPARATELY, because after a rewind the older
      // chain's x and the live chain's x are different legs' distances: one window
      // covers both, and each chain answers for itself.
      const insideOlder = pointsInRange(olderChain, range)
      const insideLive = pointsInRange(liveChain, range)
      const inside = [...(ghostIsShown ? insideOlder : []), ...insideLive]
      const olderDrawn = ghostIsShown ? pointsToDraw(olderChain, range) : []
      const liveDrawn = pointsToDraw(liveChain, range)
      const drawn = [...olderDrawn, ...liveDrawn]
      const drawablePoints = olderDrawn.length + liveDrawn.length
      // THE AXIS DEFAULTS TO THE LIVE CHAIN'S BOUNDS, AND THE RAIL SPANS EVERYTHING.
      //
      // This replaced "the two scales are taken over BOTH chains", and the reason is measured. The
      // discarded arc ran away to a bits-per-byte of 7.7961 before the rollback, which is a perplexity
      // of 10,305,465 against the live arc's 83 to 150 - five orders of magnitude. While both chains set
      // the drawn extent, everything the live arc has ever done occupies about eight ten-thousandths of
      // one percent of the axis height, so the whole of this arc's real movement renders as a flat line
      // one pixel tall. The user, 11 October 2026: "I would like to use only the current arc's bounds
      // as scaling targets", having watched exactly that.
      //
      // SO THE GHOST OUTSIDE THE AXIS IS CLIPPED, NOT SCALED TO. It is still drawn, still dashed and
      // still labelled - the clipPath above already bounds every path - and it simply leaves the top of
      // the frame where its values exceed the live extent, which is the honest picture: the door the
      // run walked out of is visible as a line going off the top, not as a 0-height hump.
      //
      // AND THE RAIL IS WHAT MAKES THE DISCARDED VALUES REACHABLE AGAIN, which the same user asked for
      // in the same breath: "the vertical bar should try to target the whole span including past arc's
      // values. but it should default select the current arc's span." One extent could not do both, so
      // there are two - `railExtent` for the rail and the clamp, `currentArc` for the default window.
      //
      // IT IS STILL COMPUTED OVER BOTH CHAINS IN ONE RESPECT: `insideLive` is the live chain whether or
      // not the ghost is switched on, so hiding the ghost cannot move the axis. That property used to
      // come from including the older chain and now comes from excluding it, which is the stronger
      // form of it.
      //
      // AND THE PAIRING WITH THE HORIZONTAL AXIS IS STILL EXACT:
      //
      //     x:  bounds = the run's legs              range  = view  === null ? bounds     : view
      //     y:  railExtent = every chain's values    values = yView === null ? currentArc : yView
      //
      // where `x`'s bounds and `y`'s railExtent play the same part - the whole thing the window is
      // clamped to - and `x`'s default window happens to BE its bounds while `y`'s is a subset of them.
      //
      // The user's own words for the two behaviours, 11 October 2026: "the vertical bar should try to
      // target the whole span including past arc's values. but it should default select the current
      // arc's span."
      //
      //   `railExtent`  the WHOLE span, the discarded arc included - what the rail draws itself
      //                 against, and what the window is clamped to, so the reader can drag out into
      //                 the values the rollback threw away and see how far they went.
      //   `currentArc`  the live chain's own span - what the axis shows when the reader has asked for
      //                 nothing, so a chart that opens on a run which has rolled back shows the run
      //                 that is actually training rather than one flat line under a spike.
      //
      // The two were one value, and that is why only one of the two behaviours could be had at a time:
      // scaling the rail to the live chain made the discarded arc unreachable, and scaling it to
      // everything made the default window useless.
      const liveScalePoints = insideLive.length > 0 ? insideLive : pointsToDraw(liveChain, range)
      // **THE FAMILY'S LINES ARE IN THE DEFAULT WINDOW, AND LEAVING THEM OUT WAS THE BUG THE USER FOUND.**
      // MEASURED 16 October 2026: *"the y-axis zoom seems to only focus the training data, not the held out
      // one. it should be both."* **The held-out curve sits ABOVE the training curve on every leg of this
      // run**, so a window scaled to the training chain alone drew one line near the bottom of the frame and
      // left the upper half empty - the held-out line was off the top of it entirely.
      //
      // **THE FAMILY POINTS GO IN WITHOUT RE-BASING**, because unlike the ghost chain they are not part of a
      // rolled-back prefix: a corpus line is an absolute leg with an absolute value, and `familyPoints` is
      // already in the chart's own x. MEASURED against the live snapshot, the default window moves from
      // `1.755..2.240` - the training chain alone - to `1.755..2.603`, which is the pair the reader asked to
      // see at once.
      //
      // **AND THEY GO INTO `currentArc` RATHER THAN INTO `railExtent`**, because `currentArc` IS the default
      // window: putting them only in the rail's extent would have widened the rail and left the frame
      // exactly as wrong as it was.
      // **THE DEFAULT WINDOW IS THE LIVE ARC'S OWN, BY THE USER'S INSTRUCTION.** Stated twice,
      // plainly on 20 October 2026: *"we should use only the live arc for determining the
      // zoom/scale"*. `familyPoints` used to go in whole, and the fan carries OTHER ARCS - one
      // reading of 61,666 from a stopped arc (c28 leg 20, a real blow-up) flattened every live
      // reading into the bottom of the frame. So the fan's history and discarded members are
      // excluded here, while this run's own registers (held-out, sealed, corpus) stay: those are
      // the live arc and the user asked for them together.
      //
      // The RAIL still keeps everything (`fullValues` below), so a reader can drag out to the
      // other arcs' values; only the window the chart OPENS on is the live arc's.
      const OLDER_ONLY_ROLES = new Set(['history', 'discarded'])
      const liveFamilyPoints = React.useMemo(
        () => family.filter((member) => !OLDER_ONLY_ROLES.has(member.role))
          .flatMap((member) => member.series.points), [family])
      const currentArc = valueRange([...liveScalePoints, ...liveFamilyPoints])
      // The rail keeps the ghost chain as well, so a reader can still drag out into what a rollback threw
      // away - which is why the two are separate values and not one.
      const fullValues = valueRange([...olderChain, ...liveChain, ...familyPoints])
      // The rail's own extent, with a unit fallback so the render below has a range whatever happens:
      // `valueRange` is null only for no points, and the rail is not drawn at all in that case.
      const railExtent = fullValues ?? currentArc ?? { lo: 0, hi: 1 }
      //: What the axis shows when the reader has asked for nothing - the same expression `values`
      //: falls back to, written once so the two cannot disagree about what "auto" means.
      const defaultYWindow = currentArc ?? railExtent
      const values = yView === null ? defaultYWindow : yView
      // THE DEFAULT IS RECORDED THE FIRST TIME THERE IS ONE, and never again. Guarded on null so this
      // runs once rather than on every render, which is what makes it a snapshot: the whole point of
      // holding it is to notice that the default it was recorded at is not the default now.
      if (defaultAtMountY === null) setDefaultAtMountY(defaultYWindow)
      //: Whether the reset control has anything to do. Two independent reasons, and BOTH are needed:
      //:
      //:   the reader asked for a window    `touchedY`, which stays true even if the window they chose
      //:                                    happens to equal the default again, so dragging back to
      //:                                    where it started does not silently disable the control
      //:   the default moved away from them the comparison against the snapshot, which is the user's
      //:                                    third correction: "the reset button should detect that the
      //:                                    default has changed and it should become enabled"
      //:
      // The tolerance is not decorative. `valueRange` pads by a fraction of the span, so two extents
      // computed from the same arc at different widths differ in the last bits; without it the control
      // would flicker enabled on a poll that changed nothing.
      const defaultHasMoved = defaultAtMountY !== null
        && !sameWindow(defaultAtMountY, defaultYWindow)
      const resetYEnabled = touchedY || defaultHasMoved

      // The right axis is scaled to the WHOLE SIZE SERIES, and not to the
      // samples inside the window, which is the one place this axis departs from
      // the rule the main axis follows.
      //
      // WHY. This line's whole purpose is the model's growth, and the size only
      // ever rises. A floor derived from the window therefore RISES as the
      // reader pans right and LIFTS THE BEGINNING OF THE LINE OFF THE BOTTOM of
      // the frame: at the whole-run view the first reading sits 8 percent up,
      // and a few hundred legs into the run it is below the axis and not drawn
      // at all - so the reader is shown a series that appears to start later
      // than it does, with nothing on screen saying a reading was dropped. A
      // floor anchored to the series instead stays put under every window, which
      // is also what makes the line's shape comparable from one window to the
      // next. The x window still does all the framing work it did before.
      //
      // The main axis is deliberately NOT changed: its readings are noisy and
      // uncorrelated, so there the rescale is the point.
      const overlayIsLog = second !== null && isLogScale(second)
      const overlayAll = second === null ? [] : second.series.points
      const overlayRange = overlayIsLog
        ? logRange(overlayAll, valueRange(overlayAll))
        : valueRange(overlayAll)
      const overlayLo = overlayRange === null ? 0 : overlayRange.lo
      const overlayHi = overlayRange === null ? 1 : overlayRange.hi
      /** Where a value sits on the second axis, 0 at its floor and 1 at its top. */
      const overlayFraction = (value) => {
        if (!overlayIsLog) return (value - overlayLo) / (overlayHi - overlayLo)
        return logFraction(value, overlayLo, overlayHi)
      }
      // IS THERE ANYTHING TO DRAW IN THIS WINDOW? Asked of the points that will be
      // DRAWN, not of every point in the file: with the older run's values switched
      // off, a window inside the discarded chain holds plenty of samples and no
      // line, and a note that stayed silent there would leave the reader looking
      // for a rendering fault that is a switch. The scale above is still computed
      // from every point, so the axis does not move when the ghost is taken away.
      //
      // **AND THE FAMILY COUNTS, WHICH IS THE FAMILY-ONLY CHIP'S OWN CASE.** A chip whose primary
      // has no points (`primaryMissing`) draws the sealed/corpus/history lines and NOTHING on the
      // train chain, so a check that only looked at the primary said "no points in this window"
      // over a frame with a dozen lines on it.
      const familyInWindow = familyPoints.some(
        (point) => point[0] >= range.lo && point[0] <= range.hi)
      const windowIsEmpty = !familyInWindow && inside.length === 0 && drawablePoints < 2
      // The frame is widened by the overlay's gutter ONLY when there is a second
      // axis to write in, so a snapshot without one gets the frame this tab has
      // always drawn.
      const plot = plotGeometry(range, second === null ? CHART.padRight : CHART.padRight + OVERLAY_GUTTER)

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

      /**
       * Set the VERTICAL window: the x window's own mechanism, aimed at the values.
       *
       * THIS IS `showWindow` ONE AXIS OVER, deliberately line for line: the same clamp against an
       * auto extent, the same collapse-to-null when the window covers the whole extent, and the same
       * remember-before-apply. `bounds` is the automatic vertical extent here where the x version's is
       * the run's leg range, and `clampRange` needed no change at all - it never mentions the data, so
       * the floor it enforces comes from the bounds it is handed. That is why the vertical axis could
       * reuse the horizontal mechanism instead of growing a second one.
       *
       * `Y_MIN_WINDOW_FRACTION` of the AUTO extent is the floor: a window narrower than that is inside
       * the blur of the values themselves, and unbounded zoom on a flat plateau would magnify
       * rounding into apparent signal.
       */
      const showYWindow = React.useCallback((next, { touched = true } = {}) => {
        const floor = (railExtent.hi - railExtent.lo) * Y_MIN_WINDOW_FRACTION
        const settled = next === null ? null : clampRange(next, railExtent, floor)
        const applied = settled === null
          || (settled.lo <= railExtent.lo && settled.hi >= railExtent.hi) ? null : settled
        rememberYWindow(spec.tag, applied)
        setYView(applied)
        // THE AXIS IS NO LONGER AT ITS DEFAULT THE MOMENT THE READER MOVES IT, even if the window they
        // chose happens to equal the current default - and it STAYS not-at-default as the run advances
        // and the default moves away from where they left it. Only the reset passes `touched: false`,
        // because every other caller is the reader asking for something.
        setTouchedY(touched)
      }, [railExtent, spec.tag])

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

      // THE VALUE AXIS HAS NO BUTTONS AND NO ZOOM FUNCTIONS OF ITS OWN ANY MORE. It had
      // `zoomYIn`/`zoomYOut`/`panY` for the five buttons that used to sit in the row; the rail beside
      // the frame replaced them, and it goes through `showYWindow` directly - the same path the x
      // strip under the chart uses through `showWindow`. What remains here is `yCentre`, which the
      // Shift-keys still need: a rail is drag-only, and a reader on a keyboard cannot drag.
      /** The middle of the vertical window, which is where a keystroke zooms about. */
      const yCentre = () => (values === null ? 0.5 : (values.lo + values.hi) / 2)

      // The wheel listener is bound once, so it reads the live window from a ref
      // instead of from the render that installed it.
      const live = React.useRef(null)
      live.current = { range, bounds, plot, values, railExtent, spec,
        showX: showWindow, showY: showYWindow }
      React.useEffect(() => {
        const host = hostRef.current
        if (host === null) return undefined
        // React's wheel listener is passive by contract, so a wheel that zooms
        // rather than scrolls the panel has to be bound natively.
        const onWheel = (event) => {
          event.preventDefault()
          const current = live.current
          if (current === null) return
          const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
          // WHICH AXIS THE WHEEL DRIVES IS DECIDED BY WHERE THE CURSOR IS, and the two zones are the
          // ones the frame already draws: the row of y labels down the left edge, and the bottom strip
          // of x labels. Shift forces the vertical axis from anywhere, so a reader who has aimed at a
          // point on the curve can zoom about THAT VALUE rather than about the axis' middle.
          const py = chartPixelFromEventY(event, host)
          const px = chartPixelFromEvent(event, host, current.plot)
          const onYAxis = event.shiftKey || px <= CHART.padLeft || py >= CHART.height - CHART.padBottom
          if (onYAxis && current.values !== null) {
            const anchor = valueAtY(py, current.values)
            current.showY(zoomRange(current.values, factor, anchor))
            return
          }
          const anchor = valueAt(px, current.plot)
          current.showX(zoomRange(current.range, factor, anchor))
        }
        host.addEventListener('wheel', onWheel, { passive: false })
        return () => { host.removeEventListener('wheel', onWheel) }
      }, [])

      const onPointerDown = (event) => {
        if (event.button !== 0) return
        const host = hostRef.current
        if (host === null) return
        const at = chartPixelFromEvent(event, host, plot)
        host.setPointerCapture?.(event.pointerId)
        setBrush({ from: at, to: at })
      }
      const onPointerMove = (event) => {
        const host = hostRef.current
        if (host === null) return
        const at = chartPixelFromEvent(event, host, plot)
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
        // THE VERTICAL CONTROLS ARE THE HORIZONTAL KEYS WITH SHIFT HELD, which is what makes the two
        // axes one instrument rather than two sets of bindings to learn:
        //
        //     + / -            zoom the x window
        //     Shift + / -      zoom the value axis
        //     Left / Right     pan the x window
        //     Shift Up / Down  pan the value axis
        //     `0` or Escape    x back to the whole run
        //     `1` or Shift+0   values back to auto
        //
        // Shift+ArrowUp/Down is also the convention a reader already has for a vertical axis, so the
        // binding is derived rather than invented.
        else if (event.key === '1' || (event.shiftKey && event.key === ')')) {
          // `touched: false` because this IS the reset - the key and the `Reset y` button must leave the
          // control in the same state, or one of them would re-enable a control the other had cleared.
          event.preventDefault(); showYWindow(null, { touched: false })
        }
        // The Shift-keys go straight to `showYWindow` with the same `zoomRange` and `panRange` the x
        // keys use, and not through per-direction wrappers: the wrappers existed for the buttons and
        // went with them. A rail is drag-only, so these are the only way a keyboard user reaches the
        // value axis at all.
        else if (event.shiftKey && (event.key === '+' || event.key === '=' || event.key === '*')) {
          event.preventDefault()
          if (values !== null) showYWindow(zoomRange(values, ZOOM_FACTOR, yCentre()))
        }
        else if (event.shiftKey && (event.key === '-' || event.key === '_')) {
          event.preventDefault()
          if (values !== null) showYWindow(zoomRange(values, 1 / ZOOM_FACTOR, yCentre()))
        }
        else if (event.key === 'ArrowUp' && event.shiftKey) {
          event.preventDefault()
          if (values !== null) showYWindow(panRange(values, PAN_FRACTION))
        }
        else if (event.key === 'ArrowDown' && event.shiftKey) {
          event.preventDefault()
          if (values !== null) showYWindow(panRange(values, -PAN_FRACTION))
        }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); showWindow(panRange(range, -PAN_FRACTION)) }
        else if (event.key === 'ArrowRight') { event.preventDefault(); showWindow(panRange(range, PAN_FRACTION)) }
      }

      // `plot` and not `CHART`: the frame's right edge is the plot's own, so a
      // chart with a second axis leaves the gutter for that axis' labels and
      // draws both curves to the column the gridlines stop at.
      const innerWidth = plot.right - plot.left
      const innerHeight = CHART.height - CHART.padTop - CHART.padBottom
      const yLo = values === null ? 0 : values.lo
      const yHi = values === null ? 1 : values.hi
      const projectX = (value) => plot.left + ((value - range.lo) / (range.hi - range.lo)) * innerWidth
      const projectY = (value) => CHART.padTop + innerHeight - ((value - yLo) / (yHi - yLo)) * innerHeight
      // The second line's own y scale, against the axis on the right. Its extent
      // is the overlay's samples IN this window, so it rescales with the window
      // exactly as the main axis does. A value the log axis cannot hold - a zero,
      // which log(0) puts at negative infinity - returns null here, and the
      // caller draws that as a gap rather than clamping it to the floor.
      const projectOverlayY = (value) => {
        const fraction = overlayFraction(value)
        return fraction === null ? null : CHART.padTop + innerHeight - fraction * innerHeight
      }

      const children = []
      children.push(React.createElement('clipPath', { key: 'clip', id: CLIP_ID },
        React.createElement('rect', {
          x: plot.left, y: CHART.padTop, width: innerWidth, height: innerHeight,
        })))
      // ONE SET OF GRIDLINES, AND ITS SPACING IS THE SCALE'S. See
      // `sharedGridlines`: with a log second line the lines sit at that axis'
      // exponential intervals, and BOTH axes label them; with none, they are the
      // primary axis' regular ones.
      const overlayTicks = second === null ? []
        : overlayIsLog ? logTicks(overlayLo, overlayHi, 5) : niceTicks(overlayLo, overlayHi, 4)
      const primaryTicks = niceTicks(yLo, yHi, 4)
      const grid = second === null
        ? { lines: primaryTicks.map((value) => ({ y: projectY(value), primaryValue: value, overlayValue: null })), extra: [] }
        : sharedGridlines(primaryTicks, overlayTicks, overlayIsLog, projectY, projectOverlayY)
      // The primary axis' labels, decided together so no two of them collide.
      const primaryValues = grid.lines
        .map((line) => line.primaryValue)
        .filter((value) => value !== null && value !== undefined)
      const primaryLabels = axisTickLabels(primaryValues, spec)
      const primaryLabelAt = new Map(primaryValues.map((value, at) => [value, primaryLabels[at]]))
      for (const [index, line] of grid.lines.entries()) {
        children.push(React.createElement('line', {
          key: `grid-${index}`, className: CLASS.gridline,
          x1: plot.left, x2: plot.right, y1: line.y, y2: line.y,
        }))
        const label = primaryLabelAt.get(line.primaryValue)
        if (label !== undefined) {
          children.push(React.createElement('text', {
            key: `gridlabel-${index}`, className: CLASS.axis,
            x: plot.left - AXIS_LABEL_GAP, y: line.y + 3, textAnchor: 'end',
          }, label))
        }
      }
      // The left axis' unit, rotated up its outer edge, for the same reason the
      // right axis' unit is: a unit does not fit beside a number, and a reader
      // should not have to guess what the column means.
      children.push(axisUnitTitle(spec.unit,
        AXIS_UNIT_WIDTH / 2 + 2, CHART.padTop, innerHeight, 'left'))
      for (const tick of niceTicks(range.lo, range.hi, 5)) {
        children.push(React.createElement('text', {
          key: `xtick-${tick}`, className: CLASS.axis,
          x: projectX(tick), y: CHART.height - 8, textAnchor: 'middle',
        }, String(Math.round(tick))))
      }
      // The second axis, on the RIGHT. It labels EVERY line it has a mark on -
      // the shared ones and the `extra` marks that fall between them - so no line
      // on the frame is a line without a value on the side that drew it. Its
      // labels are decided together for the same reason the primary axis' are.
      if (second !== null) {
        const marks = [
          ...grid.lines
            .filter((line) => line.overlayValue !== null && line.overlayValue !== undefined)
            .map((line) => ({ y: line.y, value: line.overlayValue })),
          ...grid.extra.map((entry) => ({ y: entry.y, value: entry.value })),
        ].sort((left, right) => left.y - right.y)
        const overlayLabels = axisTickLabels(marks.map((mark) => mark.value), second)
        for (const [index, mark] of marks.entries()) {
          children.push(React.createElement('text', {
            key: `ovaxis-${index}`, className: CLASS.overlayAxis,
            x: plot.right + AXIS_LABEL_GAP, y: mark.y + 3, textAnchor: 'start',
          }, overlayLabels[index]))
        }
        children.push(axisUnitTitle(second.unit,
          CHART.width - AXIS_UNIT_WIDTH / 2 - 2, CHART.padTop, innerHeight, 'right'))
      }

      // THE CURRENT VALUE OF EACH LINE, FLOATING IN THE LEFT MARGIN.
      //
      // The newest reading of each series, written at the height that reading is
      // drawn at - so a number and the line it belongs to are read together, with
      // no legend in between. They are the values for the WHOLE RUN and not for
      // the window: a reader zoomed into leg 300 is still steering by the newest
      // reading, and a label that vanished when they panned would be one they
      // cannot rely on.
      //
      // WHY THE LEFT, AND NOT BESIDE THE NUMBERS THEY RESEMBLE. On the right they
      // shared a column with the overlay's tick labels, which is where a reader
      // looks for an axis value - the two were mistaken for each other. The left
      // margin holds the primary axis' numbers, and the reading is separated from
      // them by POSITION, COLOUR and a rail down its inner edge: three channels,
      // so it reads as a floating marker rather than as another tick.
      //
      // A LABEL IS ONLY WRITTEN WHERE ITS LINE IS DRAWN, and a rail is drawn
      // across the whole band of each label, so the two rails cannot bleed into
      // one another however close the values are. The text is written through
      // `axisLabelText`, the SAME call the axis' own marks use - the formatter
      // does its own scaling (`22,217,000` becomes `22.2M`), so a value already
      // multiplied by the spec's scale would come out as a bare `22.22` that
      // disagrees with the mark on the axis beside it.
      const inView = (seriesPoints) => seriesPoints.some(
        (point) => point[0] >= range.lo && point[0] <= range.hi)
      const newestPrimary = liveChain.length > 0
        ? liveChain[liveChain.length - 1] : olderChain[olderChain.length - 1]
      const overlayPoints = second === null ? [] : second.series.points
      const overlayLiveLast = overlayChains.live.length > 0
        ? overlayChains.live[overlayChains.live.length - 1].slice(-1)[0] : null
      const newestOverlay = overlayLiveLast
        ?? (overlayChains.older.length > 0
          ? overlayChains.older[overlayChains.older.length - 1].slice(-1)[0] : null)
      // WHICH CHAIN THE READER IS LOOKING AT is what decides whether a floating
      // value belongs on the chart: a label for a chain that is not in the window
      // is a number attached to nothing.
      const primaryInView = inView(liveChain) || (ghostIsShown && inView(olderChain))
      const overlayInView = inView(overlayChains.live.flat())
        || (ghostIsShown && inView(overlayChains.older.flat()))
      const valueLabels = currentValueLabels([
        newestPrimary === undefined || !primaryInView ? null : {
          kind: 'primary',
          ink: PRIMARY_INK,
          y: projectY(newestPrimary[1]),
          text: axisLabelText(newestPrimary[1], spec),
        },
        newestOverlay === null || !overlayInView ? null : {
          kind: 'overlay',
          ink: OVERLAY_INK,
          y: projectOverlayY(newestOverlay[1]),
          text: axisLabelText(newestOverlay[1], second),
        },
      ], CHART.padTop + 8, CHART.padTop + innerHeight - 2)
      // **THE READING IS RIGHT-ALIGNED AGAINST THE FRAME'S LEFT EDGE, SO ITS NUMBERS LINE UP IN A COLUMN AND
      // ITS DECIMALS LINE UP WITH EACH OTHER. THE USER'S CORRECTION, 16 October 2026:** *"The live numbers are
      // left aligned within the chart window. they should be right aligned."*
      //
      // MEASURED, the first version of this put the text at `plot.left + 6` anchored `start`, so the two
      // readings began at the same x and ended wherever their digits happened to fall - **`2.246` and
      // `17.4M` do not align on the decimal, so the pair reads as two ragged strings rather than as a column
      // of numbers.** A reader comparing two values scans their digits, and digits only line up when the
      // numbers END together.
      //
      // **THE FIX MOVES THE ANCHOR, AND THE COLUMN LIVES AT THE FRAME'S RIGHT EDGE.** The text is anchored
      // `end` at `plot.right - CURRENT_VALUE_INSET`, so the numbers grow LEFTWARD from a fixed right edge,
      // their digits line up as a column, and **the column sits where the live values are** - the newest
      // point of every line, at the end a reader watching a run is looking at. Measured, `2.246` and `17.4M`
      // anchored `start` do not align on the decimal; anchored `end` they do, which is the whole of what the
      // second correction asked for, and the third said where the column belongs.
      const railX = CURRENT_VALUE_RAIL_X + CURRENT_VALUE_RAIL_WIDTH
      const inkX = plot.right - CURRENT_VALUE_INSET
      for (const label of valueLabels) {
        children.push(React.createElement('g', {
          key: `current-${label.kind}`, className: CLASS.currentValue,
          'data-series': label.kind,
        },
        // **THE RAIL STAYS AT THE LINE'S OWN HEIGHT EVEN WHEN THE TEXT HAS STEPPED ASIDE.** A reading pushed
        // by the collision rule carries its original pixel in `lineY`, so the mark still points at the value
        // the number is about - **the label may have moved and the mark may not, which is the honest picture
        // when two lines end too close to write both readings at their own heights.**
        React.createElement('rect', {
          className: CLASS.currentRail,
          fill: label.ink,
          x: CURRENT_VALUE_RAIL_X, y: (label.lineY ?? label.y) - 7,
          width: CURRENT_VALUE_RAIL_WIDTH, height: 10,
        }),
        // The colour is on the element AND in the stylesheet: a fill that exists
        // only in the sheet is absent whenever the sheet is not applied, and an
        // SVG text with no fill is black. See OVERLAY_INK.
        React.createElement('text', {
          className: label.kind === 'overlay' ? CLASS.currentOverlay : CLASS.currentPrimary,
          fill: label.ink,
          x: inkX, y: label.y, textAnchor: 'end',
        }, label.text)))
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
      //
      // A CATEGORY THE READER SWITCHED OFF IS NOT IN `markers` AT ALL, so it is
      // absent from here, from the strip below and from the register: the three
      // views of one marker can never disagree about whether it is drawn.
      // A ROLLBACK IS NOT A JOINT AT A LEG ON THIS CHART, and drawing it as one was
      // the report: "the rollback marker is not useful with everything aligned to
      // 0". It used to put a line at the end of the older chain - at x=208 on a
      // chart whose live chain starts at 0 - which marks nothing a reader can use,
      // because the rollback IS the reason both chains start at 0. What says it on
      // the chart is the origin itself: two chains from one x, the older ghosted,
      // and the readout naming the unit. What says it in words is the register row,
      // with the rule and the checkpoint it went back to. So the rollback is kept
      // out of the drawn markers and its category switch hides the RECORD.
      const placedMarkers = markers.filter((marker) => marker.kind !== 'rollback')
      const markerX = (leg) => projectX(chainX(leg))
      const visibleMarkers = placedMarkers.filter((marker) => {
        const at = chainX(marker.leg)
        return at >= range.lo && at <= range.hi
      })
      const markerLayout = layoutMarkerLabels(visibleMarkers, markerX, plot)
      for (const [index, entry] of markerLayout.entries()) {
        const { marker } = entry
        children.push(React.createElement('g', {
          key: `marker-${marker.leg}-${index}`,
          className: CLASS.marker,
          'data-kind': marker.kind,
          'data-leg': String(marker.leg),
          clipPath: `url(#${CLIP_ID})`,
        },
        React.createElement('line', {
          x1: entry.x, x2: entry.x, y1: CHART.padTop, y2: CHART.padTop + innerHeight,
          // The kind's colour on the element as well as in the sheet: a line whose
          // stroke lives only in the sheet loses its stroke entirely when the sheet
          // is not applied, which is a joint the reader cannot see at all. See
          // KIND_INK.
          stroke: kindInk(marker.kind),
        }),
        React.createElement('title', null, markerTooltip(marker))))
      }

      // NO FRONTIER LINE, AND NO LANE RESERVED FOR ONE. This block used to draw a dashed line at the
      // leg the producer expected the next corpus change at, followed by a label in a lane of its own
      // under the markers' lanes. Both are gone with the prediction: see the block comment above
      // `KIND_ORDER` for the instruction and the measurement. The lanes below are the markers' own,
      // which is why `frontierLane` no longer exists to push them down.

      // The labels, over every line: one chip per marker, so the text is never
      // crossed by a line.
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
        markerSwatch(markerShape(marker.kind), haloX + MARKER_SWATCH_SIZE / 2, labelY - 3, 'swatch',
          CLASS.markerSwatch, kindInk(marker.kind)),
        React.createElement('text', {
          x: haloX + MARKER_SWATCH_SIZE + MARKER_SWATCH_GAP, y: labelY,
        },
        React.createElement('tspan', { className: CLASS.markerLegText }, String(marker.leg)))))
      }

      // THE SECOND LINE, UNDER THE FIRST. The selected series is the reading the
      // reader came for, so the overlay is drawn beneath it: where the two cross,
      // the curve stays unbroken and the dashed line is the one interrupted.
      // Each segment is drawn separately so a run the overlay does not cover
      // leaves a GAP rather than a chord across legs nobody measured.
      //
      // A SAMPLE THE LOG AXIS CANNOT HOLD IS DROPPED, not clamped. `projectOverlayY`
      // answers null for a value at or below a log axis' floor - a reading of zero,
      // which log(0) puts at negative infinity - and folding that to the bottom of
      // the frame would draw a zero on a scale that cannot contain one.
      // THE SECOND LINE IS GHOSTED ON THE SAME SIDE OF THE ROLLBACK AS THE FIRST:
      // the size ALSO went back to the seed's at that joint, and a size line drawn
      // live where the reading is ghosted would say the current chain had already
      // grown to 20M. It is split by LEG like the first line and re-based with it,
      // so the two lines of one pass are drawn against the same origin.
      for (const [side, segments] of [['older', overlayChains.older],
        ['live', overlayChains.live]]) {
        if (side === 'older' && !ghostIsShown) continue
        for (const [index, segment] of segments.entries()) {
          const placed = segment
            .map((point) => [projectX(point[0]), projectOverlayY(point[1])])
            .filter((point) => point[1] !== null)
          if (placed.length >= 2) {
            children.push(React.createElement('path', {
              key: `overline-${side}-${index}`,
              className: side === 'older' ? CLASS.ghostOverlay : CLASS.overlayLine,
              clipPath: `url(#${CLIP_ID})`,
              d: polylinePath(placed, (x) => x, (y) => y),
            }))
          } else if (placed.length === 1 && side === 'live') {
            children.push(React.createElement('circle', {
              key: `ovdot-${side}-${index}`, className: CLASS.overlayDot,
              cx: placed[0][0], cy: placed[0][1], r: 2,
            }))
          }
        }
      }
      const overlayNewestSegments = [...overlayChains.live, ...overlayChains.older]
      if (second !== null && overlayNewestSegments.length > 0) {
        const last = overlayNewestSegments[overlayNewestSegments.length - 1]
        const newestOverlay = last[last.length - 1]
        const newestY = projectOverlayY(newestOverlay[1])
        if (newestY !== null && newestOverlay[0] >= range.lo && newestOverlay[0] <= range.hi) {
          children.push(React.createElement('circle', {
            key: 'ovnewest', className: CLASS.overlayDot,
            cx: projectX(newestOverlay[0]), cy: newestY, r: 2,
          }))
        }
      }

      // THE OLDER PASS, GHOSTED ON THE SAME AXIS AS THE ONE BEING TRAINED. The two
      // chains are drawn in the re-based x, so both begin at the left edge: the
      // reader compares pass 2's third leg with pass 1's third leg, which is the
      // whole reason the older values are kept on the picture instead of dropped.
      if (olderDrawn.length >= 2) {
        children.push(React.createElement('path', {
          key: 'ghostline', className: CLASS.ghostLine, clipPath: `url(#${CLIP_ID})`,
          d: polylinePath(olderDrawn, projectX, projectY),
        }))
      }
      // **THE FAMILY S LINES: THE HELD-OUT READING, THE SEALED READING AND ONE LINE PER CORPUS, ON THE SAME
      // AXIS AS THE TRAINING CURVE.** This is what makes the chip a metric rather than a series - a reader
      // sees the training reading, what the same model scores on data it has not seen, and what each corpus's
      // own held-out surface said while that corpus was training, without choosing between them.
      //
      // THEY ARE DRAWN IN ABSOLUTE LEGS, NOT RE-BASED, because a corpus line's whole point is WHERE IN THE
      // RUN it happened. `splitOlder`/`olderOrigin` exist for the compare view's re-basing, and applying
      // them here would slide a phase's readings onto the live x and draw a corpus's history as though it
      // had happened alongside the current training.
      //
      // **EACH LINE IS DRAWN IN A COLOUR THAT SAYS WHICH LINE IT IS, AND UNTIL NOW THEY WERE ALL THE SAME
      // GREY.** MEASURED 16 October 2026, the user: *"the legend shows only bpb(bpb) for the left axis. it
      // should show all series present for the left axis."* **A legend for four identical grey lines would
      // have named four lines and distinguished none of them**, so the colour had to come first: the
      // held-out and sealed registers take the metric's own ink, and **each corpus gets its own colour from a
      // palette keyed on its SORTED position**, so `wiki_en` keeps its colour as corpora are added and a
      // reader learns the mapping once.
      //
      // AND THEY FOLLOW THE HISTORY SWITCH, which is what the user asked the button for.
      //
      // **THE SWITCH HIDES THE OTHER ARCS, NOT THIS ARC'S OWN REGISTERS.** `hideOlder` gated the
      // whole family, and the family carries the live arc's held-out and sealed lines beside the
      // history fan - so pressing the older-run chip also switched the held-out line off, which is
      // exactly what the user reported on 20 October 2026: *"the chip still also disables heldout"*.
      // History and discarded are the OTHER arcs' values and belong to the switch; heldout, sealed
      // and corpus are THIS arc's own readings and must survive it, or the switch silently removes
      // a measurement the run is making.
      // THE SAME SET AS THE BOUNDS ABOVE (`OLDER_ONLY_ROLES`, defined with them): history and
      // discarded are the other arcs' values, and they are what this switch takes off.
      const shownFamily = hideOlder === true
        ? family.filter((member) => !OLDER_ONLY_ROLES.has(member.role))
        : family
      if (shownFamily.length > 0) {
        // THE BACKGROUND LINES PAINT FIRST. An SVG later element covers an earlier one, so the
        // fan and this run's discarded passes are drawn before the live registers, not over them.
        // The member order itself stays the data order (the tests assert it) - this is a view.
        const drawRank = { history: 0, discarded: 0, corpus: 1, heldout: 2, sealed: 2, train: 3 }
        const paintOrder = [...shownFamily].sort(
          (a, b) => (drawRank[a.role] ?? 2) - (drawRank[b.role] ?? 2))
        for (const member of paintOrder) {
          const drawn = pointsToDraw(member.series.points, range)
          if (drawn.length >= 2) {
            children.push(React.createElement('path', {
              key: `family-${member.tag}`,              // **THE CLASS NOW FOLLOWS THE SAME RULE AS THE INK AND THE DASH: LIVE ARC SOLID, HISTORY
              // DASHED.** It read `role === 'sealed' ? sparse : solid`, which was the old rule - dash for a
              // cadence - and the user has overruled it: *"all values in series from the live arc ... to be
              // solid lines instead of dashed ones."* **A sealed read of the live arc's checkpoint IS the
              // live arc**, so it takes the solid class, and only a line from another arc takes the dashed
              // one. Leaving the old test here would have drawn the sealed line dashed from the stylesheet
              // while the legend and the inline style both said solid - **the exact disagreement this
              // session has already fixed twice.**
              className: lineDress(member.role).dash === null
                ? CLASS.familyLine : CLASS.familyLineSparse,
              // THE LINE'S COLOUR AND WEIGHT, from the same helper the legend uses - see `familyInk` and
              // `lineDress`. **Computed from the payload's own index rather than from a captured one**,
              // because `index` is not in this scope and reading it here threw `index is not defined` and
              // took four tests with it. **THE OPACITY RIDES HERE TOO**, so that a register's lighter draw
              // is a property of the line and not of a CSS class that could drift from the swatch.
              style: {
                stroke: familyInk(member, seriesIndex(payload)),
                opacity: lineDress(member.role).opacity,
                // **THE DASH IS SET HERE AS WELL AS ON THE CLASS, AND THAT IS NOT BELT-AND-BRACES.**
                // MEASURED: the sealed line wore the sparse class and drew dashed, while its swatch took the
                // dash from the legend entry - **two sources for one property, which is the exact fault the
                // user reported twice.** Reading the LINE alone then said "solid" where the legend said
                // "dashed", because the dash lived in the stylesheet and nowhere else on the element. One
                // entry now supplies the dash to the line and the swatch alike, and the class is left as the
                // fallback for a renderer that drops inline SVG styles.
                ...(lineDress(member.role).dash === null
                  ? {} : { strokeDasharray: lineDress(member.role).dash }),
              },
              clipPath: `url(#${CLIP_ID})`,
              d: polylinePath(drawn, projectX, projectY),
            }))
          } else if (drawn.length === 1) {
            // **ONE READING IS A DOT, NOT A LINE, AND THE SEALED SURFACE IS OFTEN EXACTLY ONE.**
            // MEASURED 18 October 2026: the books run's only live bpb was `sealed/bpb` at leg 17,
            // one point - and this loop drew paths only for `drawn.length >= 2`, so the chart with
            // a bpb chip would still have shown no bpb value on the frame. The primary chain already
            // has this dot case; the family did not.
            children.push(React.createElement('circle', {
              key: `family-dot-${member.tag}`, className: CLASS.dot,
              style: {
                fill: familyInk(member, seriesIndex(payload)),
                opacity: lineDress(member.role).opacity,
              },
              cx: projectX(drawn[0][0]), cy: projectY(drawn[0][1]),
              r: READING_DOT_RADIUS,
            }))
          }
        }
      }
      // WHETHER THIS SERIES IS A CADENCE RATHER THAN A LEG - see `SPARSE_COVERAGE`. It is decided from
      // the WHOLE series and not from what is in the window, so zooming in does not turn a per-leg
      // family into a sparse one and out again.
      const sparseReadings = isSparseReadings(points)
      if (liveDrawn.length >= 2) {
        // A SERIES TAKEN ON A CADENCE IS DRAWN AS ITS READINGS. The line between two readings is not a
        // measurement - nothing was scored on the legs between them - so it is dashed, which is what
        // this tab already uses for a line whose values are real but whose life is not continuous
        // (`ghostLine`), and every reading it has gets a circle, so the four points a twelve-leg
        // cadence produces over a forty-leg run read as four readings rather than as a smooth curve.
        // The newest reading still gets its own dot below; on a sparse series that is the last circle
        // of this loop drawn again, in the same place and the same colour, so nothing moves.
        children.push(React.createElement('path', {
          key: 'line', className: sparseReadings ? CLASS.readingsLine : CLASS.line,
          // **THE STROKE IS SET HERE AS WELL AS IN THE SHEET, AND THAT IS THE FIX.**
          //
          // MEASURED, 16 October 2026, the user: *"The primary series is actually white in color and it's a
          // solid line, whereas the legend seems to suggest that it should be some blue shade."*
          //
          // The sheet says `stroke: var(--dsw-alias-brand-primary, #4d6bfe)` - **and the fallback did not
          // apply in the chart's own SVG, so the stroke resolved to nothing and an SVG path with no stroke
          // renders BLACK; the white they saw is the sheet's `fill: none` against the pane.** Whatever the
          // cause, **a colour that has to survive a variable lookup is a colour that can go missing, and the
          // LEGEND SWATCH beside it is an inline hex that cannot.** The two disagreed because they were
          // different mechanisms, so this now uses the same one: `PRIMARY_INK`, the same constant the swatch
          // and the current-value label read.
          //
          // **AND THE DASH IS SET HERE TOO, for the same reason**: `readingsLine` dashes a series taken on a
          // cadence and `line` is solid, and a reader must be able to trust that what the legend describes is
          // what the frame draws without knowing which CSS class won.
          style: sparseReadings
            ? { stroke: PRIMARY_INK, strokeDasharray: '2 3' }
            : { stroke: PRIMARY_INK },
          clipPath: `url(#${CLIP_ID})`,
          d: polylinePath(liveDrawn, projectX, projectY),
        }))
        if (sparseReadings) {
          for (const [index, point] of liveDrawn.entries()) {
            children.push(React.createElement('circle', {
              key: `reading-${index}`, className: CLASS.dot,
              // the dots are the readings and they take the line's own ink, or a sparse series draws blue
              // circles on a white line
              style: { fill: PRIMARY_INK },
              cx: projectX(point[0]), cy: projectY(point[1]), r: READING_DOT_RADIUS,
            }))
          }
        }
      } else if (liveDrawn.length === 1) {
        // One sample is a dot, not a line: a single M draws nothing at all.
        children.push(React.createElement('circle', {
          key: 'only', className: CLASS.dot,
          style: { fill: PRIMARY_INK },
          cx: projectX(liveDrawn[0][0]), cy: projectY(liveDrawn[0][1]), r: READING_DOT_RADIUS,
        }))
      } else if (olderDrawn.length === 1) {
        children.push(React.createElement('circle', {
          key: 'only', className: CLASS.dot,
          cx: projectX(olderDrawn[0][0]), cy: projectY(olderDrawn[0][1]), r: READING_DOT_RADIUS,
        }))
      }

      const newest = newestPrimary
      if (newest !== undefined && newest[0] >= range.lo && newest[0] <= range.hi) {
        children.push(React.createElement('circle', {
          key: 'newest', className: CLASS.dot,
          cx: projectX(newest[0]), cy: projectY(newest[1]), r: READING_DOT_RADIUS,
        }))
      }

      // THE BRUSH BELONGS TO ONE AXIS AT A TIME, and the rail's is drawn on the rail. This test used to
      // exclude only `overview`, so a brush dragged on the RAIL fell through to here and was drawn as an
      // x band across the chart: a vertical gesture rendering as a horizontal one, which is the user's
      // second correction of 11 October 2026 - "dragging to set the vertical bar on the side shows a
      // horizontal indication in the graph. It should show it vertically or not at all." It shows it
      // vertically, on the rail itself, and this excludes it from the chart.
      if (brush !== null && brush.overview !== true && brush.rail !== true
        && Math.abs(brush.to - brush.from) >= 1) {
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
        // A window with nothing in it and a window whose only points the reader
        // switched off look identical and are not the same fact: the second one
        // has values on screen one press away, and a note that said "no points"
        // would send the reader looking for a fault instead.
        const olderHere = !ghostIsShown && byLeg.older.length > 0
        children.push(React.createElement('text', {
          key: 'windowempty', className: CLASS.windowNote,
          x: CHART.padLeft + innerWidth / 2, y: CHART.padTop + innerHeight / 2, textAnchor: 'middle',
        }, olderHere
          ? "only the older run's values are in this window · OLDER RUN below draws them"
          : 'no points in this window · Reset shows the run'))
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
        // THE VALUE AXIS' OWN RESET. It was not here before: the `Reset` above clears the LEG window
        // only, and the value axis had no way back to its default at all once the rail had moved it. The
        // user's third correction of 11 October 2026: "the reset button should detect that the default
        // has changed and it should become enabled." `resetYEnabled` is what that means - either the
        // reader moved the axis, or the default itself has moved out from under them as the run
        // advanced, which a comparison against a stored window alone cannot see.
        React.createElement('button', {
          type: 'button', className: CLASS.windowButton, disabled: !resetYEnabled,
          title: 'Size the value axis to the current arc ( 1 )',
          'aria-label': 'Reset the value axis to the current arc',
          onClick: () => { showYWindow(null, { touched: false }) },
        }, 'Reset y'),
        // ONE READOUT FOR TWO AXES, because the two numbers answer one question - what am I looking at -
        // and the y half is the one the rail moves. It is the only place the axis' actual values are
        // printed, which matters on a chart whose window is a hundredth of its span.
        React.createElement('span', {
          className: CLASS.windowReadout, 'aria-live': 'polite',
        }, `${rangeLabel(range, bounds, ghostAt !== null)} · y ${valueWindowLabel(values, spec.digits)}`))

      // `overlaySegments.length`/`second.label` are part of what the picture
      // says, so they are part of what its accessible name says: a screen reader
      // is told the second line exists, what it is and at which end its scale
      // sits, rather than being handed one curve and no mention of the other.
      const overlaySentence = second === null
        ? ''
        : ` A second dashed line shows ${second.label} against the axis on the right`
          + `${second.unit === '' ? '' : `, in ${second.unit}`}, covering `
          + `${(ghostIsShown
            ? [...overlayChains.older, ...overlayChains.live] : overlayChains.live)
            .flat().length} of its points in view.`
      const chart = React.createElement('svg', {
        ref: hostRef,
        className: CLASS.chart,
        viewBox: `0 0 ${CHART.width} ${CHART.height}`,
        role: 'img',
        tabIndex: 0,
        onPointerDown, onPointerMove, onPointerUp,
        onDoubleClick: () => { showWindow(null) },
        onKeyDown,
        // The markers are part of what the picture says, so they are part of
        // what its accessible name says: a screen reader gets the count - and it
        // gets the count of what the reader SWITCHED OFF beside it, so hiding a
        // category is never a silent absence.
        'aria-label': `${spec.label}. ${rangeLabel(range, bounds, ghostAt !== null)}. `
          + `${inside.length} of ${points.length} points in view. `
          + `${visibleMarkers.length} of ${placedMarkers.length} break markers in this window`
          + `${hiddenMarkerCount > 0
            ? `, and ${hiddenMarkerCount} more hidden by the category switches`
            : ''}.`
          + `${ghostAt === null ? ''
            : ` This run rolled back at leg ${ghostAt}, so both passes are drawn from`
              + ' their own first leg and the older one is ghosted.'}${overlaySentence}`,
      }, ...children)

      // THE RAIL: the value axis' own overview, standing to the LEFT of the frame.
      //
      // It is the strip under the chart TURNED ON ITS SIDE, and deliberately the same object in every
      // respect but the axis: the whole extent is drawn with the window on it so the window's shape does
      // not change as the reader zooms, a drag selects a range, and a click slides the window to a
      // place while keeping its height. The user asked for exactly that - "a vertical window to the
      // left of the graph that I can drag-select exactly like the x-axis zoom feature" - so the two
      // share `brushRangeAt` and differ only in the pixel-to-value mapping they hand it.
      //
      // ITS SCALE IS THE WHOLE SPAN AND NOT THE WINDOW, which is the whole point of an overview: if it
      // rescaled to the window, the window's edges would sit at its ends for ever and the reader could
      // never see how much of the span they are looking at. `railExtent` is that whole span - BOTH
      // chains, the discarded arc included - so the window drawn on the rail sits in its true place
      // along the axis, and the part of the rail above the window's top edge IS the discarded values.
      const railInner = RAIL.width - RAIL.padLeft - RAIL.padRight
      const railInnerH = CHART.height - CHART.padTop - CHART.padBottom
      const railRef = React.useRef(null)
      const railBrushRef = React.useRef(null)
      /** The y pixel of one event, in the rail's own coordinates rather than the chart's. */
      const railPixelFromEvent = (event) => {
        const element = railRef.current
        if (element === null) return RAIL.padLeft
        const rect = element.getBoundingClientRect()
        if (rect.height === 0) return CHART.padTop
        const raw = ((event.clientY - rect.top) / rect.height) * RAIL.height
        const bottom = CHART.height - CHART.padBottom
        return Math.min(Math.max(raw, CHART.padTop), bottom)
      }
      const railAt = (py) => valueAtY(py, railExtent)
      // The brush the rail's own pointer-up reads. `setBrush` is asynchronous, so the handler cannot
      // read the state it just set; every brush surface in this component keeps a ref that is written
      // on each render, and the rail is no exception.
      railBrushRef.current = brush !== null && brush.rail === true ? brush : null
      const rail = liveChain.length < 2 ? null : React.createElement('svg', {
        ref: railRef,
        className: CLASS.rail,
        viewBox: `0 0 ${RAIL.width} ${RAIL.height}`,
        role: 'img',
        'aria-label': `The value axis' whole extent, with the window on it: ${valueWindowLabel(values, spec.digits)}`,
        onPointerDown: (event) => {
          if (event.button !== 0 || railRef.current === null) return
          const at = railPixelFromEvent(event)
          railRef.current.setPointerCapture?.(event.pointerId)
          setBrush({ from: at, to: at, rail: true })
        },
        onPointerMove: (event) => {
          if (railRef.current === null) return
          const at = railPixelFromEvent(event)
          setBrush((current) => (current === null || current.rail !== true
            ? current : { from: current.from, to: at, rail: true }))
        },
        onPointerUp: (event) => {
          railRef.current?.releasePointerCapture?.(event.pointerId)
          const current = railBrushRef.current
          setBrush(null)
          if (current === null) return
          if (Math.abs(current.to - current.from) < MIN_BRUSH_PIXELS) {
            // A click, not a drag: keep the window's HEIGHT and move it to where the click landed -
            // the same gesture the strip under the chart has, one axis over.
            const half = (values.hi - values.lo) / 2
            const centre = railAt(current.to)
            showYWindow({ lo: centre - half, hi: centre + half })
            return
          }
          showYWindow(brushRangeAt(current.from, current.to, railAt))
        },
      },
      // THE WINDOW ON THE RAIL, drawn between the extent's ends. The rectangle comes from
      // `railWindowPixels`, which is where the y inversion lives.
      //
      // THERE IS NO SPINE DOWN THE RAIL, and its absence is deliberate: at auto the window covers the
      // whole extent, so a line marking the extent would sit exactly under the window's own edges and
      // be invisible - a mark that only appears once the reader zooms is a mark that cannot be used to
      // judge the zoom. The window's edges ARE the extent when they are at its ends, and that is the
      // reading wanted.
      React.createElement('rect', {
        key: 'rail-window', className: CLASS.railWindow,
        x: RAIL.padLeft, width: railInner,
        y: railWindowPixels(values, railExtent, railInnerH).y,
        height: railWindowPixels(values, railExtent, railInnerH).height,
      }),
      // AND THE BRUSH, drawn while the reader is dragging.
      brush !== null && brush.rail === true
        && Math.abs(brush.to - brush.from) >= 1
        ? React.createElement('rect', {
          key: 'rail-brush', className: CLASS.railBrush,
          x: RAIL.padLeft, width: railInner,
          y: Math.min(brush.from, brush.to),
          height: Math.max(1, Math.abs(brush.to - brush.from)),
        })
        : null)

      // The strip is the whole run at a stable scale, with the window drawn on
      // it: the reader can see where they are in the run and jump anywhere,
      // without the strip's own shape changing as they zoom. It is the FULL
      // width of the frame, the gutter included: the strip belongs to no axis.
      const overviewPlot = { left: CHART.padLeft, right: CHART.width - CHART.padRight, lo: bounds.lo, hi: bounds.hi }
      const overviewValues = valueRange([...olderChain, ...liveChain]) ?? { lo: 0, hi: 1 }
      const overviewHeight = OVERVIEW.height - OVERVIEW.padTop - OVERVIEW.padBottom
      const projectOverviewX = (value) =>
        CHART.padLeft + ((value - bounds.lo) / (bounds.hi - bounds.lo))
        * (CHART.width - CHART.padLeft - CHART.padRight)
      const projectOverviewY = (value) =>
        OVERVIEW.padTop + overviewHeight - ((value - overviewValues.lo) / (overviewValues.hi - overviewValues.lo)) * overviewHeight
      const overviewRef = React.useRef(null)
      const overviewBrushRef = React.useRef(null)
      // Every DRAWN marker gets a tick on the strip as well, so the joints are
      // visible on the whole run even when the reader has zoomed somewhere else -
      // and a switched-off category is absent here too, so the strip cannot show
      // a joint the chart above it is not drawing. The strip is drawn in the SAME
      // re-based x as the chart, so a tick sits above the marker it belongs to.
      const overviewMarks = olderChain.length + liveChain.length < 2 ? [] : placedMarkers
        .filter((marker) => {
          const at = chainX(marker.leg)
          return at >= bounds.lo && at <= bounds.hi
        })
        .map((marker, index) => React.createElement('line', {
          key: `ovmark-${marker.leg}-${index}`,
          className: CLASS.markerTick,
          'data-kind': marker.kind,
          'data-leg': String(marker.leg),
          // The strip is inside no element that carries the kind, so the kind's
          // colour is written here as well as in the sheet: see KIND_INK.
          stroke: kindInk(marker.kind),
          x1: projectOverviewX(chainX(marker.leg)), x2: projectOverviewX(chainX(marker.leg)),
          y1: OVERVIEW.padTop, y2: OVERVIEW.padTop + overviewHeight,
        }))
      const overview = olderChain.length + liveChain.length < 2 ? null : React.createElement('svg', {
        ref: overviewRef,
        className: CLASS.overview,
        viewBox: `0 0 ${CHART.width} ${OVERVIEW.height}`,
        role: 'img',
        'aria-label': `The whole run, with the window on it: ${rangeLabel(range, bounds, ghostAt !== null)}`,
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
      // THE STRIP IS THE WHOLE RUN at a stable scale, drawn in the same re-based x
      // as the chart above it: the two passes overlaid, the older one dimmed, so a
      // tick on the strip sits over the marker it belongs to.
      ghostIsShown && olderChain.length >= 2
        ? React.createElement('path', {
          key: 'ovolder', className: CLASS.overviewOlder,
          d: polylinePath(olderChain, projectOverviewX, projectOverviewY),
        })
        : null,
      React.createElement('path', {
        key: 'ovline',
        className: CLASS.overviewLine,
        d: polylinePath(liveChain.length >= 2 ? liveChain : olderChain,
          projectOverviewX, projectOverviewY),
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

      // THE LEGEND IS NOT DECORATION, IT IS THE ONLY PLACE THAT SAYS WHICH SCALE
      // EACH LINE IS ON. Two lines on one frame with different units are
      // readable only if the frame says so, and the axis labels alone cannot:
      // they carry numbers, not names. So the legend names both series, both
      // units, and the side of the frame each one's scale sits on.
      //
      // **AND IT NAMES EVERY LINE ON THE LEFT AXIS, NOT ONLY THE CHIP'S OWN. THE USER'S FIRST REPORT OF
      // 16 OCTOBER 2026, AND THEY HAD TO MAKE IT TWICE.**
      //
      // *"The legend shows only bpb(bpb) for the left axis. it should show all series present for the left
      // axis."* **The first fix went into the OTHER legend** - the one at the foot of the chart, which shows
      // point counts - **and this one still read `${spec.label} (${spec.unit}) · LEFT axis`**, so the user
      // saw `bpb (bpb) · LEFT axis` and reported it again. **THERE WERE TWO LEGENDS AND I FIXED ONE.**
      //
      // THIS IS NOW THE SINGLE LEGEND: one entry per left-axis line, each in its own line's colour, then the
      // right-axis entry. The footer copy that repeated the left-axis names is gone, so the chart says each
      // name once and in one place - which is also what makes `bpb (bpb)` impossible to reintroduce, because
      // the entries come from `legendEntries` rather than from a template string written here.
      const legendIndex = payload === null || payload === undefined ? new Map() : seriesIndex(payload)
      const legendLeft = legendEntries(spec, family, legendIndex)
      // **AND IT IS DRAWN ONLY WHEN THERE IS SOMETHING TO NAME.** MEASURED: this test file asserts that a
      // snapshot with no seed size draws no overlay legend - *"an axis with no numbers on it is furniture,
      // not information"* - and that reasoning holds here too. **A chart with one line and no overlay has
      // nothing for a legend to distinguish**, so the block is skipped rather than drawn with one entry.
      const hasRight = second !== null
      // **`legendLeft` ALREADY CONTAINS THE CHIP'S OWN LINE, SO IT IS THE COUNT OF LINES ON THE FRAME.**
      // MEASURED, and this is why the condition below must not add one: `legendEntries(spec, ...)` always
      // pushes the chip's own entry first and then the family - see its body - so `legendLeft.length` IS the
      // number of left-axis lines. The first version of this line wrote `legendLeft.length + 1`, which
      // counted the chip's line twice and therefore **drew a legend on a chart with a single line**, which
      // the suite's "an axis with no numbers on it is furniture" test caught.
      const legend = (!hasRight && legendLeft.length < 2) ? null
        : React.createElement('div', { className: CLASS.overlayLegend },
          ...legendLeft.map((entry) => React.createElement('span', {
            key: `legend-${entry.key}`, className: CLASS.legendItem, 'data-series': entry.key,
          },
          React.createElement('span', {
            className: CLASS.legendSwatch,
            // **THE SWATCH IS DRAWN FROM THE ENTRY'S OWN INK AND DASH, SO IT CANNOT DISAGREE WITH THE LINE.**
            // MEASURED, the user: *"the legend seems to suggest that it should be some blue shade"* while the
            // line was white, and *"in the graph it is actually a dashed line, whereas the legend seems to
            // suggest that it should be a solid line."* **Both were the same fault: the swatch and the line
            // were styled by different mechanisms.** The swatch carried an inline `borderTopColor` while the
            // line relied on a CSS variable, and every swatch was solid while the sealed line was dashed.
            // One entry now supplies both properties to both places.
            style: {
              ...(entry.ink === null || entry.ink === undefined
                ? {} : { borderTopColor: entry.ink }),
              ...(entry.dash === null || entry.dash === undefined
                ? {} : { borderTopStyle: 'dashed' }),
              // **AND THE WEIGHT, or two solid blue swatches describe two lines a reader still cannot tell
              // apart.** The held-out register is drawn lighter on the chart and its swatch is lighter here
              // for the same reason.
              ...(entry.opacity === null || entry.opacity === undefined || entry.opacity === 1
                ? {} : { opacity: String(entry.opacity) }),
            },
          }),
          // **THE LABEL, AND NOTHING THAT REPEATS IT. THE USER'S FOURTH REPORT, 16 October 2026:**
          // *"there is some redundancy where the graph/chip name seems to also be present in the legend
          // which is not useful."*
          //
          // TWO REDUNDANCIES, AND THIS DROPS BOTH. **The unit is already omitted when it is the same word as
          // the label** - `bpb (bpb)` was the literal string the user objected to two rounds ago - and now
          // **`· LEFT axis` is gone from every entry too**: it is the same three words repeated on four
          // consecutive lines, and a reader learns which side the lines are on from the first entry and is
          // then told three more times. **The axis is stated ONCE, below**, where it can be read as the axis'
          // own fact rather than as part of each line's name.
          (entry.unit && entry.unit !== entry.label ? `${entry.label} (${entry.unit})` : entry.label))),
          hasRight
            ? React.createElement('span', { className: CLASS.legendItem },
              React.createElement('span', { className: CLASS.overlaySwatch }),
              `${second.label} (${second.unit || 'no unit'}) · RIGHT axis`)
            : null,
          // AND THE AXES, SAID ONCE. This is the fact the per-entry suffix was trying to carry, and it is a
          // fact about the FRAME rather than about any one line - see the note above.
          //
          // **IT IS SAID EVEN WITH NO RIGHT AXIS, because "these lines share one scale" is true either way
          // and it is the sentence that names the left axis. MEASURED: gating it on `hasRight` left a chart
          // with four left lines and no overlay naming none of their axes at all** - the per-entry suffix had
          // been carrying that fact, and removing it without this would have removed it from every such
          // chart.
          React.createElement('span', { className: CLASS.hint },
            `the ${legendLeft.length} line${legendLeft.length === 1 ? '' : 's'} on the left axis share one scale`
            + (hasRight ? '; the right axis is separate and on a different scale' : '')))

      return React.createElement(React.Fragment, null,
        windowRow,
        // THE RAIL AND THE FRAME SIDE BY SIDE. `align-items: flex-start` and the rail's fixed width
        // keep the rail's top edge on the chart's, so a reader comparing a value against the frame
        // reads across a level line rather than estimating an offset. The rail is a sibling of the
        // chart and not a child of it: it must not clip, and it must not take the chart's own drags.
        React.createElement('div', { className: CLASS.railFrame }, rail, chart),
        legend, overview,
        breakRegister(breaks, {
          range, bounds, chainX, liveX: liveChain.length > 0
            ? liveChain[liveChain.length - 1][0] : Math.round(bounds.hi),
        }, {
          hiddenKinds, hideOlder, onToggleKind, onToggleOlder,
          // **WHETHER THERE IS HISTORY TO SWITCH OFF AT ALL.** The register cannot work this out for
          // itself: `family` is computed in this component from the payload's index, and the register is
          // handed only the breaks. MEASURED: referencing it there threw `family is not defined` and took
          // twenty-one tests with it, because a throwing render is a blank pane rather than a missing
          // button.
          hasHistory: ghostAt !== null || family.length > 0,
        }))
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
     * disagree with. THE ONE ROW THIS HALF USED TO WRITE ITSELF IS GONE: a
     * snapshot's `break_leg` carried no kind, so the register had a "NO KIND"
     * badge for it, and on 13 October 2026 the user asked for that marker to be
     * removed - "also remove the NO KIND marker at leg 642 or whatever". Every
     * row now states a kind the producer derived from an artifact.
     */
    function breakRow(marker, index) {
      const kindLabel = markerKindLabel(marker)
      // THE LINE, AND NOTHING ELSE, IS WHAT A ROW SAYS AT REST: the shape and
      // colour of its kind, what that kind is, the leg, and what changed there.
      // The reader asked for a status list, and a row that arrives as four
      // paragraphs is not one - on 10 October 2026 the register was reported as
      // "too verbose, it's unreadable ... walls of text". Everything a row knows
      // is still here, one press away, because the reason is why the row exists.
      const headline = marker.label
      const reason = marker.reason
      const body = []
      if (reason !== '') body.push(React.createElement('div', { key: 'reason', className: CLASS.breakReason }, reason))
      if (marker.meaning !== '') {
        body.push(React.createElement('div', { key: 'meaning', className: CLASS.breakMeaning },
          `WHAT THIS ${kindLabel} CHANGE DOES TO THE CURVE: ${marker.meaning}.`))
      }
      if (marker.contradiction !== '') {
        body.push(React.createElement('div', { key: 'contradiction', className: CLASS.breakContradiction },
          `THE LEGS CONTRADICT THIS: ${marker.contradiction}`))
      }
      if (marker.support !== '') {
        body.push(React.createElement('div', { key: 'support', className: CLASS.breakSupport },
          `READ FROM: ${marker.support}`))
      }
      if (marker.declaredInCode) {
        body.push(React.createElement('div', { key: 'declared', className: CLASS.breaksNote },
          "THIS MARKER'S LEG IS A CONSTANT IN THE CODE, not a reading: see the READ FROM line for why "
          + 'no artifact carries it.'))
      }
      const parts = [
        React.createElement('div', { key: 'head', className: CLASS.breakRowHead },
          React.createElement('span', { className: CLASS.swatch, 'data-kind': marker.kind }),
          React.createElement('span', { className: CLASS.breakBadge }, kindLabel),
          React.createElement('span', { className: CLASS.breakLegText }, `LEG ${marker.leg}`),
          headline === '' ? null : React.createElement('span', { className: CLASS.breakWhat }, headline)),
      ]
      if (body.length > 0) {
        parts.push(React.createElement('details', { key: 'why', className: CLASS.why },
          React.createElement('summary', { className: CLASS.whySummary }, 'why this joint is marked'),
          React.createElement('div', { className: CLASS.whyBody }, ...body)))
      }
      return React.createElement('div', {
        key: `row-${marker.leg}-${marker.kind}-${index}`,
        className: CLASS.breakRow,
        'data-kind': marker.kind,
        'data-leg': String(marker.leg),
        // The kind's colour, set here rather than left to the sheet alone: the
        // row's left border, its badge and its swatch all read `--dshtd-kind`, and
        // a swatch whose colour exists only in a sheet that is not applied came out
        // BLACK on a dark card - the "which colour is which kind" question the
        // reader could not answer on 10 October 2026. See KIND_INK.
        style: { '--dshtd-kind': kindInk(marker.kind) },
      }, ...parts)
    }

    /**
     * One category's switch in the key: its swatch in the kind's own SHAPE, its
     * word, and its marker count.
     *
     * The swatch is an SVG built from the same `MARKER_SHAPES` table the chart
     * draws with, so the shape in the key is the shape on the line - not a
     * second drawing of it that is free to drift. When the category is switched
     * off the swatch keeps its shape and its colour and the chip is dimmed with
     * its word struck through: a kind read as "off" by hue alone would be
     * invisible to a reader who cannot separate the hues, and this tab's whole
     * reason for giving every kind a shape is that it does not assume they can.
     */
    function categoryToggle(entry, shown, onToggle) {
      const radius = 4
      const box = radius * 2 + 2
      return React.createElement('button', {
        key: `key-${entry.kind}`, type: 'button',
        className: `${CLASS.toggle}${shown ? '' : ` ${CLASS.toggleOff}`}`,
        'data-kind': entry.kind,
        'data-on': shown ? 'true' : 'false',
        'aria-pressed': shown ? 'true' : 'false',
        title: toggleTitle(entry, shown),
        onClick: () => { if (onToggle !== null) onToggle(entry.kind) },
        // THE SWITCH'S ICON WAS BLACK, and this is why: it is drawn with
        // `fill: var(--dshtd-kind)`, and nothing ever SET that property on a
        // switch - the sheet's per-kind rules name the chart's marks, the label
        // groups, the register rows and the register swatches, and no switch. A
        // custom property that is never set makes the fill invalid at
        // computed-value time, and an SVG shape with no fill is black, so every
        // kind came out the same colour and the key told the reader nothing. The
        // property is set here AND the icon carries the colour itself.
        style: { '--dshtd-kind': kindInk(entry.kind) },
      },
      React.createElement('svg', {
        className: CLASS.toggleIcon, width: box, height: box,
        viewBox: `0 0 ${box} ${box}`, 'aria-hidden': true,
      }, markerSwatch(markerShape(entry.kind), box / 2, box / 2, `swatch-${entry.kind}`,
        CLASS.markerSwatch, kindInk(entry.kind))),
      React.createElement('span', { className: CLASS.toggleLabel }, entry.word),
      React.createElement('span', { className: CLASS.hint }, ` ${entry.count}`))
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
     * THE KEY IS ALSO THE SWITCH, and this is the only place a category can be
     * turned off, because it is the only place that can SAY what turning one off
     * costs. A control somewhere else would hide markers with nothing on screen
     * connecting the control to the lines it removed.
     *
     * @param breaks - `breakView(payload)`.
     * @param chart - `{ range, bounds }` of the chart this register sits under.
     * @param switches - the reader's category switches: `hiddenKinds`,
     *   `hideOlder` and the callbacks. Absent means everything is drawn,
     *   which is what a caller that knows nothing about the switches gets.
     * @returns the block, or null when the snapshot serves no markers — an empty
     *   box would be chrome.
     */
    function breakRegister(breaks, chart, switches = {}) {
      const hiddenKinds = switches.hiddenKinds ?? []
      const hideOlder = switches.hideOlder === true
      // **WHETHER THERE IS HISTORY TO SWITCH OFF AT ALL.** The register cannot work this out for itself:
      // `family` is computed in `SeriesChart` from the payload's index, and the register is handed only the
      // breaks. MEASURED: referencing `family` here threw `family is not defined` and took twenty-one tests
      // with it, because a throwing render is a blank pane rather than a missing button.
      const hasHistory = switches.hasHistory === true
      // Where the newest rollback stands: the key offers the older run's switch
      // only when a rollback put a chain there to switch.
      const ghostAt = rollbackPoint(breaks.markers)
      // **THE REGISTER IS EMPTY CHROME ONLY WHEN IT HAS NOTHING AT ALL TO OFFER.** It used to return null
      // whenever the snapshot served no markers - which is right when the markers ARE the whole block, and
      // wrong once the block also carries the history switch. MEASURED: a run with a family line and no
      // rollback had NO WAY to hide it, because this guard returned before the switch was built. **A
      // rollback is one KIND of history; the reader's switch covers every kind.**
      if (breaks.markers.length === 0 && breaks.skipped === 0 && !hasHistory) return null
      const shown = shownMarkers(breaks.markers, hiddenKinds)
      const hidden = breaks.markers.length - shown.length
      const inWindow = markersInWindow(
        shown, chart === undefined ? null : chart.range,
        chart === undefined || chart.chainX === undefined ? (leg) => leg : chart.chainX).length
      const parts = []
      // THE HEADER IS A COUNT, or it is nothing. "0 of 0 drawn · 0 in this window"
      // is a line that says a reader has nothing to read; when the register has no
      // markers to count, the key below it is the whole block.
      if (breaks.markers.length > 0) {
        parts.push(React.createElement('div', { key: 'head', className: CLASS.breaksHead },
          React.createElement('span', null, 'Break markers'),
          React.createElement('span', { className: CLASS.breaksNote },
            `${shown.length} of ${breaks.markers.length} drawn`
            + `${hidden > 0 ? ` · ${hidden} hidden by your switches` : ''}`
            + ` · ${inWindow} in this window`
            + (shown.length > 0 ? ' · drag on the chart to zoom to one' : ''))))
      }
      if (hidden > 0) {
        // Said in words and not only as a number in the line above, because a
        // chart missing its joints looks exactly like a run with no joints, and
        // those two states call for opposite readings of the same curve.
        parts.push(React.createElement('div', { key: 'hidden', className: CLASS.breaksNote },
          `${hidden} marker(s) hidden by your switches; the curve is unchanged and they come back `
          + 'where they were.'))
      }
      // The key is offered when there is anything to switch: a marker category, OR THE HISTORY. THE
      // FRONTIER'S OWN SWITCH IS GONE with the prediction it hid.
      //
      // **`hasHistory` BELONGS IN THIS CONDITION AND WAS THE SECOND GATE I MISSED.** MEASURED: widening the
      // early return above was not enough, because this line still read `breaks.markers.length > 0 ||
      // ghostAt !== null` - so on a run with a corpus line and NO break markers the whole key was skipped,
      // including the history switch inside it. **A condition that admits a block has to be widened wherever
      // the block is guarded, and there were two places.** The test that caught it mounts a chart with a
      // family, no markers and no rollback, which is exactly the live `c1` arc's shape.
      if (breaks.markers.length > 0 || ghostAt !== null || hasHistory) {
        parts.push(React.createElement('div', { key: 'key', className: CLASS.breaksKey },
          ...markerCategories(breaks.markers).map((entry) => categoryToggle(
            entry, kindIsShown(hiddenKinds, entry.kind), switches.onToggleKind ?? null))))
        // AND THE OLDER RUN'S OWN SELECTOR. It is the second switch of the same
        // kind and for the same reason: the reader must be able to take the
        // discarded chain off the picture - to read the live one alone - and put
        // it back, without losing the axis the two are compared on.
        //
        // **IT IS OFFERED WHENEVER THERE IS HISTORY TO SWITCH OFF, WHICH IS NOT ONLY AFTER A ROLLBACK.**
        // MEASURED: it rendered only when `ghostAt !== null` - the ROLLBACK marker - so on a run that has
        // never been rolled back there was NO WAY to hide the history, even though the family lines draw
        // earlier corpora's readings and the reader may well want them gone. **The user asked for this
        // control by name: *"at the bottom along with the growth markers I want a button to enable/disable
        // showing historical data."*** The marker is an event that creates one KIND of history; the switch
        // belongs to the reader and covers every kind.
        if (hasHistory) {
          const shown = hideOlder !== true
          parts.push(React.createElement('button', {
            key: 'key-older', type: 'button',
            className: `${CLASS.toggle}${shown ? '' : ` ${CLASS.toggleOff}`}`,
            'data-kind': 'older-run',
            'data-leg': ghostAt === null ? '' : String(ghostAt),
            'data-on': shown ? 'true' : 'false',
            'aria-pressed': shown ? 'true' : 'false',
            title: shown
              ? (ghostAt === null
                ? 'The history: the earlier corpora\u2019s own held-out readings, drawn dimmed beside the '
                  + 'live curve. Press to take them off the chart.'
                : `The values before the controller rolled the run back at leg ${ghostAt}: the chain it `
                  + 'threw away, drawn dimmed, and the earlier corpora\u2019s own readings. Press to take '
                  + 'them off the chart.')
              : 'The history is hidden. Its values are still in the window and the axis still covers them. '
                + 'Press to draw them again.',
            onClick: () => { if (switches.onToggleOlder != null) switches.onToggleOlder() },
          },
          React.createElement('svg', {
            className: CLASS.toggleIcon, width: 10, height: 6,
            viewBox: '0 0 10 6', 'aria-hidden': true,
          }, React.createElement('line', {
            className: CLASS.ghostSwatch, x1: 0, y1: 3, x2: 10, y2: 3,
          })),
          React.createElement('span', { className: CLASS.toggleLabel }, 'OLDER RUN'),
          React.createElement('span', { className: CLASS.hint }, ` ≤${ghostAt}`)))
        }
      }
      if (breaks.skipped > 0) {
        // One line, and the count is the whole message: a marker with no readable
        // leg cannot be placed, and a reader who sees fewer rows than the snapshot
        // carries should be told why in as many words.
        parts.push(React.createElement('div', { key: 'skipped', className: CLASS.breakContradiction },
          `${breaks.skipped} marker(s) carry no readable leg and are not drawn.`))
      }
      for (const [index, marker] of shown.entries()) {
        parts.push(breakRow(marker, index))
      }
      return React.createElement('div', { className: CLASS.breaks }, ...parts)
    }

    /** One KPI tile. */
    function Kpi({ label, value, title }) {
      return React.createElement('div', { className: CLASS.kpi, title },
        React.createElement('div', { className: CLASS.kpiLabel }, label),
        React.createElement('div', { className: CLASS.kpiValue }, value))
    }

    /**
     * How much of one fault's error text the notice repeats.
     *
     * A NOTICE IS ONE LINE. The producer's exception message is what says WHICH failure it was, so it is kept
     * - but an exception can carry a whole traceback's last sentence, and a notice that grew a paragraph
     * would be a wall where a sentence was asked for.
     */
    const FAULT_ERROR_CHARS = 160

    /**
     * The snapshot's `faults` list, read defensively into `{ name, error }` entries.
     *
     * The producer publishes one entry per optional series family it could not read:
     * `{"name": "break markers", "error": "RuntimeError: ..."}`. THE CLIENT IS NOT WHERE THAT SHAPE IS
     * TRUSTED: an older body has no key at all, a hand-written one can put a string where an object belongs,
     * and a notice must never be the reason a panel fails to render. An entry survives when it names a
     * family OR carries an error; an entry with an error but no name is labelled rather than dropped,
     * because a silence about a loss is the exact defect this notice exists to remove.
     *
     * @returns an array of `{ name, error }`; `error` is `''` when the entry carries none.
     */
    function faultEntries(faults) {
      if (!Array.isArray(faults)) return []
      const entries = []
      for (const fault of faults) {
        if (typeof fault === 'string') {
          const name = fault.trim()
          if (name !== '') entries.push({ name, error: '' })
          continue
        }
        if (fault === null || typeof fault !== 'object') continue
        const name = typeof fault.name === 'string' ? fault.name.trim() : ''
        // The error is flattened onto one line: a multi-line message would break the notice's line.
        const error = typeof fault.error === 'string' ? fault.error.replace(/\s+/g, ' ').trim() : ''
        if (name === '' && error === '') continue
        entries.push({
          name: name === '' ? 'unnamed family' : name,
          error: error === '' ? '' : clipWords(error, FAULT_ERROR_CHARS),
        })
      }
      return entries
    }

    /**
     * The notice a degraded snapshot wears, or `null` when it lost nothing.
     *
     * **THE SMALLEST RENDER THAT NAMES THE LOSS** (audit finding P12, improvement I2). The producer already
     * says which optional families it could not read; the tab's only job is to put those words on screen
     * beside the chart, in the notice box the panel uses for its other states. Names, not counts: "charting
     * without: sealed reads" is what tells a reader which part of the picture is missing, and a bare number
     * of faults would leave them hunting.
     *
     * A COMPLETE SNAPSHOT RENDERS NOTHING HERE - no `faults` key, or an empty list - so its tree is exactly
     * the tree it was before this notice existed. The panel does not push a `null` child either; that
     * distinction is pinned in both directions by `test/client.test.mjs`.
     */
    function faultNotice(faults) {
      const entries = faultEntries(faults)
      if (entries.length === 0) return null
      const sentence = entries
        .map((entry) => (entry.error === '' ? entry.name : `${entry.name} (${entry.error})`))
        .join('; ')
      return React.createElement('div', {
        // Two classes: the notice box (and its theme tokens) and this notice's own one-line layout. The
        // element carries no colour of its own, so a palette change reaches it through the same rules as
        // every other notice on the panel.
        className: `${CLASS.notice} ${CLASS.faults}`,
        'data-faults': String(entries.length),
        title: entries
          .map((entry) => (entry.error === '' ? entry.name : `${entry.name}: ${entry.error}`))
          .join('\n'),
      },
      React.createElement('span', { className: CLASS.noticeTitle }, 'Charting without: '),
      React.createElement('span', { className: CLASS.noticeBody }, sentence))
    }

    /**
     * The panel: polls the small state route, fetches the series only when the
     * revision moves, and keeps showing the last good payload throughout.
     */
    function Panel({ sessionId, theme } = {}) {
      const [state, setState] = React.useState(null)
      const [payload, setPayload] = React.useState(null)
      // The reader's choice is restored rather than defaulted, because this
      // component is remounted by the pane on events the reader did not cause.
      const [chosen, setChosen] = React.useState(() => rememberedSeries(sessionId))
      // The reader's category switches, restored for the same reason the series
      // choice is: the pane remounts this body on events the reader did not
      // cause, and a switch that resets itself on a poll undoes the reader's
      // work while looking exactly like a refresh.
      const [hiddenKinds, setHiddenKinds] = React.useState(() => rememberedHiddenKinds(sessionId))
      const [hideOlder, setHideOlder] = React.useState(() => rememberedHideOlder(sessionId))
      const [failure, setFailure] = React.useState(null)
      const revisionRef = React.useRef(null)

      React.useEffect(() => { rememberSeries(sessionId, chosen) }, [sessionId, chosen])
      React.useEffect(() => { rememberHiddenKinds(sessionId, hiddenKinds) }, [sessionId, hiddenKinds])
      React.useEffect(() => { rememberHideOlder(sessionId, hideOlder) }, [sessionId, hideOlder])

      /**
       * Switch one marker category off, or back on.
       *
       * The chart, the strip and the register all read this one list, so the
       * three views of a marker cannot disagree about whether it is drawn.
       */
      const toggleKind = React.useCallback((kind) => {
        setHiddenKinds((current) => (current.includes(kind)
          ? current.filter((item) => item !== kind)
          : [...current, kind]))
      }, [])
      /**
       * Take the chain a rollback threw away off the chart, or put it back.
       *
       * The axis does not move either way: the older values are still in the
       * window and the window is the reader's, so hiding them is a statement
       * about the picture and not about how much run there has been.
       */
      const toggleOlder = React.useCallback(() => {
        setHideOlder((current) => !current)
      }, [])

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
      // THE LEG TILE'S OWN SOURCE, not the headline's point: a run whose corpus has no bpb still
      // trains legs, and the tile asking "which leg is this" must not answer "no held-out reading".
      const latestLegPoint = latestLeg(payload)
      const latestWall = lastPoint(payload, 'train/wall_seconds')
      const latestVram = lastPoint(payload, 'memory/vram_peak_gib')
      const latestExam = lastPoint(payload, 'eval/exam_accuracy')
      const latestUnits = lastPoint(payload, 'train/units_per_second')
      // The seed model's size, for the header tile and for the second line on the
      // chart. ONE resolution, read once, so the tile and the line cannot
      // disagree about which series the number came from.
      const overlay = React.useMemo(() => resolveOverlay(payload), [payload])

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

      // **A DEGRADED REFRESH SAYS SO IN THE TAB, BESIDE THE CHART IT DEGRADED.** The producer names every
      // optional family it could not read in the body's `faults` list (the repaired producer, 5 November
      // 2026), and until now the tab drew the chart it could and stayed silent - the audit's finding P12.
      // It reads the BODY being drawn and not the host's `/state` echo, so the notice can only ever describe
      // the snapshot on screen. A complete snapshot yields `null` here and the panel does not push it, which
      // is what keeps a complete panel's tree identical to the tree it rendered before this notice existed.
      const degraded = payload === null ? null : faultNotice(payload.faults)

      const kpis = React.createElement('div', { className: CLASS.kpis },
        React.createElement(Kpi, {
          label: 'leg',
          value: latestLegPoint === null ? '—' : String(Math.round(latestLegPoint[0])),
          title: latestLegPoint === null
            ? 'no live leg series in this snapshot'
            : `the newest leg any live train series carries`,
        }),
        React.createElement(Kpi, {
          label: seriesLabel(headlineTag),
          value: latestReading === null ? '—' : formatValue(latestReading[1], 4),
          title: headlineTag === null
            ? 'no held-out reading in this snapshot'
            : (headlineTag === 'sealed/bpb'
              // The sealed read is the saved checkpoint scored over the held-out partition - a real
              // held-out reading, but the controller can mark one HELD non-authoritative (the books
              // run's leg-17 read is), so this does not claim it is steering the menu.
              ? 'sealed/bpb, the sealed read of the saved checkpoint over the held-out partition'
              : `${headlineTag}, the held-out reading the run is steered by`),
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
        }),
        // The seed model's own size, beside the reading it buys. Its value is
        // formatted through the SAME spec the second line's axis uses, so the
        // tile and the right-hand axis always show the same number the same way.
        React.createElement(Kpi, {
          label: overlay === null ? 'seed size' : overlay.label,
          value: overlay === null ? '—'
            : `${formatValue(overlay.series.points[overlay.series.points.length - 1][1] * overlay.scale,
              overlay.digits)}${overlay.unit === '' ? '' : ` ${overlay.unit}`}`,
          title: overlay === null
            ? 'this snapshot carries no seed model size; the chart draws no second line'
            : `${overlay.tag} — drawn as the dashed line against the axis on the right, `
              + 'from the run\'s own leg logs (the read\'s live rows and the trainable rows)',
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
          // The whole snapshot body goes in, so the break markers
          // and the seed model's size are read from the SAME snapshot as the
          // curve under them.
          React.createElement(SeriesChart, {
            spec: activeSpec, payload, overlay, hiddenKinds, hideOlder,
            onToggleKind: toggleKind,
            onToggleOlder: toggleOlder,
          }),
          // **AND THE FOOTER NO LONGER REPEATS THE CHART'S LEGEND.** It carried a second copy of the left-axis
          // names, added when the chart's own legend was thought to be the only place they could live. **Two
          // legends naming the same lines is how `bpb (bpb)` survived a fix: the user reported it once, the
          // fix went into this copy, and the OTHER copy still said it.** What is left here is the one fact
          // the chart's legend does not carry - where the numbers came from - and nothing else.
          React.createElement('div', { className: CLASS.legend },
            React.createElement('span', { className: CLASS.legendItem },
              `${activeSpec.familyPointCount ?? activeSpec.series.points.length} points`
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
            `${ageSentence(state)} Older than the ${state.refreshSeconds}s refresh, so the newest step `
            + 'may be missing.'))
        : null

      const body = payload === null
        ? React.createElement('div', { className: CLASS.empty }, 'No series to draw yet.')
        : React.createElement(React.Fragment, null, kpis, chips, chart)

      // **THE MODE COMES FROM THE HOST'S STATE ROUTE, AND IT IS `auto` WHEN THE FIELD IS ABSENT** - which is
      // what an older host serves, and what a host that has never been told a mode should mean. `auto` writes
      // NO attribute, so the stylesheet's `prefers-color-scheme` block decides; see `themeMode`.
      //
      // **THE `theme` PROP WINS WHEN IT IS GIVEN**, because the host is what knows the mode it was configured
      // with and the state field is a convenience for it. A caller that passes neither - which is every
      // existing mount - gets `auto`, so nothing that was working changes behaviour.
      //
      // **AND THE DEGRADED NOTICE IS PUSHED ONLY WHEN IT EXISTS.** Passing it as an extra child would put a
      // `null` in the middle of a complete panel's children where there was none before; the children array
      // below is the pre-existing five, in the pre-existing order, unless a fault list names a loss.
      const footnote = React.createElement('div', { className: CLASS.footnote },
        state?.snapshotPath ? `reading ${state.snapshotPath}` : 'reading the configured snapshot')
      const children = [head]
      if (degraded !== null) children.push(degraded)
      children.push(notice, stale, body, footnote)
      return React.createElement('div', {
        className: CLASS.panel,
        [THEME_ATTRIBUTE]: themeAttribute(theme ?? state?.theme),
      }, ...children)
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
      // THE EMITTED STYLESHEET, so a test can read what the browser will actually be given rather than
      // what the source appears to say. It is needed because the rail's size is a CSS figure that the
      // geometry constants are interpolated into, and the failure that made that matter - a rail with
      // no width, which the browser scaled up to fill the lane and which took the screen - was
      // invisible to every test that only looked at the tree.
      CSS,
      seriesIndex,
      availableSeries,
      chipSeriesLabel,
      familyMembers,
      isFamily,
      familyInk,
      lineDress,
      legendEntries,
      CORPUS_INK,
      HISTORY_INK,
      themeMode,
      themeAttribute,
      THEME_ATTRIBUTE,
      isSparseReadings,
      SPARSE_COVERAGE,
      isTraceTag,
      lastPoint,
      niceTicks,
      formatValue,
      polylinePath,
      describeAge,
      ageSentence,
      emptyReason,
      // The degraded-refresh notice: the list the producer publishes, read into names, and the element the
      // panel wears when that list is not empty. Exported so a test can pin BOTH directions without a DOM -
      // no notice on a complete snapshot, one notice naming every lost family otherwise.
      faultEntries,
      faultNotice,
      FAULT_ERROR_CHARS,
      CHART,
      OVERVIEW,
      fullRange,
      clampRange,
      zoomRange,
      panRange,
      pointsInRange,
      pointsToDraw,
      valueRange,
      // THE VERTICAL WINDOW'S PIECES, exported so a test can drive them without a DOM. The zoom and
      // pan helpers above are deliberately NOT re-exported under new names: the vertical axis uses
      // `zoomRange` and `panRange` themselves, and a second name for one function is how two
      // implementations start.
      rememberedYWindow,
      rememberYWindow,
      yTag,
      valueAtY,
      Y_MIN_WINDOW_FRACTION,
      // THE RAIL'S PIECES: the generic brush the horizontal strip and the vertical rail both go
      // through, its readout, and its geometry.
      brushRangeAt,
      valueWindowLabel,
      sameWindow,
      RAIL,
      railWindowPixels,
      resolveSelection,
      splitOffered,
      disclosureForced,
      headlineReading,
      latestLeg,
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
      rememberedHiddenKinds,
      rememberHiddenKinds,
      plotGeometry,
      clampChartPixel,
      valueAt,
      brushRange,
      rangeLabel,
      breakView,
      readBreakMarkers,
      markerKindWord,
      markerKindLabel,
      markerTagText,
      markerTooltip,
      clipWords,
      layoutMarkerLabels,
      markerLaneY,
      KIND_ORDER,
      UNKNOWN_KIND,
      OVERLAY_TAGS,
      OVERLAY_TAG_PREFIX,
      OVERLAY_GUTTER,
      OVERLAY_TAG_PREFIX,
      LOG_SCALE,
      LINEAR_SCALE,
      LOG_FLOOR_PADDING,
      LOG_TICK_MIN_GAP,
      isLogScale,
      logFraction,
      logRange,
      logTicks,
      AXIS_LABEL_GAP,
      AXIS_UNIT_WIDTH,
      OVERLAY_GUTTER,
      PAD_LEFT,
      CURRENT_VALUE_WIDTH,
      CURRENT_VALUE_RAIL_X,
      CURRENT_VALUE_RAIL_WIDTH,
      LABEL_BASELINE,
      CURRENT_VALUE_MIN_SEPARATION,
      CURRENT_VALUE_INSET,
      CURRENT_VALUE_MIN_SEPARATION,
      OVERLAY_INK,
      PRIMARY_INK,
      // The kind inks, exported for the same reason as the two above: a test
      // reads them against the stylesheet's own `--dshtd-kind` values, so the
      // colour the elements write and the colour the sheet names cannot drift.
      KIND_INK,
      kindInk,
      // The stylesheet itself, so a test can check that the colours the elements
      // write and the colours the sheet names have not drifted apart.
      CSS_SOURCE: CSS,
      currentValueLabels,
      isOverlayTag,
      overlayLabel,
      resolveOverlay,
      valueAtX,
      resampleOnto,
      axisLabelText,
      axisTickLabels,
      unitWithoutScale,
      sharedGridlines,
      inverseOf,
      currentValueLabels,
      axisUnitTitle,
      kindIsShown,
      shownMarkers,
      markersInWindow,
      markerCategories,
      anyKindHidden,
      toggleTitle,
      kindsPresent,
      rollbackPoint,
      splitOlder,
      olderIsShown,
      rememberedHideOlder,
      rememberHideOlder,
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
    }
    return module.exports
  },
})
