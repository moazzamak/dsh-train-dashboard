# dsh-train-dashboard

A training dashboard for the DeepSeek Harness (DSH). It adds a **Training
dashboard** tab to the right pane, beside Files, Terminal and Document, and
charts a JSON snapshot of a training run: a KPI header, one series at a time on
its own axis, the joints that make the series incomparable marked on the chart
with the reason for each, and the next expected transition stated ahead of the
curve.

The plugin does **not** parse your logs. It runs a command of your own, that
command writes the snapshot JSON described below, and the tab reads it. So the
plugin works with any training setup whose numbers you can get into that shape,
and it never competes with your own parser for the truth about a run.

- no build step, no runtime dependencies, plain JavaScript in two files
- no process at all unless a tab is open and the snapshot is older than
  `refreshSeconds`
- never writes anything itself: the snapshot is written by your command, and it
  is the only file the plugin causes to be written
- the age of the numbers is always on screen, so a stale chart can never be
  mistaken for a live one
- every word a break marker shows is your snapshot's own: the tab chooses where
  a marker sits and how it reads, never what it says

Package version **0.3.0** — snapshot contract version **1**.

---

## What you get

| region | content |
| --- | --- |
| header | the run's name, the snapshot's age with a fresh/stale badge, a Refresh button |
| KPI row | latest step, headline series, step wall time, throughput, memory peak, evaluation accuracy |
| chips | the series to chart, best-first; any other series the snapshot carries is appended |
| chart | ONE series at a time on its own axis, with every break marker drawn on it, over a timeline you can select |
| register | under the chart: every break marker in full — its leg, its kind, its reason, what that kind does to the curve, and where it was read from |
| frontier | under the register: the next expected transition, named as an expectation and not as a fact |
| footer | the snapshot path being read |

**One series at a time is deliberate.** Series carry different units — bits per
byte, seconds, GiB, accuracy, counts — and drawing them on one axis would invite
exactly the comparison the axis cannot support.

### Breaks, kinds and the frontier

A long run crosses boundaries that are not learning, and a rise across one of
them is not the model getting worse. The snapshot can carry them, and the tab
draws each one as a vertical line labelled with its leg, its kind and the first
words of its own reason. Kinds are colours **and** words, because the words are
what say whether the joint can be compared across:

| kind | what it means on the chart |
| --- | --- |
| `corpus` | the data changed, so a rise here is expected and is not a regression |
| `instrument` | the reading changed, so the joint is a level shift measured on different terms: no slope across it |
| `arithmetic` | the numbers changed, so the series is not comparable across the joint at all |
| `shape` | the leg's geometry changed with its volume held constant, so the metric stays comparable and the wall clock moves |
| `restart` | the process restarted, and the work of that window is not in the series |

A kind the tab has never seen is still drawn, with its own name; a marker whose
kind the snapshot omits is labelled `UNKNOWN` rather than shown as if the kind
were known. Markers whose labels would collide are stacked so that no two write
over each other, and every marker also gets a dim tick on the strip under the
chart, so the joints are visible even when you have zoomed somewhere else.

The **register** under the chart is where the markers read in full: the reason,
the sentence your snapshot carries for that kind, the evidence the marker was
read from, and any contradiction the snapshot attaches. Markers that fall
outside the window on screen, or past the last point of the series, still appear
there — the chart can only draw what its axis covers, and a marker that is
missing from the picture without a word about it is a marker nobody finds.

The **frontier** is the next expected transition, drawn as a dashed line in a
lane of its own and labelled `next corpus change expected around leg N`. It is
deliberately not drawn like the markers above it: those are read from artifacts
that exist, and this one is a projection. The tab says so, in the block under
the register, and it also says why its dashed line may not be on the chart yet.

**Both the markers and the frontier come from your snapshot, in your words.** The
tab does not decide that a rise is expected, that a joint is a level shift or
that a transition is coming; it draws what your producer derived and repeats its
sentences, so the chart and your own record cannot tell different stories about
one run.

### Selecting the timeline

The chart opens on the whole run, and the axis rescales to whatever window you
select. That is the point of the interaction: on a long run one early spike can
flatten the last few thousand steps — the part you are steering — into a
straight line.

| gesture | effect |
| --- | --- |
| drag across the chart | zoom to that window |
| wheel | zoom about the pointer |
| drag (or click) the strip under the chart | select on the whole run; a click moves the window there without changing its width |
| `+` / `−` / `Reset` buttons | zoom in, zoom out, back to the whole run |
| `+` `-` `0` `←` `→` with the chart focused | the same, from the keyboard; `Esc` also resets |
| double-click | back to the whole run |

The strip under the chart is always the entire run at a fixed scale, with the
current window drawn on it, so you can see where you are and jump anywhere. The
readout above the chart names the window in steps — `steps 120–480 · 360 of 1200
shown` — and the chart's accessible name carries the same numbers, because a
range that exists only as a dragged rectangle is a range a screen reader cannot
report.

There are two ways to open the tab: a chart glyph in the session header's action
row (the `conversation.session.header.actions` seat, beside the shipped jobs and
subagent controls at the top of the session), and the pane's "+" guide menu.

## How it gets its data

```
your project                          plugin host half                 browser tab
────────────                          ────────────────                 ───────────
whatever your run writes
(metrics.jsonl, per-step logs,
 evaluation reports, a database)
        │
        │  YOUR command, run by the plugin
        │  at most once per refreshSeconds
        ▼
the snapshot JSON  ────────────────▶  GET /dsh-train-dashboard/state  ──▶ polled every 5 s
(the contract below)                  GET /dsh-train-dashboard/series ──▶ fetched only when
                                      (runs nothing itself)                the revision moves
```

Two readers, one parser: yours. A JavaScript re-implementation of your parsing
would be free to disagree with it, and then the tab and your own records would
tell different stories about one run with nothing on screen saying which is
wrong.

**The routes:**

| route | purpose |
| --- | --- |
| `GET /dsh-train-dashboard/state` | small JSON: revision, age, staleness, whether a rebuild is in flight, whether this host can rebuild at all, and the exact command it would run |
| `GET /dsh-train-dashboard/series` | the whole snapshot body, plus `ok: true`; `503` while there is nothing yet |
| either | `GET` only; anything else is `405` with `allow: GET` |

`/state` is what the tab polls every 5 seconds. `/series` is fetched only when
the revision changes, so a tab sitting open costs one small file read every few
seconds and no process at all: the spawn happens only when the snapshot is
older than `refreshSeconds`, and only one spawn can be in flight.

The host half is also usable on its own, without the browser tab, by anything
that can make an HTTP request to the harness.

## The snapshot contract

Your command writes one JSON file. That file is the whole interface between your
project and this plugin. This is a complete example:

```json
{
  "snapshot_version": 1,
  "generated_at": "2026-01-31T09:15:00Z",
  "revision": "1738314900",
  "arm": "run-7",
  "break_leg": 500,
  "series": [
    { "tag": "train/loss", "source": "metrics.jsonl", "points": [[1, 3.204], [2, 3.011], [3, 2.876]] },
    { "tag": "train/wall_seconds", "source": "step logs", "points": [[1, 41.2], [2, 39.8], [3, 40.5]] },
    { "tag": "memory/vram_peak_gib", "source": "step logs", "points": [[1, 11.4], [2, 11.6], [3, 11.5]] }
  ],
  "annotations": [],
  "breaks": [
    {
      "leg": 380,
      "kind": "corpus",
      "label": "corpus_a to corpus_b",
      "reason": "the corpus changed, so a rise in bits per byte here is expected.",
      "support": "the legs' own log names",
      "derived": true,
      "contradiction": "",
      "meaning": "the DATA changed, so a rise in bpb here is EXPECTED"
    }
  ],
  "frontier": {
    "phase_now": "corpus_b",
    "next_phase": "corpus_c",
    "boundary_leg": 380,
    "next_leg": 460,
    "legs_in_phase": 80,
    "legs_remaining": 61,
    "expected_to_raise_bpb": false,
    "imminent": false,
    "sentence": "FRONTIER: corpus_b is being trained; the next corpus transition is corpus_b to corpus_c at about leg 460."
  },
  "counts": { "points": 9 },
  "sources": "metrics.jsonl + step logs"
}
```

| field | required | what it does |
| --- | --- | --- |
| `snapshot_version` | **yes** | Must be the number `1`. Any other value is refused as *unusable* and the tab says so; it does not offer a rebuild that would not help. |
| `generated_at` | strongly recommended | ISO-8601 timestamp of when the numbers were **read**. Drives the age badge and the stale banner. Without it the tab reports the snapshot as stale, because it cannot know the age. |
| `revision` | recommended | Any string that changes when the contents change: a timestamp, a file mtime, a hash. The tab fetches the series body only when this moves. If you omit it, `generated_at` is used as the revision. |
| `arm` | optional | The run's own name, shown in the header as `run <arm>`. |
| `break_leg` | optional | One x value to mark, for a producer that has one joint and no kind for it. It is drawn as a dashed marker labelled `BREAK`, and the tab says in the register that it is not claiming a kind for it. |
| `breaks` | optional | An array of markers, each derived from your own artifacts. See below. |
| `frontier` | optional | The next expected transition. See below. |
| `series` | yes (may be empty) | The array of series to chart. |
| `series[].tag` | yes | The series name. A slash groups it: `train/loss`, `memory/vram_peak_gib`. |
| `series[].points` | yes | Array of `[x, y]` pairs of finite numbers. `x` is the step axis. A pair that is not two finite numbers is dropped; a series left with nothing is not offered at all. |
| `series[].source` | optional | Short string naming where the numbers came from; shown in the chip tooltip and the legend. |
| `annotations` | optional | Free-form array, forwarded to the browser untouched. |
| `counts` | optional | Free-form object, e.g. `{"points": 4123}`; echoed by `/state`. |
| `sources` | optional | String naming the producer's inputs; echoed by `/state` as `snapshotSources`. |

### `breaks[]`: the markers

| field | required | what it does |
| --- | --- | --- |
| `leg` | **yes** | The x value the marker sits at. A marker without a readable `leg` cannot be placed on an axis: it is counted and reported under the chart rather than dropped in silence. |
| `kind` | strongly recommended | One of `corpus`, `instrument`, `arithmetic`, `shape`, `restart` — or any other word, which is drawn and named as it is. Omitted, the marker is labelled `UNKNOWN`. |
| `label` | recommended | A few words naming the change (`corpus_a to corpus_b`, `512 to 256 steps a leg`). Drawn on the chart, cut on a word boundary if it does not fit. |
| `reason` | recommended | The sentence that says what happened and whether a move across it is expected. Shown in full in the register. |
| `meaning` | recommended | What this kind of change does to the curve. Shown in the register under `WHAT THIS <KIND> CHANGE DOES TO THE CURVE:`. |
| `support` | optional | Where the marker was read from, in a sentence a reader can check. Shown as `READ FROM:`. |
| `derived` | optional | `false` marks a leg that is a constant in your code rather than a reading; the register then says so. Absent means nothing is claimed either way. |
| `contradiction` | optional | Set when your own evidence contradicts the change the marker names. Shown prominently, because hiding it would leave the chart claiming a change the legs do not show. |

Markers are drawn oldest first. Several markers on one leg are fine: their
labels are stacked so they cannot overlap.

### `frontier`: the next expected transition

| field | required | what it does |
| --- | --- | --- |
| `phase_now` | recommended | The corpus being trained now. |
| `next_phase` | recommended | The corpus expected next. Empty means none is scheduled, and the tab says exactly that instead of naming a leg. |
| `next_leg` | recommended | The leg the transition is expected at — a projection from your own budget, so the tab reads it as `expected around leg N`. |
| `boundary_leg` | optional | The first leg of the current phase. With `imminent: true`, this is the leg the tab draws, because nothing is left to predict. |
| `legs_in_phase`, `legs_remaining` | optional | Context for the frontier; shown inside `sentence` when your producer writes one. |
| `expected_to_raise_bpb` | optional | `true` when a rise in bits per byte is expected at the transition. The tab then says so beside the expected leg. |
| `imminent` | optional | `true` when the next leg trained is already the new corpus. The wording moves from `expected around leg N` to `changes AT LEG N`. |
| `sentence` | recommended | Your own full statement about the frontier. Shown verbatim, under the tab's note that it is an expectation and not a measurement. |

The tab always adds one caveat of its own to the frontier — that the leg is a
projection from your budget and the rise is a direction rather than a magnitude
— and it says why a dashed line that is past the end of the series is not on the
chart. Everything else on screen is your text.

**Tags the tab already has labels and units for** (a convenience, not a
requirement — any other tag is still charted, labelled by its own tag):

| tag | label | unit |
| --- | --- | --- |
| `train/bpb_sealed` | sealed bpb | bpb |
| `train/bpb_legval` | leg-val bpb | bpb |
| `train/wall_seconds` | leg wall time | s |
| `train/units_per_second` | units/s | u/s |
| `train/gnorm` | grad norm | — |
| `train/vocabulary_size` | vocab size | — |
| `memory/vram_peak_gib` | VRAM peak | GiB |
| `memory/vram_headroom_gib` | VRAM headroom | GiB |
| `eval/exam_accuracy` | exam accuracy | — |

Tags shaped like per-step traces (`vram_trace/…`, `anything/trace/…`,
`something_trace`) are kept out of the chip list entirely: one chip per step
would bury the series you came for. Give such a series a tag without that shape
if you want it offered.

### Writing a producer

Any program in any language that can write this file will do. Two rules make it
pleasant to live with:

1. **Write it atomically** (temp file plus rename). The tab polls the file while
   you write it; a torn read is handled — the tab keeps the last good numbers —
   but it should not happen on purpose.
2. **Make `revision` change exactly when the numbers change.** A file mtime, a
   row count or a hash all work. If it never changes, the tab never refetches
   the series.

The whole contract, in one Python function:

```python
# snapshot_writer.py — replace the reading below with your own.
import json, os, tempfile, time

def write_snapshot(path, leg, loss):
    body = {
        "snapshot_version": 1,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "revision": str(os.stat("metrics.jsonl").st_mtime),  # changes when the data does
        "arm": "run-7",
        "series": [
            {"tag": "train/loss", "source": "metrics.jsonl", "points": [[leg, loss]]},
        ],
    }
    directory = os.path.dirname(os.path.abspath(path)) or "."
    handle, temporary = tempfile.mkstemp(dir=directory, suffix=".tmp")
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        json.dump(body, stream)
    os.replace(temporary, path)  # atomic: a reader never sees half a file
```

Then point the plugin at it:

```yaml
command: [python3, snapshot_writer.py, --out, "{snapshot}"]
```

## Configuration

The plugin has one composition row. Its `config` is **replaced wholesale** by a
higher patch layer and never deep-merged, so a profile that overrides the row
must restate every key it cares about.

```yaml
- id: train-dashboard
  name: dsh-train-dashboard
  config:
    workspace: /absolute/path/to/your/project
    command: [python3, -m, your_project.snapshot_tool, --out, "{snapshot}"]
    snapshotPath: train-dashboard.snapshot.json
    refreshSeconds: 30
    timeoutSeconds: 120
```

| key | default | meaning |
| --- | --- | --- |
| `workspace` | `''` — **set it** | Absolute path. The command's working directory, and the base that `snapshotPath` and any relative path resolve against. A host process can start in the profile directory, where a relative path resolves to nothing, so name it. |
| `command` | `[]` — **set it** | The argv of your producer, one word per list item. **Not a shell string**: no shell is involved, so quoting and `&&` do not apply. |
| `snapshotPath` | `train-dashboard.snapshot.json` | Where your command writes and the tab reads. Relative to `workspace`, or absolute. |
| `arm` | `''` | Optional label shown in the header when the snapshot does not name the run itself. |
| `refreshSeconds` | `30` | Minimum spacing between regenerations, and half the staleness threshold (a snapshot older than twice this is reported stale). Raise it, do not lower it, while a training job is running on the same machine. |
| `timeoutSeconds` | `120` | A regeneration is abandoned after this and reported, rather than leaving a spinner forever. |
| *any other key* | — | Kept as written, and usable as a `{placeholder}` in `command`. |

**Placeholders in `command`.** `{snapshot}` becomes `snapshotPath`,
`{workspace}` becomes `workspace`, and any other `{name}` becomes the config key
of that name. So a producer with its own arguments declares them as keys:

```yaml
    command: [my-tool, --logs, "{logsDir}", --run, "{arm}", --out, "{snapshot}"]
    logsDir: logs/train
    arm: run-7
```

An unknown placeholder is left as written rather than blanked, so a typo shows
up in the command the tab prints instead of silently becoming an empty argument.

**What the plugin does with the command.** It runs it with `cwd` set to
`workspace`, captures up to 256 KB of each of stdout and stderr (the last few
stderr lines are shown when the exit code is not zero), and asks it to stop
after `timeoutSeconds`, with a short grace period. Success is judged by the
snapshot, not by the exit code: a command that exits zero without writing a
readable snapshot has not answered the tab's question, and one that writes a
good snapshot has.

## Install

Install the bundle into a profile with the plugin manager:

```
dsh plugin --profile <profile> add github:moazzamak/dsh-train-dashboard
```

Target the profile you actually boot, then restart the harness. The row arrives
with placeholder values, so **set `workspace` and `command` before expecting a
chart**; until then the tab says a command has not been configured.

**To see the tab afterwards, expect to reload the page or restart DSH.** The
shipped `dsh-client-hmr` package delivers ordinary plugin enable/disable changes
to an open page over `/plugins/events` without a page reload, but it states its
own limit plainly: "Web transport only — Electron installation and backend
restart handling do not use this SSE path." Nothing here needs
`pnpm run dev:web`: there is no build step, so there is no bundle of ours to
rebuild.

### From a local checkout

Point the profile at this directory instead. In the profile directory
(`~/.dsh/profiles/<profile>`):

1. add this package as a dependency, with a `file:` specifier pointing at this
   directory;
2. append its name to `dsh.profile.bundles` in the same `package.json`, so the
   bundle patch in this package is applied;
3. run `pnpm install --no-frozen-lockfile`, with `CI=true` set: pnpm refuses to
   remove the modules directory without a terminal, and under `CI` it defaults
   to a frozen lockfile that the new dependency invalidates;
4. restart the harness, and confirm the boot audit lists no pending entry.

Back up `package.json` first. If the install fails, restore it, otherwise the
profile is left declaring a dependency that is not there and can fail to boot.

## What it costs

- **No tab open, no cost.** Nothing is polled and nothing is spawned.
- **Tab open, fresh snapshot.** One small JSON read every 5 seconds, and no
  process at all.
- **Tab open, stale snapshot.** The same poll, plus your command once per
  `refreshSeconds`, single-flight. The only cost the plugin itself adds is
  process start plus one file read; the rest is whatever your producer does, so
  make it cheap or raise `refreshSeconds`.

## When things are wrong

A snapshot is written while the tab reads it, so a missing, stale or
half-written one is **normal**, not exceptional. Every one of those states shows
the last numbers it has with their true age, and says what is being done:

| state | what the tab shows |
| --- | --- |
| no snapshot, host can rebuild | "No snapshot yet", what pressing Refresh will do, and the exact command it will run |
| no snapshot, no command configured | that no command is configured and which config key to set |
| no snapshot, host cannot rebuild (no subprocess provider) | the same, but saying so — so nobody waits for a rebuild that will never come |
| snapshot present but unreadable (version mismatch, not JSON) | the host's own words, and that rebuilding will **not** fix it |
| snapshot older than twice the interval | the chart still drawn, under a banner saying these are real numbers and not the newest |
| snapshot with no readable `generated_at` | the numbers charted, the badge reading "age unknown", and the banner saying the age cannot be told |
| a read that fails after a good one | the last good numbers are kept, with their age — never a blank chart |
| the host is unreachable | the transport error, in a notice, with the rest of the panel intact |

## Files

| file | role |
| --- | --- |
| `package.json` | the manifest: `dsh.bundle.patch`, `dsh.client`, and the `./client` export |
| `cordis.patch.yml` | **one** insert row, with placeholder defaults to replace |
| `index.mjs` | host half: the two routes, the snapshot read, the bounded single-flight spawn |
| `client.cjs` | browser half: the right-pane tab, the header action row trigger, and the hand-drawn SVG chart |
| `test/host.test.mjs` | 28 tests — the deferred registration, the read path, the spawn bounds, the pass-through |
| `test/client.test.mjs` | 54 tests — the slot wiring, the pure helpers, the freshness rules, the break markers and the frontier |
| `test/live-smoke.mjs` | opt-in end-to-end check against a real project and a real command |

```
npm test          # node --test test/host.test.mjs test/client.test.mjs
npm run check     # node --check index.mjs && node --check client.cjs
npm run test:live # needs DSH_TRAIN_DASHBOARD_WORKSPACE and ..._COMMAND; see the file
```

The live smoke test prints what it is missing and exits 0 when it is not
configured, so a fresh clone never carries a red test nobody can satisfy.

### Why there is no chart library here

Zero runtime dependencies, no build step, plain JavaScript, and the chart is
hand-written SVG. This is not minimalism for its own sake:

- the DSH client forbids importing Harness Client packages
  (`@deepseek-ai/dsh-client-ui-primitives` and friends) because they change
  without notice and a throwing component blanks the slot entry;
- adding a charting library would add a second module the client loader has to
  resolve, and the loader resolves only the platform seed table, boot-graph
  rows, and registered factories — anything else throws;
- `d3` was not needed for one line chart, one axis and a break marker.

Zooming is a change of DOMAIN, not an SVG `transform`. Scaling the viewBox would
also scale the strokes and the tick labels with it, so a zoomed chart would be a
blurrier chart; recomputing the projection keeps every stroke one pixel and lets
the ticks be the standard nice ones for the window on screen.

## Design rules this follows, and the defects behind them

Each of these is a mistake some plugin in this harness has already paid for once:

- **One row in the patch.** The boot audit fails on any entry left pending, so a
  second row that waited for the browser carrier would break the headless, SDK
  and ACP profiles, which never have one.
- **No `ctx.shell`.** A desktop profile may mount no shell-executor row, and
  Cordis resolves an absent injected service *leniently*: the call registers
  fine and fails only on first use. This half uses `ctx.fs` and `ctx.subprocess`.
- **The browser carrier is read in `ctx.inject`, never in `apply`.** Reading it
  during `apply` sees `undefined`, and the plugin then loads, the tab opens, and
  every fetch 404s.
- **No exported `Config` class.** Cordis reads an exported `Config` as a schema
  and calls `Config['~standard'].validate` on it unconditionally, so the fiber
  dies at boot with no routes and the browser sees 404s that look like a missing
  snapshot. The function here is called `normalizeConfig`.
- **The tab body registers under the tab definition's `id`, not its `kind`.**
  The pane dispatches with `entryKey: definition.id ?? tab.kind`, so a body
  keyed by `kind` renders the pane's own "Nothing here can view this kind of
  content yet." over a tab whose chip titles itself correctly.
- **Every slot registration names its slot.** A registration without `name`
  throws while `apply` runs, which the desktop application treats as a failed
  startup.
- **An empty command is a state, not a crash.** With no `command` configured the
  host spawns nothing, reports `canRefresh: false`, and the tab says which key
  to set — instead of running an empty argv and reporting a mystery.
- **The plugin never writes into your run directory.** The only file it causes
  to be written is the snapshot, by your command, and the tab keeps the last
  good numbers when a read catches a partial one.
- **The axis is scaled to the samples IN the window, not to everything drawn.**
  The line is drawn with one sample beyond each edge, so it meets the frame
  instead of starting in mid-air; scaling the axis to those edge samples hands
  the scale back to the sample just outside the window, so the spike you zoomed
  in to get away from keeps flattening the window. The tests pin both halves:
  `pointsToDraw` for the geometry, `pointsInRange` for the axis.
- **A window is clamped, and has a floor.** Zooming is clamped to the run and
  stops at `MIN_WINDOW_FRACTION` of it, because a window with one or two samples
  in it is a chart that says nothing — and a drag past an edge slides back
  inside instead of compressing the window.
- **A zoom control is a button, not a gesture.** Dragging is the fast path, but
  a range reachable only by dragging cannot be chosen by keyboard and cannot be
  read by a screen reader, so the chart takes focus (with `+`, `-`, `0` and the
  arrow keys) and every control carries a label.
- **The plugin owns its stylesheet by `data-plugin`.** The client loader claims
  every style tag that lacks that attribute for whichever plugin materialises
  next, and deletes every tag whose `data-plugin` equals an id when that entry is
  replaced or pruned — so a privately tagged sheet is deleted with another
  plugin, which strips `fill: none` from the SVG paths and they fill black.
- **A break marker says what KIND of break it is, or says that it does not know.**
  The kinds do different things to a curve — a corpus change explains a rise, an
  instrument change makes the joint a level shift, an arithmetic change makes the
  series incomparable across it — so a marker drawn as a bare line invites
  exactly the comparison it should prevent. The kind is a word on the line and a
  colour, an unknown kind keeps its own name, and a marker served without a kind
  is labelled `UNKNOWN` rather than coloured like something it may not be.
- **A marker's words are the snapshot's, never this plugin's.** The label, the
  reason, the sentence for the kind and the evidence are carried through
  verbatim; the tab chooses where a marker sits, how much of it fits on the
  chart and how it is stacked, and never what it says. A paraphrase here would
  be a second statement of one fact, free to disagree with the record.
- **A marker that is not drawn is still reported.** Markers past the end of the
  series or outside the window still read in the register, a marker with no
  readable leg is counted and reported rather than dropped, and the frontier
  says why its dashed line is not on the chart yet. A silent absence in a chart
  is read as "nothing happened here".
- **The frontier is drawn as an expectation.** It is a projection from the
  producer's own budget, in its own dashed style and its own lane, labelled
  `expected around leg N` — and when the producer says the transition is
  imminent the wording moves to `AT LEG N`, because there is nothing left to
  predict. The tab adds one caveat of its own: the leg is a direction and not a
  magnitude, and the producer may end a phase early.
- **`snapshot_version` stayed at 1 while the new keys arrived.** The contract
  version is a claim that a reader can read the body, and `breaks` and
  `frontier` are additive: an older reader serves them and simply draws less,
  while a bumped version would make every deployed reader refuse the snapshot
  outright. The host is a pass-through and a test pins that it does not reshape
  or drop a key it does not know.
- **An action goes in an action row, never in `shell.overlay`.** That seat is a
  frame-wide floating layer for badges, toasts and status pills, and it is
  click-through on purpose, so a BUTTON registered there is in the wrong place
  (the window's top-left, beside the application menus and the sidebar's reopen
  control) and unclickable unless it opts back into pointer events. The trigger
  belongs to `conversation.session.header.actions`, the title-adjacent row the
  shipped jobs, subagent, agent-preset and agent-team controls use, and it copies
  their metrics — borderless, transparent, at least 28px, tertiary label colour
  at rest and secondary on hover — so the row reads as one set of controls. The
  test asserts the trigger is in that row and that nothing of this plugin is
  registered in the overlay.

## Licence

MIT. It matches the sibling plugin `dsh-knowledge-dag`, whose licence this one
follows, and DeepSeek Harness itself, which is also MIT.
