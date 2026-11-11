# Spec — Labels, Variable Manager, Contact Selection, CSV/VCF Import

Date: 2026-11-11
Branch: `feat/labels-variables-contact-import`
Status: approved (chat), pending implementation

## Problem

Recipients are a flat list. Users cannot:

- group numbers (e.g. "Pelanggan", "Jatuh Tempo") and send per group;
- name/describe template variables or give them display names;
- select a subset of contacts to work through;
- bulk-load contacts from CSV/VCF export files;
- back up labels and variable definitions together with templates.

## Goals

1. **Labels** — free-form, multiple labels per contact. Filter the recipient list by
   label, then pick the template. Sending stays per-contact WhatsApp links (no backend).
2. **Selection** — checkbox per contact plus select-all, to narrow the working set.
3. **Variable manager** — per-template variable definitions (`key` + display name) and
   default value, filled per contact.
4. **CSV/VCF import** — file → preview → column mapping → merge into contacts.
5. **Backup v2** — JSON export/import carries labels and variable definitions.

## Non-goals

- No backend, no cloud, no auto-send, no attachments.
- No contact groups registry separate from contact labels.
- No CSV export (JSON backup covers moving data).

## Data model (schemaVersion 2)

```js
{
  schemaVersion: 2,
  updatedAt: ISO,
  templates: [{
    id, name, body,
    vars: [{ key: string, label: string }],  // explicit metadata; label = display name
    globals: { [key]: string },              // template default value (also used as default)
    createdAt, updatedAt,
  }],
  contacts: [{
    id, phone, name,
    labels: string[],                        // free tags, multi, no registry
    values: { [templateId]: { [key]: string } },
    sentAt: { [templateId]: ISO },
  }],
}
```

Decisions:

- Labels are plain strings on the contact. The label list shown in the UI is derived
  from contacts. Renaming a label = rewriting that string on every contact.
- `vars[]` is metadata only (`key`, `label`). It does **not** duplicate the default
  value; the existing `globals` map is the default value. `vars[]` lets a variable exist
  without appearing in the body, and lets the variable carry a display name.
- Variable set for a template = `vars[]` keys ∪ variables detected in the body.
- `resolve()` unchanged: contact value → contact name (for `nama`) → template `globals` → empty.
- `migrate()` upgrades v1 → v2 by filling `labels: []` and `vars: []`. v1 backup files
  remain importable.

## Behaviour

### Labels

- Contact card and table row have an inline label editor: chips with an "x" to remove and
  an input with a `<datalist>` of existing labels to add.
- Recipient panel shows a label filter row (toggle chips, OR semantics) plus the existing
  search box. Filter is empty = all contacts.
- Label chip colour is deterministic from the label name (hash → hue), no colour settings.

### Selection

- Checkbox column in the table, plus a header checkbox that selects/clears all currently
  shown (filtered + searched) contacts.
- Working set for Send/Focus = filtered + searched list, narrowed to checked contacts when
  any are checked. Selection is transient UI state (not persisted).
- `Select all` / `Clear` buttons in the recipients tool bar.

### Variable manager

- Variables block lists one row per variable: `key` (read-only text), display-name input,
  default-value input (bound to `globals[key]`), remove button.
- `Add variable` validates the name, adds a `vars[]` entry, and inserts the token at the
  cursor (existing behaviour).
- Remove drops the `vars[]` entry and strips matching `{{key}}` tokens from the body, so
  the variable disappears from the form.
- `{{nama}}` remains the built-in, always shown as a separate chip, never in `vars[]`.

### CSV/VCF import

- Recipients panel gets an "Import CSV / VCF" button opening a dialog.
- Dialog: choose file → parse → preview table (first 10 rows) → per-target column mapping
  (`nomor` required, `nama`, `label`, one select per variable key, `abaikan`) → Import.
- CSV parse is quote-aware (RFC 4180-ish); delimiter auto-detected among `,` `;` tab.
- Header auto-detect: `phone/nomor/tel/telepon/hp/wa/whatsapp/msisdn/mobile` → phone;
  `name/nama/fn/fullname/kontak` → name; `label/tag/grup/group/kategori/category` → label;
  otherwise match variable key.
- VCF (phone contact export): unfold folded lines; per vCard take first `TEL` and `FN`/`N`.
- Multi-label in one cell: split on `;` or `|` (not `,`, which is the CSV delimiter).
- Merge into contacts, dedup by normalised phone: existing → fill empty name, union
  labels, fill empty variable values, keep newest `sentAt`; new → append.
- Result summary: added / merged / invalid counts.

### Export / Import v2

- Export writes `schemaVersion: 2` including `vars` and `labels`.
- Import validates then offers Merge (`mergeStates`) or Replace all (existing dialog).
- Merge: templates matched by id then name (local wins); `vars` merged by key (fill blank
  labels / add new keys); `globals` fill blanks; contacts via `mergeContacts` (labels union).

## Touched files

- `src/lib/storage.js` — SCHEMA_VERSION 2, migrate, mergeStates (delegate contacts), validate.
- `src/lib/vars.js` — add `templateVarKeys(template)`, `varLabel(template, key)`.
- `src/lib/contacts.js` (new) — parsers, mapping, mergeContacts, label helpers.
- `src/lib/contacts.test.js` (new).
- `src/lib/vars.test.js`, `src/lib/storage.test.js` — extend.
- `src/lib/ContactImport.svelte` (new).
- `src/App.svelte`, `src/lib/RecipientTable.svelte` — label filter, selection, manager, wiring.
- `src/styles.css` — new classes.
- `src/lib/i18n.svelte.js` — EN + ID strings + helpItems.
- `docs/USAGE.md` — usage update.

## Testing

Pure functions covered by `node --test src/lib/*.test.js`: CSV/VCF parsing, column
guessing, row mapping, contact merge (labels union), migrate v1→v2, variable union/labels,
label colour determinism. UI verified manually in `npm run dev` per phase.

## Phases

1. Data model v2 + labels + filter + selection.
2. Variable manager (per-template `vars[]`, display name, default, remove).
3. CSV/VCF import dialog + parsers + merge.
4. Export/import v2 polish + `docs/USAGE.md` + Help modal strings.

Each phase: `npm run test` and `npm run build` green, manual check, then commit.
