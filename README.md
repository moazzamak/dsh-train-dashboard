# dsh-train-dashboard

A training dashboard for the DeepSeek Harness (DSH). It adds a **Training
dashboard** tab to the right pane, beside Files, Terminal and Document, and
charts a JSON snapshot of a training run: a KPI header, one series at a time on
its own axis, the joints that make the series incomparable marked on the chart
with the reason for each, and the model's own growth drawn against the reading it
buys.

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

Package version **0.4.0** — snapshot contract version **1**.

### What changed in 0.4.0

Two features were **removed** and one defect that had been hiding behind them was
fixed. The snapshot contract number stays at **1**: every change is additive or
ignored — a snapshot that carries a key this version no longer reads is still
served, and still drawn as far as it can be.

- **No more predictions.** The dashed *frontier* line, its register block, its
  switch and the `frontier` key are gone. A producer's phase length is not
  knowable in advance — a phase ends when its read goes flat, not at a fixed leg
  count — so the projection was wrong in its premise, not merely imprecise. A
  snapshot that still serves `frontier` is served and the key is ignored.
- **No more NO KIND marker.** The legacy single-break key `break_leg` — one
  constant naming a joint of an arc the snapshot no longer charts, carrying no
  kind — is no longer folded in, and `/state` no longer republishes it as
  `breakLeg`. A marker whose whole content is that it claims nothing, drawn on a
  run that never trained that leg, is not a joint a reader can use.
- **A growth now has a colour and a shape in the key.** The `growth` kind was
  added to the chart's shape and ink tables and to no rule in the stylesheet, so
  its register swatch fell back to the sheet's grey and its key drew no shape at
  all — a mark on the chart the register could not decode.
- **The KPI header reads the current bpb tags.** The producer renamed
  `train/bpb_sealed` and `train/bpb_legval` to `train/bpb` and
  `train/heldout_bpb` on 11 October 2026, and this tab's headline list was not
  moved with them: the headline resolved to nothing and the first two KPI tiles
  read `—` beside four that filled normally. Both spellings are recognised now,
  current first, so an old snapshot on disk still charts.

---

## What you get

| region | content |
| --- | --- |
| header | the run's name, the snapshot's age with a fresh/stale badge, a Refresh button |
| KPI row | latest step, the held-out reading, step wall time, throughput, memory peak, evaluation accuracy, the seed model's size |
| chips | the four metrics this tab leads with, then a `N more series` disclosure holding everything else the snapshot carries |
| chart | ONE series at a time on its own axis, with every break marker drawn on it, over a timeline you can select — plus the seed model's size as a second dashed line against the axis on the right, the chain a rollback threw away ghosted beside the live one on a shared origin, and a floating current value for each line |
| register | under the chart: a switch per break category, then one status line per marker — its kind's shape and colour, its word, its leg and what changed — with the reason, the meaning and the evidence behind a per-row `why` disclosure |
| footer | the snapshot path being read |

**One series at a time is deliberate.** Series carry different units — bits per
byte, seconds, GiB, accuracy, counts — and drawing them on one axis would invite
exactly the comparison the axis cannot support. There is exactly one exception,
and it is the next section.

**The seed model's size is that one exception**, drawn on the same frame against
an axis of its own on the right — the growth ladder is the point of a run that
adds capacity as it trains, so how big the model has become belongs on screen at
the same time as the reading it buys. See
[The seed model's size](#the-seed-models-size) for what the number is and — more
importantly — what it deliberately is not.

**The chips are a short list on purpose.** A snapshot of this run carries sixty
series, and a chip for every one of them is a wall of controls over a chart that
draws one curve. The tab leads with the four it is steered by — the leg's own
end-of-leg reading, throughput, VRAM peak and the exam — and the other
thirty-six are one click away behind the disclosure. Nothing is dropped: a
producer's own tag is still reachable, labelled by its own name.

**One curve, not two.** `train/bpb_sealed` and `train/bpb_legval` are the same
chart. Measured on this run's snapshot: the curve carries 688 readings over legs
1–689 and the leg-end reading 730 over 1–731, and on all 688 legs they share the
values are identical. The curve stops at the phase boundary, which is where the
corpus transfer happens, and the leg-end reading keeps going for another 42 legs.
Both are written by the producer, so the tab resolves the pair: where the leg-end
reading exists the truncated copy is not offered at all, and where a producer
writes only the curve the curve is the held-out reading. The KPI header names
which of the two it read.

**One series at a time is deliberate.** Series carry different units — bits per
byte, seconds, GiB, accuracy, counts — and drawing them on one axis would invite
exactly the comparison the axis cannot support. There is exactly one exception,
and it is the next section.

### The seed model's size

The growth ladder is the point of a run that adds capacity as it trains, so how
big the model has become belongs on screen **at the same time** as the reading it
buys. A chip would have made you choose between the two, which is the one
comparison you are trying to make. So it is drawn as a second, dashed line on the
same frame, against an axis on the RIGHT:

- the frame WIDENS by a gutter only when there is a second line, and the gutter
  is where the second axis' tick labels live — never on top of the curve;
- the two axes **share one set of horizontal gridlines**, and their spacing is
  the scale's: exponential when the second line is logarithmic, regular when it
  is not. Every line carries a value from **both** scales, so the grid is a set
  of reference lines a reader can read twice rather than two grids interleaved —
  see below;
- the second axis is **logarithmic**, and is scaled to the **whole size series**
  rather than to the window — see below;
- the legend under the chart names both series, both units and the side of the
  frame each one's scale sits on;
- each line's **current value floats in the left margin**, written at the height
  that line was drawn at and in that line's own colour — so a number and the
  curve it belongs to are read together, with no legend in between. It sits
  **left of the plot**, in a column of its own separated from the axis numbers by
  position, colour and a short rail down its inner edge, because a reading that
  shares the numbers' column is mistaken for a tick. It is the newest reading of
  the **whole run**, not of the window: a reader zoomed into leg 300 is still
  steering by the latest number, and a reading that vanished when they panned is
  one they cannot rely on. A reading is only written where its line is actually
  on screen, and the two are held at least 13 units apart and inside the frame —
  the size axis barely moves while a bpb curve swings, so the two newest readings
  often land at nearly one height;
- the line is **resampled onto the selected series' x values**, so both lines are
  drawn in one coordinate system. Where the size series has no reading, the line
  **stops** rather than carrying the last value forward: a line that continues
  past its last measurement claims the model was that size at legs nobody
  measured.

**One grid, two scales, and the spacing follows the scale kind.** The frame
previously drew a grid per axis, at two different spacings over one another, and
half of each line belonged to no label — a texture rather than a grid. There is
now one set of lines:

| second line | lines at | example from this run |
| --- | --- | --- |
| logarithmic | the log axis' marks — equal **ratios** apart, so larger steps in value the further up the frame | `1.9897 bpb` / `17.4M` · `2.3737` / `19.1M` · `2.7576 bpb` / `20.9M params` |
| linear | the primary axis' own ticks — equal **steps** | evenly spaced |

So the horizontal lines are at regular intervals on a linear scale and at
exponential ones on a log scale, and both axes quote every line. A line's value
on the primary axis is solved from that axis' own projection (by bisection, not
by a second formula that could disagree with the drawing), so a gridline's label
can never name a value the line is not on. Two labels that would round alike take
one more decimal until they do not.

**Each axis names its unit exactly once**, in the title rotated up its outer edge
(`bpb`, `params`). The tick labels beside it are bare numbers — `17.4M`, not
`17.4M params` — because a unit written on a label as well says the same word
twice within a few pixels of itself. The scale mark the value formatter writes
(`22.2M`) stays with the numbers, where a reader comparing two ticks needs it;
the rotated title carries the word those letters stand for; and the legend spells
both units out in full for anyone who wants them named.

**The size axis does not follow the window, and that is deliberate.** This line
exists to show growth, and the size only ever rises — so a floor taken from the
samples *in the window* rises as the reader pans right and **lifts the beginning
of the line off the bottom of the frame**. Zoomed into the late run, the early
readings fall below the axis and stop being drawn, while every count on screen
still says they were drawn: a series that appears to begin later than it does,
with nothing saying a reading was dropped. Anchored to the whole series instead,
the floor stays put under every window and the line's shape is comparable from
one window to the next. The x window still does all the framing work it did
before. The main axis keeps its window rescaling, because its readings are noisy
and uncorrelated — there the rescale is the point.

**Why log.** The size is the product of the growth ladder, and the ladder
multiplies: this run steps 17.05M → 22.22M, which is **1.30×**. A linear axis
anchored at zero draws that as 23% of the frame at most, and the ladder itself —
every growth this pass has bought — as under 2% of it, which is a flat line near
the top. On a log axis the same readings are 0.115 decades and the run uses
**92% of the height**, and each growth step is the same fraction of the height
however big the model already is.

A log axis also has **no zero**: log(0) is negative infinity, so a floor of 0 is
not a setting the axis can honour. Its floor instead sits **8% of the height below
the run's smallest reading**, which is where a linear axis' zero would be.

- the floor is solved from the data's own span, so it works on a narrow window
  exactly as on the whole run. Placing it at a fixed fraction of the *maximum*
  instead — the obvious first attempt — leaves a 1.30× run drawn in the top 19%
  of the frame, the same flattening the log axis was chosen to fix.
- a value outside the axis is **dropped**, never clamped: `train/seed_read_rows`
  really does start at 0 rows, and folding that to the bottom of the frame would
  draw a zero on a scale that cannot contain one. It is one switch away if you
  want to watch the read grow from nothing.
- the marks are evenly spaced powers of ten — `17M  19M  21M` on this run — and
  never two of them closer than 8% of the height, because two marks that close
  are one blur rather than a scale.
- the axis **carries no caption**: an earlier version printed a sentence
  explaining what a log scale is, and it was removed as clutter. The marks are
  what say it, and the legend still names both lines, both units and both sides.

The series it looks for, best source first:

| tag | drawn as | unit |
| --- | --- | --- |
| `train/seed_model_params` | the headline: the whole model | M params |
| `train/seed_read_rows` | the part a growth deposit moves | rows |
| `train/seed_trainable_rows` | the fixed table beside it | rows |

A producer that serves none of them gets no second line and no second axis —
never an empty axis, which would be furniture. The same three tags are kept out
of the chip list: a chip that selected a series already drawn underneath the
curve would be a second way to ask for one picture.

**What this number is, and what it is not.** It is a count of PARAMETERS of the
whole model — the tick table plus the read's live rows — and two cheaper
measurements are wrong on a run of this kind:

- **the checkpoint's byte count**, because the read is a fixed allocation
  rectangle: every leg writes the **same** file size (measured: 375,398,237 bytes
  on legs 800 to 893) while the model inside it grows. A byte-count line would be
  perfectly flat over a model that is getting bigger.
- **the read's allocation**, because an allocated-but-not-live row is held at
  exactly zero and given no update, so it "contributes nothing to the read". On
  leg 66 of the live pass the read was allocated 4,096 rows and **385** of them
  were live: pricing the allocation put 3.15M where the truth was 0.30M, an
  overstatement of ten times, and mixing the two made the size series dip from
  20.1M to 17.1M and rise again — a shape no growing model makes.

So the size is counted from the two tables that do move, each at its own price:

1. the **tick table**: `born-rows gate ON: N trainable rows`, where one row is an
   embedding row of `d` numbers **and** an unembedding row of `2d + 1`, so one row
   is `3d + 1 = 577` parameters and not one. Pricing a row at a single parameter
   is what made this chart say 4.0M about a 22.2M model.
2. the read's **live rows**, at the trainer's own `READ_PARAMS_PER_ROW` — a key
   row and a value row of `2d + 1` numbers each.

Both prices come from the trainer's registered constants rather than from
arithmetic restated here. A second derivation would be free to disagree with the
trainer about how wide the model is, and then the chart and the log would tell
different stories about the size of one model. Cross-checked against the live
checkpoint at leg 893: `E` (29035, 192) = 5,574,720, `U` (29035, 385) = 11,178,475,
read 7,096 × 770 = 5,463,920, total **22,217,115** — which is what the chart says.

**The live count is only ever read from a line that states it.** Two lines do:
the gate's `read live-row gate ON: N of M allocated rows are live`, and the
packed read's `groups G x N LIVE rows of M allocated`. A leg whose log carries
neither — legs 1 to 65, 67 to 124 and 129 to 278 of the live pass, which were
trained before the trainer printed a live count every leg — gets **no reading at
all**. That becomes a gap, and it is deliberate: the live set only ever grows
(rows are appended, never removed), so a dip in the series is always a misread,
and the honest drawing of "this leg did not say" is nothing rather than an
interpolation between its neighbours.

**Sizing a series the snapshot never reported.** A leg whose log says nothing
about the size is not charted at all: the series has no point there, and if NO
leg reports a size there is no size series. Where the first readable leg is not
the run's first, one explicit point is emitted for the leg before it at the same
size, labelled as back-projected in the series' source note, so a growth reads as
a **step at the leg that took it** rather than as the line's own start.

The size series is **not** split at the break — unlike every metric series — and
that is deliberate. The break is a change in the arithmetic a leg computes, which
is why bits per byte is not comparable across it. A parameter count is a
statement about the model's shape: it means the same thing on both sides, and
splitting it would draw two half-lines for one continuous quantity.

### Turning marker categories off

A long run crosses many joints, and on a chart zoomed to fifty legs the cluster
of markers can be exactly what is in the way. So **the key under the chart is
also the switch**: each category is a button carrying its own shape, its word and
its marker count.

- pressing a category stops it being drawn **on the chart, on the strip under the
  chart, and in the register** — one list, three readers, so the three views of a
  marker cannot disagree about whether it is drawn;
- the key swatch is drawn from the same shape table the chart draws with, so the
  shape in the key IS the shape on the line;
- a switched-off category **keeps its shape and its colour**, dimmed with its
  word struck through. A kind read as "off" by hue alone would be invisible to a
  reader who cannot separate the hues — which is the whole reason every kind has
  a shape.

**Nothing is hidden silently.** The register always states both counts — how many
markers are drawn out of how many the snapshot carries — and adds a sentence
naming how many your switches are holding back. The chart's accessible name
carries the same numbers. That distinction is the point: a chart missing its
joints looks exactly like a run with no joints, and the two call for opposite
readings of the same curve.

A category the tab has never seen is **offered as a switch under its own name**
and is **drawn by default**: the switches store the kinds turned *off*, so a
producer's new kind, or a marker served with no kind, can never be hidden by a
preference expressed before it existed. The switches are remembered **per
session** and survive the pane remounting the tab body, for the same reason the
series choice does: a switch that resets itself on the next poll undoes your work
while looking exactly like a refresh.

### Breaks and kinds

A long run crosses boundaries that are not learning, and a rise across one of
them is not the model getting worse. The snapshot can carry them, and the tab
draws each one as a vertical line carrying **a shape and its leg number**: the
shape says which kind of joint it is, the number says which register row below
reads it out, and the words stay in the register where there is room for them
and where the reason, the meaning and the reading already live. Kinds are shapes
**and** colours, because a kind encoded by hue alone is invisible to a reader
who cannot separate the hues, and these kinds do different things to the curve:

| kind | shape | what it means on the chart |
| --- | --- | --- |
| `corpus` | circle | the data changed, so a rise here is expected and is not a regression |
| `instrument` | square | the reading changed, so the joint is a level shift measured on different terms: no slope across it |
| `arithmetic` | triangle | the numbers changed, so the series is not comparable across the joint at all |
| `shape` | diamond | the leg's geometry changed with its volume held constant, so the metric stays comparable and the wall clock moves |
| `restart` | triangle, point down | the process restarted, and the work of that window is not in the series |
| `rollback` | chevron, pointing left | the weights were rewound to an earlier state, so the leg numbers either side of the joint do not order the training and the reading jumps for a reason that is not the model |
| `growth` | chevron, pointing up | the MODEL grew: rows were added to the read, so the size steps at this leg, the reading can rise while the new rows learn, and the leg costs more wall clock. Marked on **every** chart, so an event the selected series does not move is still visible on it. The one kind that is not a warning |
| anything else | plus | a kind this tab has never seen, drawn rather than hidden |

**A `rollback` is the one kind the chart draws twice, and the one kind that re-bases
the x axis.** Everything at or before the newest rollback's leg is the chain the
controller threw away: it stays on the chart - dropping those points would make the
run look shorter than it is - and it is drawn as a **ghost**: same hue, dashed, half
opacity. **Both passes are drawn from their own first leg**, so the live pass starts
at x=0 beside the older one instead of being stranded at the far right of an axis
that starts at the run's first leg: the reader compares pass 2's third leg with pass
1's third leg, which is the whole reason the older values are kept on the picture.
The window readout says so - `legs from each pass's start 0–208` - because numbers
that no longer match the legs in the register must not be left to be inferred. A run
that has not rolled back keeps the leg number as its x, and its readout still says
`steps`.

The key carries a third switch for the ghost, `OLDER RUN ≤N`, which takes the ghost
off the picture and puts it back; **neither axis moves either way** - the horizontal
one is bounded by both passes and the vertical by both passes' values - so switching
the ghost off is a change of what is drawn and never of what the numbers mean. The
ghost is read from the rollback MARKERS and not from the visible ones, so switching
the `ROLLBACK` category off hides the marker and leaves the discarded values ghosted
where they were.

**A rollback draws no line of its own**, because with both passes aligned to a shared
origin there is no leg for such a line to sit at: it would land at the far end of the
older chain and mark nothing. What shows it on the chart is the origin itself - two
chains from one x, the older one ghosted - and the `ROLLBACK` row in the register
carries the record: the rule, the checkpoint it went back to, and the producer's own
reason. Its category switch therefore hides the RECORD, and says so rather than
promising to take a line off a chart it is not drawn on.

A kind the tab has never seen is still drawn, with the plus shape and the
producer's own name in the register; a marker whose kind the snapshot omits gets
the `UNKNOWN` row rather than being shown as if the kind were known. Markers
whose labels would collide are stacked so that no two write over each other, and
every marker also gets a dim tick on the strip under the chart, so the joints are
visible even when you have zoomed somewhere else. Hovering a marker gives the
same text the register carries, so the detail is one gesture away without being
written across the plot.

The **register** under the chart is a STATUS LIST, one line per joint: the shape
and colour of its kind, the kind's word, the leg, and what changed there — with
the reasoning behind a `why this joint is marked` disclosure on the row itself.
The reason, the sentence your snapshot carries for that kind, the evidence the
marker was read from and any contradiction it attaches are all still there, one
press away: a register that arrives as four paragraphs per joint is not a status
list and gets read as a wall — reported on 10 October 2026 and fixed by the
disclosure. Markers that fall outside the window on screen, or past the last
point of the series, still appear there — the chart can only draw what its axis
covers, and a marker that is missing from the picture without a word about it is
a marker nobody finds.

**Every marker comes from your snapshot, in your words.** The tab does not decide
that a rise is expected, that a joint is a level shift or that a corpus is about
to change; it draws what your producer derived and repeats its sentences, so the
chart and your own record cannot tell different stories about one run. **And it
predicts nothing**: this tab used to draw a projection of the next corpus
change, and it was removed on 13 October 2026 ("next corpus change prediction
should be removed. it's unnecessary and wrong as well") — the leg it named came
from a phase's budget divided by one leg's volume, while a visit actually ends
when its read goes flat. A snapshot that still serves a `frontier` block is
simply not asked for it.

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
| `breaks` | optional | An array of markers, each derived from your own artifacts. See below. |
| `series` | yes (may be empty) | The array of series to chart. |
| `series[].tag` | yes | The series name. A slash groups it: `train/loss`, `memory/vram_peak_gib`. |
| `series[].points` | yes | Array of `[x, y]` pairs of finite numbers. `x` is the step axis. A pair that is not two finite numbers is dropped; a series left with nothing is not offered at all. |
| `series[].source` | optional | Short string naming where the numbers came from; shown in the chip tooltip and the legend. |
| `annotations` | optional | Free-form array, forwarded to the browser untouched. |
| `counts` | optional | Free-form object, e.g. `{"points": 4123}`; echoed by `/state`. This project's producer puts its seed-size summary here: `{"seed": {"params_per_read_row": 770, "first_params": …, "last_params": …, "last_read_live_rows": …, "last_trainable_rows": …, "legs_counted": …}}`. |
| `sources` | optional | String naming the producer's inputs; echoed by `/state` as `snapshotSources`. |

### `breaks[]`: the markers

| field | required | what it does |
| --- | --- | --- |
| `leg` | **yes** | The x value the marker sits at. A marker without a readable `leg` cannot be placed on an axis: it is counted and reported under the chart rather than dropped in silence. |
| `kind` | strongly recommended | One of `corpus`, `instrument`, `arithmetic`, `shape`, `restart`, `rollback` — or any other word, which is drawn and named as it is. Omitted, the marker is labelled `UNKNOWN`. |
| `label` | recommended | A few words naming the change (`corpus_a to corpus_b`, `512 to 256 steps a leg`). Drawn on the chart, cut on a word boundary if it does not fit. |
| `reason` | recommended | The sentence that says what happened and whether a move across it is expected. Shown on the row behind its `why` disclosure. |
| `meaning` | recommended | What this kind of change does to the curve. Shown behind the row's `why` disclosure under `WHAT THIS <KIND> CHANGE DOES TO THE CURVE:`. |
| `support` | optional | Where the marker was read from, in a sentence a reader can check. Shown as `READ FROM:`. |
| `derived` | optional | `false` marks a leg that is a constant in your code rather than a reading; the register then says so. Absent means nothing is claimed either way. |
| `contradiction` | optional | Set when your own evidence contradicts the change the marker names. Shown prominently, because hiding it would leave the chart claiming a change the legs do not show. |

Markers are drawn oldest first. Several markers on one leg are fine: their
labels are stacked so they cannot overlap.

**A marker states a kind, and the tab never invents one.** Every row in the
register is a joint your producer derived from an artifact, so there is no
"joint with no kind" state to render. This replaced an older contract: a
snapshot could carry a bare `break_leg`, which the tab drew as a dashed marker
with a `NO KIND` badge because a leg number alone cannot say whether the data,
the reading, the arithmetic, the leg's shape or the process changed. That is
gone — a `break_leg` key in a snapshot is now ignored — and a joint worth
marking is worth a `breaks[]` entry saying which kind it is.

**And nothing here predicts.** An earlier version of this plugin drew a
`frontier`: the transition expected next, the leg it was expected at and whether
a rise was expected there, from the producer's own budget. It was removed on
13 October 2026 at the user's instruction — "next corpus change prediction
should be removed. it's unnecessary and wrong as well" — because the projection
divided a phase's budget by one leg's volume while a visit actually ends when its
read goes FLAT. A `frontier` key in a snapshot is now ignored, and what a reader
still needs — that a corpus change raises the reading and is not a regression —
is said at each change that happened, by the marker's own `reason` and `meaning`.

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
| `sealed/bpb` | sealed bpb | bpb |
| `sealed/ppl` | sealed ppl | ppl |
| `sealed/ppl_log` | sealed ppl (log10) | log10 ppl |

**A series taken on a cadence is drawn as its READINGS, not as a curve.** Some
instruments do not run every step: a sealed evaluation of the saved checkpoint
may cost more than a training step does, so a producer takes it every N legs and
charts one point per reading. The tab measures that from the series itself — the
share of the steps between its first and last reading that it actually carries —
and where that share is below half, it draws the line DASHED with a CIRCLE on
every reading. The segments between two circles are interpolation, and a reader
who takes them for measurements reads the instrument as smoother and slower than
it is. A per-leg family that stops early is unaffected: its readings are still
consecutive, so it stays a line, and so does a short series that a producer has
only just begun writing.

**A chip is a name, never a sentence.** The tab used to append an explanation to
the label of three tag families — that the sealed read runs on a cadence rather
than every leg, and that the leg-validation families run every leg — which put a
paragraph inside a display name and baked in a cadence the producer's own
`counts` can change. The cadence is data and belongs in `counts` (and in the
chip's hover title, which shows the series' `source` verbatim); the sparseness
is drawn. Every other chip is its tag or its label above, and nothing more.

Two more tags are drawn **as the second line** rather than offered as chips, and
one more sits beside them; see [The seed model's size](#the-seed-models-size):

| tag | drawn as | unit |
| --- | --- | --- |
| `train/seed_model_params` | seed model size, on the right-hand axis | M params |
| `train/seed_read_rows` | the read's live rows (the fallback when no total is served) | rows |
| `train/seed_trainable_rows` | the tick/born table | rows |

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

**After that first install, editing this directory is not enough.** `pnpm` may
materialise a `file:` dependency as a plain COPY rather than a link — on Windows
it does, and there is no reparse point to check — so the profile keeps serving
the copy it installed while the file you are editing sits one directory away.
The symptom is a plugin that silently does not change: no error, no failed boot,
just the old code, which is the most expensive kind of wrong because everything
looks like it worked. Copy the halves across after every edit, and check by
size:

```powershell
$src = '<this directory>'
$dst = "$env:USERPROFILE\.dsh\profiles\<profile>\node_modules\dsh-train-dashboard"
Copy-Item "$src\client.cjs","$src\index.mjs" $dst -Force
Get-FileHash "$src\client.cjs","$dst\client.cjs"   # the two hashes must match
```

A client-half change also needs a **page reload**: the browser holds the bundle
it loaded. The host half (`index.mjs`, the routes) is read at boot.

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
| `test/client.test.mjs` | 98 tests — the slot wiring, the pure helpers, the freshness rules, the break markers, the seed-size overlay, its log axis and the shared grid, and the category switches |
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
  series or outside the window still read in the register, and a marker with no
  readable leg is counted and reported rather than dropped. A silent absence in a
  chart is read as "nothing happened here".
- **Nothing on the chart is a prediction.** A frontier — the next transition,
  its leg and its expected rise — was drawn here until 13 October 2026 and is
  removed: the leg came from a phase's budget divided by one leg's volume, while
  a visit ends when its read goes flat, so the projection was wrong in its own
  premise as well as unnecessary ("next corpus change prediction should be
  removed. it's unnecessary and wrong as well"). What a reader needs about a
  corpus change is said at each change that happened, by the marker's own reason
  and meaning.
- **`snapshot_version` stayed at 1 while the new keys arrived.** The contract
  version is a claim that a reader can read the body, and `breaks` is additive:
  an older reader serves it and simply draws less, while a bumped version would
  make every deployed reader refuse the snapshot outright. The host is a
  pass-through and a test pins that it does not reshape or drop a key it does
  not know.
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
- **The selected series belongs to the reader, not to the payload.** The
  snapshot is rebuilt from logs on disk on every refresh, so a series can drop
  out of one revision and come back in the next: the live snapshot rotates its
  per-leg traces, and one refresh replaced `guard_trace/…_leg_00722_…` with
  `…_leg_00725_…`. The panel resolved the selection with
  `offered.find(tag) ?? offered[0]`, so a series missing from a revision silently
  moved the reader onto the default curve, which looks exactly like a redraw and
  is actually the panel discarding a choice. `resolveSelection` reports the choice
  as MISSING instead, its chip stays marked with a dashed edge and its own words,
  and nothing else is drawn in its place. Those trace tags are filtered out of the
  chips too, by the same shape rule that already excluded `vram_trace/`.
- **The choice and the window outlive the component.** The pane unmounts and
  mounts a tab body again on events the reader did not cause, and React state does
  not survive that, so both are remembered outside the component: the series per
  session, the zoomed window per series tag. `Reset` forgets the window, which is
  what keeps "reset" and "never zoomed" one state.
- **Every control is pressed by a check, not merely rendered by one.** The zoom
  buttons were wired the wrong way round, `+` widening the window and `-`
  narrowing it, through a passing unit suite: the tests asserted that the labelled
  controls existed rather than what they did. The end-to-end check clicks each
  control and reads the window back, which is how the inversion was found.
- **The chart carries identifiers; the register carries the words.** A marker was
  drawn with its leg, its KIND and the first words of its reason, which repeated
  what the register row below already said in full and cost the reader the curve:
  six joints inside fifty legs stacked into six lanes of prose across the plot.
  The plot now carries a shape and the leg number, and the register carries the
  prose. The shape is not decoration: a kind encoded by hue alone is invisible to
  a reader who cannot separate the hues, and these kinds do different things to
  the curve, so an unreadable kind invites the comparison the register exists to
  prevent. The register draws the same shape in its key, and a test reads the
  stylesheet and compares it against the shape table, because one mapping written
  twice is free to disagree with itself.
- **The register is a status list, and it was read as a wall of text.** A row is a
  line: the shape and colour of its kind, the kind's word, the leg, and what
  changed there — with the reasoning behind a per-row `why this joint is marked`
  disclosure. The register arrived as four paragraphs per joint and was reported
  on 10 October 2026 as "too verbose, it's unreadable ... walls of text".
- **A default list is a claim about what matters, and it goes stale.** The chips
  offered nine metrics in a fixed order chosen when the tab was written, and the
  snapshot had since grown to sixty series: the row became a wall of controls and
  the one at the front was a truncated duplicate of the one behind it. The list is
  now four, it is one constant with the reason for each entry beside it, and
  everything else is behind a disclosure rather than gone. A default nobody
  revisits is a default that decides for the reader.
- **When two series are one chart, the tab resolves them.** `train/bpb_sealed` and
  `train/bpb_legval` are identical on all 688 legs they share; the first stops at
  the phase boundary and the second continues 42 legs past it. So one entry names
  the other as its `fallbackFor`: where both exist the truncated one is not
  offered at all, and where only the curve exists it is the reading. A reader
  should never be handed two chips for one picture and left to work out which is
  which.
- **A size charted by the file's byte count would be flat over a growing model.**
  The read is a fixed allocation rectangle, so every leg writes the same 375 MB
  while the model inside it grows. The seed's size is counted in PARAMETERS from
  the tables that actually move, at the trainer's own prices. A chart whose one
  job is to show growth must not be drawn from a number that cannot grow.
- **A ROW COUNT IS NOT A PARAMETER COUNT.** The leg log reports the tick table as
  `29035 trainable rows`, and pricing a row at one parameter made this chart say
  4.0M about a 22.2M model. One tick row is `3d + 1 = 577` parameters, because it
  is an embedding row plus an unembedding row. The two prices come from the
  trainer's own constants, and the chart is cross-checked term by term against the
  checkpoint: 5,574,720 + 11,178,475 + 5,463,920 = 22,217,115.
- **AN ALLOCATION IS NOT A LIVE SET.** `theme_live_mask` holds an
  allocated-but-not-live row at exactly zero and gives it no update, so it
  contributes nothing. On leg 66 the read was allocated 4,096 rows and 385 were
  live — a tenfold overstatement — and treating the allocation as the live set
  made the size series dip from 20.1M to 17.1M and rise again. The live count is
  read only from a line that STATES it (the gate's or the packed read's), and a
  leg carrying neither gets no reading.
- **A SERIES THAT CAN ONLY GROW IS CHECKED FOR GROWTH.** The read's live rows are
  appended and never removed, so a decrease in the size series is always a
  misread rather than a fact about the model — and a reader cannot tell those
  apart from the picture. The tests assert the whole series is non-decreasing and
  that no point is small enough to be a partial read, which is what caught the
  dip at leg 66.
- **Two lines on one frame are readable only if the frame says the scales
  differ.** The seed-size line gets its own axis on the RIGHT, a gutter the frame
  widens into only when that line exists, its own rescaling inside the selected
  window, and a legend naming both series, both units and both sides. Without
  those, an overlay is an invitation to compare two numbers whose units have
  nothing to do with each other.
- **A unit that does not fit beside a number goes up the side, and is written
  once.** `22.00 M params` flat beside the top tick is wider than any gutter worth
  taking out of the plot — it ran out of the window — so each axis carries its
  unit ROTATED up its outer edge, where the chart's height pays for it. And
  because `formatValue` already writes 22 million as `22.0M`, the marks keep the
  `M` and the rotated title carries the word it stands for: one fact, one place.
- **A unit is written once per axis, and never on a tick label.** A version put
  `params` on the topmost tick as well as on the rotated title, so the frame said
  the same word twice a few pixels apart. The title at the outer edge carries the
  word, the labels are bare numbers, and the legend names both units in full. A
  unit that LEADS with the scale mark must not write it again either — `17.4M M
  params` is what happens when the scale mark and the unit are both written from
  scratch.
- **A ladder that multiplies wants a log axis, and a log axis has no zero.** The
  size steps 17.05M → 22.22M, which is 1.30×; anchored at zero that is 23% of the
  frame with the ladder itself under 2% of it, so the growth is in the numbers and
  absent from the picture. On a log axis the run uses 92% of the height and a
  ratio is a constant distance wherever it happens. The floor then cannot be 0 —
  log(0) is negative infinity — so it is solved from the data's own span to sit
  8% of the height under the smallest reading. Putting it at a fraction of the
  MAXIMUM instead was this feature's own first bug, and it left the run drawn in
  the top 19% of the frame: the flattening the log axis was chosen to fix.
- **A log axis drops what it cannot hold; it never clamps.** `train/seed_read_rows`
  starts at 0 rows, and folding that to the bottom of the frame would draw a zero
  on a scale that cannot contain one. Below the floor is a gap, and the series
  that genuinely starts at zero is one switch away. The guard has to test the
  VALUE against the floor and not merely that the floor is positive: the first
  version checked only the latter, so a reading under the floor came back as a
  NEGATIVE fraction — an ordinary number to the projection — and was drawn below
  the bottom of the plot instead of being dropped. The chart reported every
  reading as drawn while some were off the canvas, which is precisely the silent
  absence this plugin's rules forbid.
- **A growth line's axis is anchored to the series, not to the window.** The size
  only rises, so a floor taken from the samples in the window rises as the reader
  pans right and lifts the beginning of the line off the bottom of the frame.
  Anchored to the whole series, the floor holds still and the early readings stay
  on screen. The main axis keeps its window rescaling: its readings are noisy and
  uncorrelated, so there the rescale is the point.
- **ONE grid, and its spacing is the scale's.** Two grids over one frame put lines
  at two spacings over one another, and half of each belonged to no label — a
  texture, not a grid. There is now one set, at the log axis' marks when there is
  a log axis and at the primary axis' regular ones otherwise, and both axes label
  every line. On a log axis a constant DISTANCE is a constant RATIO, so the
  interval comes out exponential for free — equal heights, growing steps in
  value — which is exactly the spacing a log scale means.
- **A shared line's value is solved from the projection that draws it.** The
  primary axis' reading at a shared line is found by bisection on its own
  projection rather than by a second formula written out beside it; a second
  formula is free to disagree, and then a gridline's label names a value the line
  is not on. Labels that would round alike take one more decimal until they do
  not, because two lines carrying the same number is a scale that cannot be read.
- **The current value floats in the left margin, and carries its own colour.**
  Each line's newest reading is written at the height that line was drawn at, in
  that line's own colour, with a short rail down its inner edge — so a number
  needs no legend to be attached to a curve. It sits **left of the plot**, in a
  column of its own: on the right it shared the overlay's tick labels' column and
  a reader could not tell a reading from an axis value, and left-of-plot is also
  where nothing else competes for the space. The reading is the run's newest and
  not the window's, since a reader zoomed into leg 300 still steers by the latest
  number; it is dropped when its line is off screen, because a floating number
  whose line is not drawn is attached to nothing; and the two are held apart and
  inside the frame, because the size axis barely moves while a bpb curve swings.
- **A colour that exists only in the stylesheet is a colour that can go black.**
  The readings first shipped with their `fill` set by CSS class alone, and over a
  dark frame they rendered **black** — an SVG `text` with no fill is black, and a
  sheet that is not applied is a sheet whose fills do not exist. Each element now
  carries the same colour as a presentation attribute, where nothing can take it
  away, while the stylesheet keeps the theme token so a theme still wins. A test
  asserts the two agree, because one palette written twice is free to disagree
  with itself.
- **A custom property that is read and never set is the same defect in a
  different coat.** The kind colours are one custom property, `--dshtd-kind`, set
  once per kind by the sheet and read back by the chart's marks, the register's
  swatches and badges, and the key's switches. The switches were the case that
  proved it: the per-kind selector list named every other reader and no switch,
  so `fill: var(--dshtd-kind)` was invalid at computed-value time, every switch
  drew **black**, and the key could no longer answer "which colour is which
  kind" — reported on 10 October 2026. The kinds now carry their colour on the
  element as well, from `KIND_INK`, for the reason above; the sheet gained the
  switch in its selector list and an explicit rule for the two kinds it left to a
  catch-all; and a test reads the JavaScript table against the sheet's own values,
  so the two palettes cannot drift.
- **The floating value and the axis marks share one formatter.** The value
  formatter scales as it writes: 22,217,000 becomes `22.2M`. Multiplying by the
  spec's `scale` first and formatting after gives the bare `22.22` — a number
  whose reader has to guess the units, three units away from an axis mark that
  says `22.2M` about the same series. One call, one notation.
- **Marks are evenly spaced powers of ten, and never closer than 8% of the
  height.** The obvious rule — one, two and five per decade — fails on this run's
  own range: it picks 20M and 22M, which sit 4.5% of the height apart for a 10%
  difference in value, and two marks that close read as one blur. The steps are
  walked from fine to coarse on a NESTED grid (1, 2 and 5 tens of each other), so
  "the most marks that fit" is well defined, and the extreme values are marked
  rather than thinned away.
- **A line stops where its measurements stop.** The size series is resampled onto
  the selected series' x values, and where it has no reading the path BREAKS
  rather than carrying the last value forward. A line drawn past its last
  measurement claims the model was that size at legs nobody measured. A leg that
  reports no size gets no point, and if no leg reports one there is no series —
  never a flat zero, which would draw a model that shrank to nothing.
- **A switch is a control, and the count is what makes it honest.** Hiding a
  category removes it from the chart, the strip and the register at once, from one
  list with three readers — and every one of those views still carries how many
  markers are drawn out of how many exist, plus a sentence naming how many the
  switches hold back. A chart missing its joints looks exactly like a run with no
  joints, and the two call for opposite readings of the same curve.
- **A preference must not be able to hide something that did not exist when it
  was expressed.** The switches store the kinds turned OFF, so a producer's new
  kind — or a marker served with no kind — is drawn by default and offered as a
  switch under its own name. A switched-off category also keeps its SHAPE and its
  colour, because a kind read as "off" by hue alone is invisible to a reader who
  cannot separate the hues.
- **Every control is pressed by a check, not merely rendered by one.** The zoom
  buttons were once wired the wrong way round through a passing unit suite,
  because the tests asserted the labelled controls existed rather than what they
  did. The category switches are therefore pressed in the tests: a hook-ordered
  renderer drives the chart, the switch is clicked, and the markers are counted
  before and after. A test that only renders a control cannot tell a working one
  from a dead one.

## Licence

MIT. It matches the sibling plugin `dsh-knowledge-dag`, whose licence this one
follows, and DeepSeek Harness itself, which is also MIT.
