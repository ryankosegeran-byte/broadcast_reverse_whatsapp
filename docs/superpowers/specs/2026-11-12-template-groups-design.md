# Spec — Template Groups, Template Manager, Search and Filter

Date: 2026-11-12
Branch: `feat/template-groups`
Status: approved (chat), pending implementation

## Problem

Templates are a flat list in the left sidebar (`data.templates`), each row a name plus a delete
button. Users with many templates cannot:

- organise templates by group **and** subgroup (e.g. "Usaha Roti" → "Pemberitahuan" →
  "Pengingat Pembayaran");
- see what a template is *for* without reading its body;
- search templates by name or by the group they belong to;
- narrow the list to one group's slice while composing or sending.

## Goals

1. **Template-group registry** — a directory of groups with an optional parent, so groups can be
   created, renamed, deleted, nested, and reordered in one place.
2. **Arbitrary nesting** — a group can sit under any other group to any depth. The intended shape
   is two or three levels (business → section → type), but nothing enforces a limit beyond cycle
   prevention.
3. **Assignment** — every template belongs to at most one group (`groupId`). Moving a template
   between groups is a drag in the sidebar tree or a picker in the template editor.
4. **Search** — one box that matches a template name *or* any name in its group path.
5. **Filter** — pick one group (or "All groups" / "No group") to show that group plus its
   subgroups.
6. **Template manager modal** — a single place to create / rename / delete / nest groups.
7. **Backup** — export/import carries the group registry, so moving to another device keeps the
   hierarchy.

## Non-goals

- No field separate from the group for "purpose". The group *is* the purpose axis.
- No multiple groups per template (no tags).
- No per-group message bodies, send rules, or bulk template actions in the manager modal.
- No backend, cloud, or sync.

## Design decisions

- **The registry is additive**: `templateGroups: [{ id, name, parentId }]`, the same shape as the
  contact-group registry in `groups.js`, but a separate module because the operations differ
  (deleting a template group *moves* templates up; deleting a contact group *strips a label*).
- **Templates reference a group by id** (`templates[].groupId`), not by name. Renaming a group
  therefore rewrites only the registry row — no template is touched. This is simpler than the
  contact-label model, where a rename rewrites every contact.
- **One group per template.** `groupId: null` means "No group". A template with no group renders
  in a "No group" bucket at the bottom of the tree.
- **Search matches the group path too.** Typing `roti` shows every template under "Usaha Roti"
  (and its subgroups); typing `bayar` shows "Pengingat Pembayaran".
- **Filter is a single-choice picker** (a `Select`) on both desktop and mobile, not a click on a
  tree node. One mechanism, identical on both layouts, and it does not fight with expand/collapse.
  Tree rows keep their expand/collapse chevron.
- **Deleting a group promotes, never deletes.** Its templates move to the deleted group's parent
  (or "No group" when it was top-level), and its subgroups are promoted one level. Mirrors the
  contact-group rule.

## Data model (schemaVersion 5)

```js
{
  schemaVersion: 5,
  updatedAt: ISO,
  groups: [{ id, name, parentId }],                 // contact groups, unchanged
  templateGroups: [{ id, name, parentId: string | null }],
  templates: [{
    id, name, body, vars, globals, auto,
    groupId: string | null,
    createdAt, updatedAt,
  }],
  contacts: [...],                                  // unchanged
}
```

Rules:

- Template-group `name` is trimmed and unique (case-sensitive). Duplicate rows collapse to the
  first.
- `parentId` must reference an existing template group; a self-reference or a cycle is reset to
  `null`.
- Registry rows whose group holds no template are **kept** (a user may create a group before
  filling it).
- Deleting a group removes the row, reparents its subgroups to the deleted group's parent, and
  sets `groupId` of its templates to that parent (or `null`).
- `migrate()` upgrades v1–v4 by adding `templateGroups: []` and `groupId: null` to every template;
  a `groupId` that references a missing group is reset to `null`.

## Behaviour

### Sidebar (desktop left rail and the mobile **Template** tab)

Replaces the flat `<ul class="tpl-list">`.

- **Search box** at the top: matches a template name or any name in its group path.
- **Group filter** (`Select`): "All groups", one row per group indented by depth, and "No group".
  Choosing a group shows that group's templates plus every subgroup's.
- **Tree**: a collapsible row per group (chevron, folder icon, name, template count) with its
  templates as leaf rows beneath it; a "No group" bucket at the bottom. Groups with no children
  and no templates show no chevron. Groups are expanded by default; while a search is active, the
  tree force-expands so matches are visible.
- **Drag**: a template leaf is draggable; dropping it on a group row (or on the "No group" row)
  moves it to that group.
- **Kelola** button (icon) in the panel head, next to **New template**, opens the manager modal.
  It also appears in the mobile menu.
- **New template** is created inside the group currently selected in the filter (or "No group"
  when the filter is "All groups" or "No group").

### Template manager modal

A new `TemplateGroupManager.svelte`, modelled on `LabelFilter.svelte` (overlay, focus trap,
`Escape`, backdrop click to close). Contents: the group outline with per-row menu — *Rename*,
*Add subgroup*, *Make main group*, *Move under…* (a select), *Delete*. Rows are draggable: dropping
group A on group B reparents A under B; a "Main groups" drop target makes A top-level.
Cycle-forming drops are rejected. A text field at the top creates a new group (or a subgroup of
the pending parent).

### Template editor

A **Group** `Select` under the template name (options: every group indented, plus "No group").
This is the keyboard-accessible and mobile way to move a template.

### Backup

- Export writes `schemaVersion: 5` including `templateGroups` and each template's `groupId`.
- Import validates as today and offers Merge or Replace all. Merge unions template groups by name
  (local wins on a name clash), remaps an incoming template's `groupId` to the local group with
  the same name when the incoming group already exists, and keeps local group assignments.

## Touched files

- `src/lib/templateGroups.js` (new) — registry normalise / create / outline / ancestors / path /
  reparent / rename / delete / assign / counts / filter / descendant ids. Pure, no DOM.
- `src/lib/templateGroups.test.js` (new).
- `src/lib/storage.js` — `SCHEMA_VERSION = 5`, `templateGroups` in `emptyState`, `migrate`,
  `mergeStates`, `validateState` counts.
- `src/lib/storage.test.js` — extend.
- `src/lib/TemplateGroupManager.svelte` (new) — the manager modal.
- `src/App.svelte` — state, derived, handlers, sidebar tree + search + filter + drag, manager
  modal, editor group picker, new-template placement.
- `src/lib/i18n.svelte.js` — EN + ID strings, help items, About feature list.
- `src/styles.css` — template tree, depth indent, drop targets, search row.
- `docs/USAGE.md` — usage update.

## Testing

Pure functions via `node --test src/lib/*.test.js`:

- `normalizeTemplateGroups` (dedupe, invalid / cyclic / self parent), `createTemplateGroup`
  (idempotent by name, blank name), `templateGroupOutline` order and depth, `isTemplateGroupDescendant`,
  `setTemplateGroupParent` cycle rejection, `templateGroupAncestors` and `templateGroupPath`,
  `renameTemplateGroup` (registry only, rejects a taken name), `deleteTemplateGroup` (children and
  templates promoted to parent), `assignTemplateGroup`, `templateGroupCounts`,
  `templateGroupDescendantIds`, `filterTemplates` (name match, path match, focus group incl.
  subgroups, "No group", empty query).
- `migrate` v1–v4 → v5 adds `templateGroups` and `groupId`; dangling `groupId` reset;
  `mergeStates` unions template groups and remaps incoming refs; `validateState` counts include
  `templateGroups`.

UI verified manually in `npm run dev` per phase (checklist in the implementation plan).

## Phases

1. Data model v5: `templateGroups.js` + tests, `storage.js` v5 + tests.
2. Sidebar: tree, search, group filter, drag-to-group, new-template placement.
3. Manager modal (`TemplateGroupManager.svelte`) + Kelola entry points.
4. Editor group picker, i18n, styles, `docs/USAGE.md`, Help/About text.

Each phase: `npm run test` and `npm run build` green, manual check, then commit.
