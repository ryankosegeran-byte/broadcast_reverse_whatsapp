# Spec — Auto Date Variables

Date: 2026-11-12
Status: approved (chat), pending implementation
Depends on: nothing (independent of other specs)

## Problem

A template variable like `{{bulan_ini}}` or `{{tahun_ini}}` currently only has a plain text
default (the input with placeholder `-` in the Variables panel). For date-shaped variables the
user must retype the value by hand every month, so the message goes stale silently.

## Decision

Give each variable an optional **auto date source**. When set, the variable's value is computed
live from the device clock at render time, instead of from the manual default text.

- **Live, not snapshotted.** The value is computed on every render. No computed text is stored.
  A backup taken in November renders "November" today and "December" next month; that is
  intended.
- **Applies to template defaults only.** Only the Variables panel (default value) gets the auto
  option. Per-contact values stay manual text and still win over auto, because a contact value is
  an explicit override.
- **Languages name follows the app language**, not the device locale. English app →
  "November" / "Thursday"; Indonesian app → "November" / "Kamis". Uses the same `id`/`en`
  switch as the rest of the UI.
- **Date source is the device clock** (`new Date()`), so it matches the sender's own calendar.

## Resolution order (authoritative)

`resolve(key, contact, template)` in `src/lib/vars.js`:

1. Per-contact value for this template (`contact.values[template.id][key]`)
2. Built-in `nama` (contact name)
3. **Auto date** (`template.auto[key]`) — new
4. Manual template default (`template.globals[key]`)
5. Empty string

Auto sits above the manual default: setting auto replaces the manual default input for that
variable. Auto sits below per-contact values: an explicitly typed per-contact value still wins.

## Presets

Seven presets, no free-form pattern input. Reference date 2026-11-12 (a Thursday).

| id | Indonesian (`id`) | English (`en`) |
| --- | --- | --- |
| `dateMonthYear` | 12 November 2026 | November 12, 2026 |
| `monthName` | November | November |
| `year` | 2026 | 2026 |
| `monthNum` | 11 | 11 |
| `monthYear` | 11/2026 | 11/2026 |
| `dayName` | Kamis | Thursday |
| `numericDate` | 12/11/2026 | 12/11/2026 |

Month/day names come from `Intl.DateTimeFormat` with locale `id-ID` / `en-US`.
`monthNum`, `monthYear`, and `numericDate` are zero-padded manually (`dd/MM/yyyy`) so they never
flip to US month-first ordering.

## Data model

New optional field on a template: `template.auto = { [varKey]: presetId }`.

- Only keys matching `/^[\w.-]+$/` and values that are known preset ids are kept.
- `SCHEMA_VERSION` goes 2 → 3. `migrate()` fills `auto: {}` when absent and drops invalid
  entries, so v1/v2 storage and old backups keep working.
- `mergeStates()` fills a local template's missing auto entries from the imported one, same
  blank-fill rule as `globals`.

## Components

- `src/lib/dates.js` (new) — `AUTO_PRESETS`, `isAutoPreset(v)`, `formatAutoDate(preset, date, lang)`,
  `currentLang()`. Pure, no Svelte, no DOM requirement (falls back to `id`).
- `src/lib/vars.js` — `resolve()` gains the auto branch before the globals branch.
- `src/lib/AutoDateModal.svelte` (new) — props `{ t, varKey, value, onPick, onClose }`. Radio list
  of the seven presets, each row showing the live value for today, plus a "Manual / clear" option.
  Same overlay/escape/focus pattern as `HelpModal.svelte`.
- `src/App.svelte` — `autoFor` state, per-row Auto button, clear action, modal render, template
  creation gets `auto: {}`, add-contact placeholder shows the auto value.
- `src/lib/storage.js` — schema v3, migrate + merge.
- `src/lib/i18n.svelte.js` — EN + ID strings.
- `src/styles.css` — `.var-auto-row`, `.auto-option*` classes.
- `docs/USAGE.md` — usage section.

## Testing

- `src/lib/dates.test.js` (new) — every preset with a fixed date, both languages, unknown preset.
- `src/lib/vars.test.js` — auto beats manual default, per-contact beats auto, invalid preset falls
  through to the manual default, auto works with no contact.
- `src/lib/storage.test.js` — v1/v2 → v3 migration keeps `auto: {}`, invalid preset ids dropped,
  merge fills blank auto entries.
- `npm run build` must pass.
- Manual: set `bulan_ini` to auto, confirm the panel, the preview, the recipient table, and the
  add-contact placeholder all show today's value and that switching app language changes the
  month/day name.

Non-deterministic-date note: tests assert against `formatAutoDate(preset)` output rather than a
hardcoded month, so the suite passes on any day of the year.

## Non-goals

- No free-form pattern string (e.g. `dddd, D MMMM YYYY`).
- No time-of-day, timezone, or clock-offset values.
- No relative dates (`besok`, `kemarin`, `minggu depan`).
- No auto option on per-contact values.
- No midnight live-refresh timer; the value updates on the next render or page load.

## Risks

- `Intl` month/day names must match between the browser and Node 18+ (both ship full ICU). If a
  runtime returns an odd name, that is a display nit, not a correctness bug.
- The Variables panel row gains a second line, so the compact desktop layout needs a visual check
  at 760px and below.
