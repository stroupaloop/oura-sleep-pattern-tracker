---
name: Slothie's Bipolar Tracker
description: Her nights, drawn against her usual.
colors:
  night-ink: "oklch(0.16 0.014 268)"
  lamplit-slate: "oklch(0.2 0.016 268)"
  dusk-slate: "oklch(0.225 0.018 268)"
  shadow-slate: "oklch(0.25 0.018 268)"
  moonlight: "oklch(0.96 0.006 268)"
  mist: "oklch(0.74 0.022 268)"
  haze: "oklch(0.62 0.02 268)"
  hairline: "oklch(0.85 0.03 268 / 11%)"
  corridor: "oklch(0.85 0.03 268 / 14%)"
  slothie-rose: "oklch(0.76 0.12 5)"
  rose-ink: "oklch(0.2 0.03 5)"
  lamp-amber: "oklch(0.83 0.12 78)"
  ember: "oklch(0.72 0.16 25)"
  dawn-blue: "oklch(0.8 0.08 245)"
  sage: "oklch(0.8 0.09 165)"
  stage-deep: "oklch(0.55 0.15 268)"
  stage-light: "oklch(0.8 0.07 230)"
  stage-rem: "oklch(0.72 0.12 305)"
  stage-awake: "oklch(0.88 0.04 80)"
  series-hrv: "oklch(0.78 0.1 175)"
  series-hr: "oklch(0.72 0.14 30)"
  level-0: "oklch(0.5 0.03 268)"
  level-1: "oklch(0.57 0.03 268)"
  level-2: "oklch(0.64 0.025 268)"
  level-3: "oklch(0.71 0.02 268)"
  level-4: "oklch(0.78 0.02 268)"
  level-5: "oklch(0.85 0.015 268)"
  level-6: "oklch(0.92 0.01 268)"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  panel:
    backgroundColor: "{colors.lamplit-slate}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.xl}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.slothie-rose}"
    textColor: "{colors.rose-ink}"
    rounded: "{rounded.md}"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.night-ink}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.md}"
    height: "36px"
  pill-unusual:
    textColor: "{colors.lamp-amber}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  gauge-corridor:
    backgroundColor: "{colors.corridor}"
    rounded: "{rounded.pill}"
    height: "8px"
---

# Design System: Slothie's Bipolar Tracker

## Overview

**Creative North Star: "The Usual Corridor"**

Every measure is drawn against her own usual range, and anything outside that corridor is the news. The interface exists so a drift in sleep or rhythm is seen the morning it happens, so it puts last night and its departure from usual first and lets everything else wait its turn.

It is a dark, quiet working surface for a first look of the day on a phone: tinted night-ink neutrals, one warm rose accent for the brand and actions, and color spent only on meaning (sleep stages, data series, and the one attention color for a night that crossed the pattern checks' threshold). Type is Atkinson Hyperlegible Next, drawn for legibility, with tabular numerals wherever numbers line up. Depth comes from tonal layering, not shadows. Motion is limited to state: a sync in progress, a disclosure opening.

The signature move is the **night window**: last night drawn on the clock, stage by stage, under a band showing the window she usually sleeps in. A late, short or broken night reads before any number does. The same corridor returns in every comparison row as a gauge: the band is her usual range, the ticks are where a night becomes unusual, the dot is last night.

**Key Characteristics:**
- Last night first, compared with her usual in plain words.
- Her usual range, drawn the same way everywhere.
- Color means something or it is not used.
- Gaps and outages are stated in words, with the fix.
- Calm by default; attention color only past the detector's threshold.

## Colors

Restrained night-indigo neutrals carry the surfaces; a single rose accent carries the brand; every other hue has exactly one job.

### Primary
- **Slothie Rose** (oklch(0.76 0.12 5)): primary buttons, selected chips and tabs, focus rings, links in research notes. The same rose as the thoughts heatmap and the alert emails.

### Neutral
- **Night Ink** (oklch(0.16 0.014 268)): the page.
- **Lamplit Slate** (oklch(0.2 0.016 268)): panels and cards.
- **Dusk Slate** (oklch(0.225 0.018 268)): popovers and tooltips.
- **Shadow Slate** (oklch(0.25 0.018 268)): tracks, meters, the night bar's gaps.
- **Moonlight** (oklch(0.96 0.006 268)): primary text and the gauge dot.
- **Mist** (oklch(0.74 0.022 268)): secondary text, axis labels. 7.9:1 on panels.
- **Haze** (oklch(0.62 0.02 268)): tertiary text on panels only (5.0:1); never on Shadow Slate.
- **Hairline** (oklch(0.85 0.03 268 / 11%)): borders and dividers.
- **Corridor** (oklch(0.85 0.03 268 / 14%)): the usual-range band.

### State
- **Lamp Amber** (oklch(0.83 0.12 78)): a measure past the pattern checks' daily threshold, and warning-tier patterns.
- **Ember** (oklch(0.72 0.16 25)): alert-tier patterns, scores under 60, destructive actions and form errors (`--destructive` is the same red).
- **Dawn Blue** (oklch(0.8 0.08 245)): watch-tier patterns and informational notices (a night not here yet).
- **Sage** (oklch(0.8 0.09 165)): no flags (as a check mark); Oura scores of 70 and up. Oura's Fair scores (60–69) take no hue, since Lamp Amber already means a night past the threshold.

### Data
- **Sleep stages:** Deep (oklch(0.55 0.15 268)), Light (oklch(0.8 0.07 230)), REM (oklch(0.72 0.12 305)), Awake (oklch(0.88 0.04 80)). Awake is pale on purpose, so it never reads as Lamp Amber.
- **Series:** HRV (oklch(0.78 0.1 175)), heart rate (oklch(0.72 0.14 30)). Baselines draw in Mist, dashed. Any other single series draws in Moonlight; further series in Mist dashed, then Haze dotted. No other hues.
- **Ordinal ramp** (`--level-0` … `--level-6`, oklch 0.50 → 0.92 at hue 268): ordered scales such as mood (-3 → +3) and activity class (rest → high). Lightness carries the order, so it reads under every color vision and judges nothing: higher mood is brighter, not "better". Never set text on a level swatch; pair it with the number or words. `level-0` is 3:1 on panels and too faint on Shadow Slate.
- **Episode markers:** shapes, not hues: depressive ▼ (level-0), hypomanic ▲ (level-5), manic ▲ (level-6), mixed ◆ outlined; always beside their words.

### Named Rules
**The Corridor Rule.** A measure that can drift is shown against her usual range. Color appears only when it leaves that range by the detector's own threshold, and the row says so in words ("Unusual").

**The One Meaning Rule.** A hue has one job. Lamp Amber is never decoration, Rose is never a warning, and stage colors never mark state.

**The Direction Rule.** Higher or lower activation is said in words with an arrow (`PatternDirectionLabel`), never in a color: the tier beside it already owns the color.

**The Threshold Rule.** A value turns Lamp Amber at the detector's configured daily threshold (`dailyAnomalyThreshold`, 1.5 by default), never at a hard-coded 2, so the charts and the alerts agree.

**The Her-Baseline Rule.** Values are judged against her own usual range, never population norms ("General range 7–9h") or a third party's window, and an unlogged dose is not a missed one.

## Typography

**Display and body:** Atkinson Hyperlegible Next (ui-sans-serif, system-ui fallback)
**Code:** the system monospace, only for references and codes (an error digest); numbers use the sans's tabular figures

One family carries everything; hierarchy comes from size and weight steps on a fixed rem scale, ratio about 1.2.

### Hierarchy
- **Headline** (600, 1.5rem, 1.2; 1.875rem from md): page titles.
- **Metric** (600, 2.25rem, 1.1, tabular): the one lead number, last night's sleep. Earned because it is the first leading indicator, and always paired with its comparison and the night window.
- **Title** (600, 1rem, 1.4): panel headings.
- **Body** (400, 0.875rem, 1.5): comparisons, explanations, notices.
- **Label** (400, 0.75rem, 1.33): metadata, axis ticks, night labels.

### Named Rules
**The Tabular Rule.** Any number that sits beside another number uses tabular figures.

## Layout

Phone first. A single column with a 16px gutter stacks in the order of a morning glance: last night, the pattern check, the comparison with usual, the daily log, Oura's scores, sleep stages, thirty-day trends, data coverage. From `lg` the same items split into a main column and a 24rem rail (pattern check, log, scores, coverage), matching the Thoughts home.

Spacing is an 8px rhythm: 24px between panels (32px on desktop), 16px inside panels, 4 to 8px within a group. Headings sit closer to what they introduce than to what precedes them.

### Print
Reports print on paper tokens (`@media print` in globals.css): white surfaces, dark text, and state and series hues darkened to read on paper. The dashboard header and footer do not print.

## Elevation & Depth

Flat and tonal. Panels lift from the page by surface lightness and a hairline border, never by shadow; popovers sit one step lighter. Nothing glows.

## Shapes

Panels round at 14px, controls at 8px, meters and the corridor band are pills. The night bar rounds at 8px so a night reads as one object.

## Components

- **Panel:** Lamplit Slate, hairline border, 14px radius, 16px padding (20px from md). A title, optional night label at the right, optional one-line description. Panels never nest.
- **Night window:** clock-time axis on the hour, usual window as a Corridor band above, the night as a stage-colored bar, hour gridlines in Hairline. Screen readers get the times in text.
- **Night strip:** the last seven nights, newest first, one row each on a shared clock axis: the evening's name and the sleep with its comparison in words on the first line (Lamp Amber only past the threshold), the night as a neutral bar over that night's usual window as a Corridor band, hour gridlines in Hairline. A night that came in pieces shows its pieces. A night with nothing recorded is one line that says so, never a bar. Screen readers get each night as a sentence. Stage colors never appear here: they mark stages, not state.
- **Short-night run:** under the night's comparison, only from the second night: "3rd night in a row shorter than usual · 3h 5m less sleep in total", with a note when the run ends at a night that was not recorded. A short night is one a standard deviation or more below her usual; the text takes Lamp Amber only when the latest night itself is past the threshold.
- **Signal row:** label and value on the first line; the comparison in words and the corridor gauge on the second. Unusual rows add a Lamp Amber pill and comparison text.
- **Corridor gauge:** -3 to +3 standard deviations; band at ±1; ticks at the detector's threshold; Moonlight dot, Lamp Amber once unusual.
- **Date range:** one control on every page that shows a window of days (Alerts, Life chart, Insights, Reports, and the trends on Health, where last night, the week and the pattern check keep reading the latest days whatever is chosen): the presets that suit the page (7d to 1y, and All) and Custom, which opens From and To date fields. The choice lives in the address (`?range=90d`, or `?from=2026-07-01&to=2026-07-31`), so a view can be shared and a refresh keeps it. A line under it says in words what is shown ("Showing Jul 12 – Oct 9, 2026 · 90 days") with what the page found in it. The page resolves the address and passes the result back, so the choice marked is the one in effect; a malformed address falls back to the page's default, and an end date never passes today.
- **Charts:** axes, legends and tooltips come from the chart theme; tooltips are a popover surface with a swatch beside readable text; the hover cursor is a muted wash, not the library's bright gray. A date axis names the month ("Oct 9"), adds the year once the days span two ("Mar 27 ’25"), keeps its first and last label and leaves room between the rest.
- **Pattern status:** always present. Flagged: tinted surface in the tier's color, the tier named in words. Eased (flagged earlier in the 14 days, clear since): neutral surface and when it was last flagged, never the tier's tint. Clear: a Sage check and when the check last ran. Behind (the last check is more than a night old): a Dawn Blue notice with the last night checked and how it catches up, never a check mark, and a line under a flag too. Paused: says why.
- **Notices:** a missing night is Dawn Blue and explains how the data arrives; a lost Oura connection is an amber banner across every dashboard page with the way to reconnect.
- **Buttons:** shadcn variants on these tokens. Default, small and icon sizes reach 40px on phones and tighten from `sm`.

### Shared modules
Use these instead of local copies:
- `components/page-header.tsx` `PageHeader`: every page's title, description and actions.
- `components/ui/panel.tsx` `Panel`: a titled surface; `title` and `meta` take nodes.
- `components/ui/callout.tsx` `Callout` and `components/ui/pill.tsx` `Pill`, by tone: `neutral`, `info` (Dawn Blue), `attention`, `alert`, `calm`.
- `components/ui/toggle-chip.tsx` `ToggleChip`: one on/off choice among peers (tags, filters, dose slots); `aria-pressed`, rose when on.
- `components/ui/date-range-selector.tsx` `DateRangeSelector` with `lib/date-range` (`resolveDateRange`, `presetsFor`, `describeDateRange`, `filterToDateRange`): the window of days a page shows.
- `components/ui/segmented-control.tsx` `SegmentedControl`: one choice from a short fixed set (ranges, views); a radio group with arrow keys.
- `components/ui/day-navigator.tsx` `DayNavigator`; `components/ui/empty-state.tsx` `EmptyState`; `components/ui/stat.tsx` `Stat`; `components/ui/form-message.tsx` `FormMessage`; `components/ui/native-select.tsx` `NativeSelect`; plus `Input`, `Textarea`, `Button`.
- `components/charts/chart-theme.tsx` `CHART`, `AXIS_TICK`, `TOOLTIP_STYLE`, `legendLabel`; `components/charts/chart-tooltip.tsx` `ChartTooltipFrame`, `ChartTooltipRow` (swatch plus readable text).
- `components/pattern-status.tsx` `PatternStatus`; `components/pattern-direction-label.tsx` `PatternDirectionLabel`.
- `lib/design/`: `pattern-tiers` (`tierLabel`, `tierTone`, `tierColor`), `pattern-direction`, `mood-scale` (`MOOD_SCALE`, `moodColor`, `moodSwatchClass`, `formatMoodValue`), `score-bands` (`scoreBand`); `lib/episode-states` (`EPISODE_MARKERS`, `episodeLabel`); `lib/health/format` (`formatNightLabel`, and `axisDayProps` for every date axis).

## Do's and Don'ts

### Do:
- **Do** compare with her usual in words: "1h 59m less than usual", "35m later than usual".
- **Do** name both sides of a night: "Sep 30 → Oct 1". Oura dates nights by the morning they end.
- **Do** say what is missing, why, and what fixes it, in place of the missing thing.
- **Do** theme the browser's own surfaces: selection, caret, scrollbars, focus rings, tabular numerals.

### Don't:
- **Don't** use diagnostic language on the dashboard; it shows patterns against a personal baseline.
- **Don't** let a gap render as zero, an empty chart, or a normal-looking night.
- **Don't** label a date axis with bare numbers (`10-09`): they read as counts and run together. Name the month.
- **Don't** nest panels, add eyebrow labels above headings, use side-stripe borders, gradient text or glow.
- **Don't** stand a progress ring in for a number; show the number and what it is compared with.
- **Don't** put Haze text on Shadow Slate; it falls under 4.5:1.
- **Don't** animate for decoration; motion only reports a state change.
- **Don't** set colored text in a stage or series hue; use a swatch beside readable text.
- **Don't** grade against population norms; compare with her usual range.
- **Don't** start a heart-rate, HRV, temperature, VO₂ max or similar axis at zero; fit it to the data.
