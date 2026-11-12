# Spec — Contact Groups, Group Manager, and Sent Tracking

Date: 2026-11-12
Branch: `feat/contact-groups`
Status: approved (chat), pending implementation

## Problem

Contacts are a flat list with free-form labels. Users cannot:

- organise contacts by group **and** subgroup (e.g. "Kue" → "Perumahan Agape");
- rename or delete a label without editing every contact by hand;
- nest one label under another, or reorder them;
- filter by *combining* labels (group AND area) to target a send;
- see, at a glance in Send mode, which contacts a template was already sent to.

## Goals

1. **Group registry** — a directory of groups with an optional parent, so groups can be
   renamed, deleted, nested, and reordered in one place.
2. **Subgroups** — a group can sit under another. A subgroup's name is still a plain
   contact label, so nothing about sending changes.
3. **Combined filter** — pick several labels with AND (every label) or OR (any label),
   defaulting to AND, to target exactly one group's slice.
4. **Sent tracking** — mark a contact as sent when its WhatsApp link is opened, move sent
   contacts into a collapsed section at the bottom, and add an All / Not sent / Sent filter.
5. **Kelola Kontak view** — a dedicated Contacts view (new tab) for browsing, bulk label
   assignment, group management, and the existing add / paste / import actions. The Send
   tab keeps its own label filter and selection so you can pick and send without leaving it.
6. **Backup** — export/import carries the group registry, so moving to another device keeps
   groups and their hierarchy.

## Non-goals

- No backend, cloud, auto-send, or delivery receipts (WhatsApp gives no status to a plain link).
- No per-group templates or per-group message bodies.
- No CSV export (JSON backup covers moving data).
- No arbitrary-depth enforcement beyond cycle prevention; the UI indents however many levels
  exist, but the intended shape is two levels (group → subgroup).

## Design decisions

- **Labels stay plain strings on the contact** (`contacts[].labels: string[]`). This keeps
  CSV/VCF import, filtering, and backup compatibility (v1–v3 files keep importing).
- **The registry is additive**: `groups: [{ id, name, parentId }]`. A label used on a contact
  with no registry row is auto-created as a top-level group on load and on import
  (`syncGroups`). The registry never holds the contact list; it holds hierarchy, order, and
  the single place a rename happens.
- **Subgroup membership implies parent membership**: assigning a subgroup adds its ancestor
  names to the contact too, so filtering by the parent group still returns subgroup members.
- **"Sent" means the WhatsApp link was opened** from this app for the active template, which is
  the only signal available without a backend. It is auto-set on open and can be toggled off
  (mis-click) or on (manual) per contact.

## Data model (schemaVersion 4)

```js
{
  schemaVersion: 4,
  updatedAt: ISO,
  groups: [{ id, name, parentId: string | null }],
  templates: [{ id, name, body, vars, globals, auto, createdAt, updatedAt }],
  contacts: [{
    id, phone, name,
    labels: string[],                        // group names; unchanged from v3
    values: { [templateId]: { [key]: string } },
    sentAt: { [templateId]: ISO },
  }],
}
```

Rules:

- Group `name` is trimmed and unique (case-sensitive). Duplicate rows collapse to the first.
- `parentId` must reference an existing group; a self-reference or a cycle is reset to `null`.
- Registry rows whose name is no longer used by any contact are **kept** (a user may create a
  group before filling it).
- Deleting a group removes the row, strips the label from every contact, and promotes its
  children one level up (to the deleted group's parent).
- Renaming a group rewrites the registry row **and** the label string on every contact.
- `migrate()` upgrades v1–v3 by deriving `groups` from the labels already in use, so older
  backups and existing local storage gain a registry automatically.

## Behaviour

### Send tab — filter

- Label chips stay, backed by `labelPool` (unique labels across contacts).
- A **match mode** toggle (AND / OR) sits with the chips. Default **AND**: a contact must have
  every selected label. **OR**: a contact must have at least one. The mode is shared with the
  preview picker, which uses the same filtered list.
- A **status filter** segmented control (All / Not sent / Sent) appears only when a template is
  active. It narrows the list to contacts without / with `sentAt[template.id]`.

### Send tab — sent tracking

- The list is split into not-sent (top) and sent (bottom).
- Sent contacts render inside a collapsible **"Sent (n)"** section at the bottom, collapsed by
  default. Expanding it shows the same rows with a "Sent" badge.
- When the status filter is `Sent` or `Not sent`, the list renders flat: only that group, no
  collapsible section.
- Each row has a small toggle: sent rows get "Undo sent mark", not-sent rows get
  "Mark as sent". Opening the WhatsApp link sets sent automatically (existing behaviour),
  replacing the current "Opened" badge with the "Sent" badge in this view.

### Contacts view (Kelola Kontak)

A new `ContactsView` mounted as its own tab. Entry points: a "Contacts" button in the desktop
toolbar, a fifth bottom-nav button on mobile, and an item in the mobile menu. Leaving it returns
to the Send tab.

- **Left column — groups**: an outline list (parents, then indented children), each with a
  contact count. Each row has a menu: *Rename*, *Delete*, *Add subgroup*, *Make main group*, and
  *Move under…* (a select of other groups) as the keyboard-accessible alternative to drag.
  Rows are draggable: dropping group A onto group B reparents A under B; dropping onto the
  "Main groups" drop target makes A top-level. Cycle-forming drops are rejected.
- **Right column — contacts**: search + label filter (reuses the same AND/OR mode), checkbox
  per contact, select-all.
- **Bulk action bar** (shown when any contact is selected): *Add label* (pick an existing group
  or type a new name), *Remove label* (pick from labels the selection shares), *Delete*.
- **Row actions**: open the existing `ContactModal` ("Kelola"), delete.
- **Header actions**: reuse the existing add / paste / import-contact dialogs.
- **Rename feedback**: after a rename, an inline bar shows "Renamed to X" with an *Undo* button
  for a few seconds; undo renames back.
- Hierarchy nesting is registered in `groups`; a subgroup assignment also adds the ancestor
  labels (see design decisions).

### Backup

- Export writes `schemaVersion: 4` including `groups`.
- Import validates (phone checks unchanged) and offers Merge or Replace all as today.
- Merge adds incoming groups not already present by name (local wins on a name clash) and keeps
  local parent assignments; then `syncGroups` covers any contact-only labels.
- The import summary line is unchanged; group data simply rides along with the merge.

## Touched files

- `src/lib/groups.js` (new) — registry normalise / sync / outline / ancestors / reparent /
  rename / delete / bulk assign / filter / sent split. Pure, no DOM.
- `src/lib/groups.test.js` (new).
- `src/lib/storage.js` — `SCHEMA_VERSION = 4`, `groups` in `emptyState`, `migrate`,
  `mergeStates`, `validateState` counts.
- `src/lib/storage.test.js` — extend.
- `src/lib/contacts.test.js` — unchanged unless helpers move (they do not).
- `src/lib/RecipientTable.svelte` — AND/OR toggle, status filter, sent split + collapsible
  section, per-row mark toggle.
- `src/lib/ContactsView.svelte` (new) — the Kelola Kontak view.
- `src/App.svelte` — `groups` state wiring, label mode, sent toggle, group ops + undo, new tab
  entry points and rendering.
- `src/lib/i18n.svelte.js` — EN + ID strings, help items, About feature list.
- `src/styles.css` — group outline, drop targets, bulk bar, sent section, tab layout.
- `docs/USAGE.md` — usage update.

## Testing

Pure functions via `node --test src/lib/*.test.js`:

- registry normalise (dedupe, invalid/cyclic parent), `syncGroups`, `groupOutline` order and
  depth, `groupAncestors`, `labelsForGroup`, `setGroupParent` cycle rejection,
  `renameLabel`, `deleteLabel` (child promotion), `assignLabels` add/remove, `filterByLabels`
  AND/OR, `splitBySent`.
- `migrate` v1/v2/v3 → v4 derives groups from labels; `mergeStates` unions groups;
  `validateState` counts include groups.

UI verified manually in `npm run dev` per phase (checklist in the implementation plan).

## Phases

1. Data model v4: `groups.js` + tests, `storage.js` v4 + tests.
2. Send tab: AND/OR filter, status filter, sent split + collapsible section, per-row sent toggle.
3. Contacts view: outline, bulk label ops, rename/delete with undo, drag + keyboard reparent.
4. i18n, styles, `docs/USAGE.md`, Help/About text.

Each phase: `npm run test` and `npm run build` green, manual check, then commit.
