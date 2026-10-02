# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the person wearing the Oura Ring**, who tracks bipolar patterns. She opens the app mostly on her phone, usually in the morning, to see how last night went, whether anything is drifting from her usual pattern, and to fill in the day's log (mood, episode state, medications, tags, a note).
- **Secondary: her partner**, who writes the "Thinking of you" notes on the home page and checks in on how she is doing. Either of them can fill in the daily log.
- Access is private: magic-link sign-in for a short allow-list. Oura-derived private data is limited to a sensitive-viewer list, and the first entry on it owns the detection profile.

## Product Purpose

Turn her Oura Ring data and daily log into early, personal-baseline awareness of shifts in sleep and daily rhythm, which often come ahead of a change in mood, so a drift is noticed days sooner rather than after the fact.

Success is **lead time**: last night's data and any departure from her usual are visible the same morning, and a broken data feed is never silent.

## Positioning

Built for one person and judged against her own baseline, not population norms. Short or late nights, irregular timing and physiological shifts are framed as departures from her usual range. It pairs the ring's passive signal with her own log and medications, and it is warm rather than clinical: the notes from her partner live on the same home page.

## Operating Context

- Ring data reaches Oura when the Oura app on her phone syncs, usually soon after waking. The app pulls from Oura's API hourly through the morning and twice more each day (ET), and on demand from the Health page.
- Days and nights are in US Eastern time. Oura dates a night by the morning it ends; the interface names both sides ("Sep 30 → Oct 1").
- A detector scores each night against her trailing 30-day baseline and assesses multi-day patterns as watch, warning or alert, in a higher- or lower-activation direction. Sensitivity is configurable in Settings.
- Daily reminders (email or SMS) nudge the log when it is empty. Email alerts tell her partner about sign-ins, visits, saved logs, reactions and Oura outages.

## Capabilities and Constraints

- **Not a medical device and never diagnostic.** The interface says "pattern" and "personal baseline", not diagnoses; methodology and research context are linked from where numbers appear.
- Oura scopes relied on: `email personal daily heartrate workout tag session spo2 stress heart_health`. Each must also be enabled on the Oura developer application, or Oura silently withholds it.
- One Oura connection, one person's data. Refresh tokens are single-use, so the connection is precious: the app only refreshes when a token is expiring or a required request is rejected.
- Stack: Next.js App Router on Vercel, Turso (libSQL) through Drizzle, Auth.js magic links through Resend, Recharts.

## Brand Commitments

- Name: "Slothie's Bipolar Tracker", with the sloth emoji as its mark.
- A warm rose accent, carried by the notes, the thoughts heatmap and the alert emails.
- A dark interface.

## Evidence on Hand

- Real data only: her own Oura history and daily log. There are no testimonials, benchmarks or clinical claims, and none may be invented.
- Research references live in `src/lib/research/references.ts`.

## Product Principles

1. **Lead time first.** The newest night and its departure from her usual lead every view.
2. **Gaps are loud.** Missing, late or partial data says so in words, with the reason and the fix. It never looks like a normal night.
3. **Her baseline, plain words.** Compare with her own usual, in everyday language; never diagnose.
4. **Phone first, in the morning.** One-handed and glanceable on a first look of the day.
5. **Every number is traceable.** Its unit, the night it belongs to, and what it is compared with.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast. Color never carries meaning alone: direction and range are also stated in words.
- Hyperlegible type with distinct numerals for a quick morning read; touch targets of at least 40px on phones; reduced motion respected.
