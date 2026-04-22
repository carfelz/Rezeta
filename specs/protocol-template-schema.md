# Protocol Template Schema

> Living document. Last updated: April 2026.
>
> This document specifies the structure of protocol templates, protocol types, and protocol content in the Medical ERP's protocol engine.

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [The Three-Layer Model](#2-the-three-layer-model)
3. [Lock Rules & Editability](#3-lock-rules--editability)
4. [Block Type Catalog](#4-block-type-catalog)
5. [Template Schema](#5-template-schema)
6. [ProtocolType Schema](#6-protocoltype-schema)
7. [Protocol Content Schema](#7-protocol-content-schema)
8. [Worked Example](#8-worked-example)
9. [Validation Rules](#9-validation-rules)
10. [Versioning & Migration](#10-versioning--migration)
11. [MVP vs Future Scope](#11-mvp-vs-future-scope)

---

## 1. Design Principles

The schema is shaped by five guiding principles:

1. **Templates suggest, doctors decide.** Templates provide a starting structure but do not constrain what doctors can add, remove, or reorder (except for blocks the template creator explicitly marks as required).
2. **Template authors control rigidity.** The template author decides — per block and per section — whether each element is required or optional in resulting protocols. The system enforces no defaults.
3. **Templates are encapsulated behind types.** Doctors interact with types (a user-facing category) rather than templates directly. Templates are infrastructure; types are the surface.
4. **Two-level nesting only.** Sections contain blocks; blocks do not contain sections. This covers 95% of real protocols while keeping UX and data model simple.
5. **JSON-native, PostgreSQL-friendly.** All schemas stored as JSONB, searchable via GIN indexes, renderable without complex joins.

## 2. The Three-Layer Model

The protocol engine is built on three concepts, arranged in strict layers:

```
ProtocolTemplate  —  the blueprint (structure, required/optional flags, placeholders)
      ▲
      │  referenced by
      │
ProtocolType      —  the user-facing category (name + chosen template)
      ▲
      │  referenced by
      │
Protocol          —  the actual clinical content (content via ProtocolVersion)
```

### The Layers in Plain Language

- **`ProtocolTemplate`** is a blueprint. It defines the block structure a class of protocols should follow — which sections exist, which blocks inside them are required, what placeholder hints guide the author. Templates are **tenant-owned**: every tenant has its own templates, and there is no cross-tenant sharing in MVP. On tenant creation, five starter templates are seeded as tenant-owned copies (see `starter-templates.md`).
- **`ProtocolType`** is the bridge. It has a user-facing name (like "Emergencia" or "Procedimiento") and points to exactly one template. Its purpose is to give doctors a way to categorize protocols without ever exposing the word "template" or the template's internal structure. Types are tenant-owned.
- **`Protocol`** is an instance. Every protocol belongs to exactly one type; through that type, it inherits a template (and therefore structural constraints like required blocks). Protocols are tenant-owned, and their content lives in immutable `ProtocolVersion` snapshots.

### Why the Middle Layer Exists

Directly attaching protocols to templates works, but it forces doctors to think about templates every time they create a protocol. The type layer:

- Lets doctors categorize by their own vocabulary ("Emergencia", "Fisioterapia deportiva", "Consulta de control") without ever being asked to pick a template.
- Provides a filter axis on the protocol list page (filter by type, not by template).
- Creates a future hook for metadata, usage analytics, and governance — things that don't belong on the template (shared across types) or the protocol (per-instance).

In MVP, types carry only `name + template_id + tenant_id` plus audit fields. Future versions will add metadata and analytics to the type, without changing the templates or protocols beneath.

### What Cannot Happen

- A protocol without a type. The foreign key is required.
- A type without a template. The foreign key is required.
- A protocol pointing at a template directly. Only `type_id` exists on `Protocol`; `template_id` does not.
- A type switching its template after creation. The template choice is immutable once the type exists (enforced in the service layer — see `Section 3`).

### Entity Summary

| Entity             | Purpose                                     | Tenant scoping           | Key fields                               |
| ------------------ | ------------------------------------------- | ------------------------ | ---------------------------------------- |
| `ProtocolTemplate` | Reusable structural blueprint               | **Required** `tenant_id` | `schema` (JSONB), `name`, `is_seeded`    |
| `ProtocolType`     | User-facing category pointing at a template | **Required** `tenant_id` | `name`, `template_id`                    |
| `Protocol`         | Tenant-owned instance belonging to a type   | **Required** `tenant_id` | `type_id`, `title`, `current_version_id` |
| `ProtocolVersion`  | Immutable snapshot of a protocol's content  | **Required** `tenant_id` | `content` (JSONB), `version_number`      |

`is_seeded` on templates records whether the row came from the starter seed on tenant creation vs. being authored from scratch. It is informational only — seeded templates have no special permissions or lock behavior.

## 3. Lock Rules & Editability

Every layer has a lock rule tied to downstream references. The rules cascade: deleting or editing at one layer requires that no active (non-soft-deleted) references exist at the layer below.

### Template Lock

A template is **locked** iff any non-deleted `ProtocolType` in the same tenant references it.

When locked:

- **All edits are rejected.** Total lock, not partial. Name, description, block structure, required flags, placeholder hints — none can change.
- **Deletion is rejected.**
- The template editor renders read-only with a banner naming the type(s) blocking it.
- To unlock: delete every type that references the template (which may itself require deleting or reassigning protocols — see the type rule).

Rationale: allowing even "harmless" edits (like renaming) while the template is in use opens the door to subtler drift — a block's placeholder text changing after protocols were authored against the old hint, or a required flag changing and suddenly making existing protocols invalid against their own template. Total lock is the only rule simple enough to explain, enforce, and reason about across versions.

### Type Lock

A type is **locked** iff any non-deleted `Protocol` in the same tenant references it.

When locked:

- **Name edits are allowed.** Renaming a type is safe because protocols reference it by `id`, not by name.
- **Template reassignment is rejected.** A type's `template_id` is immutable after creation, whether locked or not. Changing the template would invalidate the structure of every protocol on that type.
- **Deletion is rejected.**
- To unlock: delete every protocol referencing the type (soft-delete is sufficient — see below).

### Protocol Lock

Protocols are not "locked" in the same sense. Content edits are allowed at any time (they produce new `ProtocolVersion` rows, never mutate old ones). A signed protocol (if/when that concept lands — v2) would follow the same sign-and-amend pattern as consultations.

### Why This Is the Right Default for MVP

The rules above are strict. They trade flexibility for predictability. A doctor who wants to "tweak a template a little" has to delete the type, edit the template, and recreate the type — a 30-second operation when no protocols exist, a larger operation once protocols depend on the type.

We accept this friction because:

- Template editing is an infrequent activity (most doctors will customize once and then live with their templates for months).
- The cost of getting it wrong — existing protocols silently becoming invalid — is high.
- Template **versioning** (which would let edits happen non-destructively) is deferred to v2. Until versioning lands, total lock is the simplest safe rule.

## 4. Block Type Catalog

The block catalog is shared between templates (where blocks carry `required` and `placeholder` fields) and protocols (where blocks carry actual content). Every block has a unique `id` within its containing document (template or protocol), prefixed by concept:

| Prefix | Meaning                        | Example            |
| ------ | ------------------------------ | ------------------ |
| `sec_` | Section                        | `sec_assessment`   |
| `blk_` | Block (any non-section type)   | `blk_checklist_01` |
| `stp_` | Step inside a steps block      | `stp_01`           |
| `itm_` | Item inside a checklist        | `itm_03`           |
| `row_` | Row inside a dosage table      | `row_02`           |
| `brn_` | Branch inside a decision block | `brn_yes`          |

### 4.1 `section` — Container

Groups related blocks under a heading. The only block type that contains other blocks.

```json
{
  "id": "sec_01",
  "type": "section",
  "title": "Initial Assessment",
  "description": "First steps on patient arrival",
  "collapsed_by_default": false,
  "blocks": [
    /* child blocks, any type except section */
  ]
}
```

**Fields:**

- `title` (required, string) — Display heading
- `description` (optional, string) — Subtitle or short description
- `collapsed_by_default` (optional, boolean, default `false`) — UX hint for rendering
- `blocks` (required, array) — Child blocks of any non-section type

### 4.2 `text` — Rich paragraph

Free-form prose with basic formatting. Content stored as Markdown.

```json
{
  "id": "blk_01",
  "type": "text",
  "content": "Review patient history for known allergies. Confirm last meal timing before any sedation."
}
```

**Fields:**

- `content` (required, string) — Markdown-formatted text

**Supported Markdown:** bold, italic, unordered lists, ordered lists, links, inline code. No HTML, no images (use attachments instead), no headers (sections provide structure).

### 4.3 `checklist` — Unordered items to verify

```json
{
  "id": "blk_02",
  "type": "checklist",
  "title": "Pre-intervention checks",
  "items": [
    { "id": "itm_01", "text": "Confirm patient identity", "critical": false },
    { "id": "itm_02", "text": "Verify NPO status", "critical": true },
    { "id": "itm_03", "text": "Check IV access", "critical": false }
  ]
}
```

**Fields:**

- `title` (optional, string)
- `items` (required, array, min 1) — List of items
  - `id` (required, string)
  - `text` (required, string)
  - `critical` (optional, boolean, default `false`) — Must-do items, rendered with emphasis

### 4.4 `steps` — Numbered sequential actions

```json
{
  "id": "blk_03",
  "type": "steps",
  "title": "Airway management",
  "steps": [
    {
      "id": "stp_01",
      "order": 1,
      "title": "Position patient",
      "detail": "Supine, head tilt-chin lift"
    },
    {
      "id": "stp_02",
      "order": 2,
      "title": "Assess breathing",
      "detail": "Look, listen, feel for 10 seconds"
    }
  ]
}
```

**Fields:**

- `title` (optional, string)
- `steps` (required, array, min 1) — Ordered steps
  - `id` (required, string)
  - `order` (required, integer) — Display order (1-based)
  - `title` (required, string) — Short action name
  - `detail` (optional, string) — Longer description

### 4.5 `decision` — If/then/else branching

One condition with N branches. No nested decisions in MVP.

```json
{
  "id": "blk_04",
  "type": "decision",
  "condition": "Systolic BP < 90 mmHg?",
  "branches": [
    {
      "id": "brn_yes",
      "label": "Yes",
      "action": "Initiate fluid resuscitation with 500mL NS bolus. Reassess after 10 minutes."
    },
    {
      "id": "brn_no",
      "label": "No",
      "action": "Continue monitoring. Recheck BP every 15 minutes."
    }
  ]
}
```

**Fields:**

- `condition` (required, string) — The question or criterion
- `branches` (required, array, min 2) — Possible outcomes
  - `id` (required, string)
  - `label` (required, string) — Short label (e.g., "Yes", "No", ">38°C")
  - `action` (required, string) — What to do if this branch is taken

### 4.6 `dosage_table` — Structured medication data

Fixed columns in MVP. Custom columns in v2.

```json
{
  "id": "blk_05",
  "type": "dosage_table",
  "title": "First-line medications",
  "columns": ["drug", "dose", "route", "frequency", "notes"],
  "rows": [
    {
      "id": "row_01",
      "drug": "Epinephrine",
      "dose": "0.3 mg (0.3 mL of 1:1000)",
      "route": "IM (lateral thigh)",
      "frequency": "Every 5-15 min PRN",
      "notes": "Maximum 3 doses"
    }
  ]
}
```

**Fields:**

- `title` (optional, string)
- `columns` (required, array, fixed in MVP) — Must be exactly `["drug", "dose", "route", "frequency", "notes"]`
- `rows` (required, array, min 1)
  - `id` (required, string)
  - `drug`, `dose`, `route`, `frequency`, `notes` (required, string) — All columns must be present per row

### 4.7 `alert` — Warning or critical callout

```json
{
  "id": "blk_06",
  "type": "alert",
  "severity": "warning",
  "title": "Contraindications",
  "content": "Do NOT administer if patient has known hypersensitivity to beta-agonists or severe cardiovascular disease."
}
```

**Fields:**

- `severity` (required, enum) — One of `info`, `warning`, `danger`, `success`
- `title` (optional, string)
- `content` (required, string) — Plain text (no Markdown) to keep rendering consistent

## 5. Template Schema

The template schema is stored in `ProtocolTemplate.schema` as JSONB. It defines the suggested starting structure for protocols built from types that reference this template.

### Top-Level Shape

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "emergency_medicine",
    "intended_use": "Time-sensitive acute interventions"
  },
  "blocks": [
    /* sections and/or blocks */
  ]
}
```

### Template-Specific Fields

Templates use the same block catalog as protocol content, with these additional fields available on any block or section:

- **`required`** (optional, boolean, default `false`) — Decided by the **template author**. If `true`, protocols derived from this template (via any type pointing at it) cannot delete this block/section (but can rename and reorder). The system itself imposes no required blocks; everything is authored.
- **`placeholder`** (optional, string) — Hint text shown in the protocol editor when the block is empty.
- **`placeholder_blocks`** (optional, array, sections only) — Pre-seeded child blocks that suggest what should go in a section.

### Required Semantics

When a template author marks a block as `required: true`:

| Action                   | Allowed on Required Block? | Allowed on Optional Block? |
| ------------------------ | :------------------------: | :------------------------: |
| Delete the block         |             ❌             |             ✅             |
| Rename the block (title) |             ✅             |             ✅             |
| Reorder within parent    |             ✅             |             ✅             |
| Change block type        |             ❌             |             ✅             |
| Edit block content       |             ✅             |             ✅             |
| Add sibling blocks       |             ✅             |             ✅             |

**Sections inherit their own `required` flag independent of children.** A required section with no required child blocks means: "this section must exist, but its contents are entirely up to the doctor."

### Template Authoring Flow

Templates are authored in the dedicated template editor at `/ajustes/plantillas/:id/edit`:

1. Author creates a new template (or enters an unlocked existing one)
2. Author builds the structure: sections and child blocks
3. For each block/section, author toggles required / optional
4. Author adds placeholder hints to guide future protocol authors
5. Author saves the template

Because MVP has no template versioning, saving overwrites the current state. Once any type references this template, further edits are rejected until all referencing types are deleted (see `Section 3`).

The template editor UX is specified in detail in `template-editor-ux.md`.

## 6. ProtocolType Schema

The type is the simplest entity in the engine. It has no JSONB content — only scalar fields. The schema lives entirely in the `ProtocolType` table.

### Fields

- `id` (UUID) — primary key
- `tenant_id` (UUID, required) — owning tenant
- `name` (string, required, unique per tenant) — the user-facing category label
- `template_id` (UUID, required, FK → ProtocolTemplate.id) — immutable after creation
- `is_seeded` (boolean, default `false`) — true for the 5 auto-created types on tenant signup
- `created_at`, `updated_at`, `deleted_at` — standard audit fields

### Constraints

- `(tenant_id, name)` uniqueness: a tenant cannot have two types with the same name.
- `template_id` must belong to the same tenant (cross-tenant references are rejected).
- `template_id` is immutable after row creation (enforced in the service layer).

### The Five Seeded Types

On tenant creation, after the five starter templates are seeded, five types are created pointing at them:

| Type name     | References template        |
| ------------- | -------------------------- |
| Emergencia    | Intervención de emergencia |
| Procedimiento | Procedimiento clínico      |
| Medicación    | Referencia farmacológica   |
| Diagnóstico   | Algoritmo diagnóstico      |
| Fisioterapia  | Sesión de fisioterapia     |

Both the templates and the types carry `is_seeded: true`. The doctor can rename, delete, or supplement either the templates or the types — the seed creates them but does not privilege them afterward.

### Doctor-Visible Copy

Throughout the UI, types are referred to as **"tipos de protocolo"** (or simply **"tipos"** in context). The word **"plantilla"** (template) appears only in the template editor and the template management page under `/ajustes/plantillas`. In the protocol creation flow, the protocol list, and the protocol editor, doctors see types and never see the template beneath them.

## 7. Protocol Content Schema

The protocol content schema is stored in `ProtocolVersion.content` as JSONB. It represents a specific protocol that a doctor has filled in, following the structure of the template behind its type.

### Top-Level Shape

```json
{
  "version": "1.0",
  "template_version": "1.0",
  "blocks": [
    /* actual filled-in blocks and sections */
  ]
}
```

### Differences from Template Schema

- No `required` field — this only lives on the template. The protocol just _is_ what it is at the moment.
- No `placeholder` or `placeholder_blocks` — these are template-only authoring aids.
- Every block contains actual content, not suggestions.

### Linking Back to the Template (via the Type)

Every protocol references its type via `Protocol.type_id`. The type references its template via `ProtocolType.template_id`. The API resolves `protocol → type → template` when the editor needs to know about required blocks. This allows:

- Showing the template's required-block rules in the editor (so doctors can't delete locked blocks)
- Filtering protocols by type on the list page
- Generating reports of "all protocols of type X" or "all protocols using template Y" (the latter requires joining through types)

### No Blank Protocols

A protocol cannot be created without a type. There is no "blank protocol" escape hatch. Doctors who want a minimal starting structure create a type pointing at a minimal template.

## 8. Worked Example

### Example Template: Emergency Intervention

This lives in `ProtocolTemplate.schema` for a tenant-owned template named "Intervención de emergencia".

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "emergency_medicine",
    "intended_use": "Acute, time-sensitive interventions"
  },
  "blocks": [
    {
      "id": "sec_indications",
      "type": "section",
      "title": "Indications",
      "required": true,
      "placeholder_blocks": [
        { "type": "text", "placeholder": "When should this protocol be activated?" }
      ]
    },
    {
      "id": "sec_contraindications",
      "type": "section",
      "title": "Contraindications",
      "required": false,
      "placeholder_blocks": [
        { "type": "alert", "severity": "danger", "placeholder": "Document contraindications here" }
      ]
    },
    {
      "id": "sec_assessment",
      "type": "section",
      "title": "Initial Assessment",
      "required": true,
      "placeholder_blocks": [{ "type": "checklist", "placeholder": "Pre-intervention checklist" }]
    },
    {
      "id": "sec_intervention",
      "type": "section",
      "title": "Intervention",
      "required": true,
      "placeholder_blocks": [
        {
          "id": "blk_int_meds",
          "type": "dosage_table",
          "required": true,
          "placeholder": "First-line medications"
        },
        { "type": "steps", "placeholder": "Numbered action steps" }
      ]
    },
    {
      "id": "sec_monitoring",
      "type": "section",
      "title": "Post-intervention Monitoring",
      "required": false,
      "placeholder_blocks": [{ "type": "text", "placeholder": "What to monitor, for how long" }]
    },
    {
      "id": "sec_escalation",
      "type": "section",
      "title": "Escalation Criteria",
      "required": false,
      "placeholder_blocks": [{ "type": "decision", "placeholder": "When to escalate care?" }]
    }
  ]
}
```

Note how the template author made deliberate choices:

- **Required:** Indications, Initial Assessment, Intervention (section), and a Dosage Table inside it
- **Optional:** Contraindications, Monitoring, Escalation
- The author decided a dosage table _specifically_ must exist for this template (e.g. because emergency protocols without meds don't make sense for this use case)

### Example Type Pointing at It

```
ProtocolType {
  id: "type_uuid_1",
  tenant_id: "tenant_uuid",
  name: "Emergencia",
  template_id: "template_uuid_emergency_intervention",
  is_seeded: true
}
```

This is one of the five types auto-created on tenant signup.

### Example Protocol (Filled): Anaphylaxis

The doctor clicks "Nuevo protocolo", picks the type **"Emergencia"**, and names the protocol "Manejo de anafilaxia". The server resolves the type to its template, copies the template's `placeholder_blocks` into the initial content, and creates version 1. The doctor then edits the content. After several saves, the current version looks like this:

```json
{
  "version": "1.0",
  "template_version": "1.0",
  "blocks": [
    {
      "id": "sec_indications",
      "type": "section",
      "title": "Indications",
      "blocks": [
        {
          "id": "blk_ind_01",
          "type": "text",
          "content": "Acute allergic reaction with respiratory or cardiovascular compromise. Signs include urticaria, angioedema, stridor, wheezing, or hypotension."
        }
      ]
    },
    {
      "id": "sec_assessment",
      "type": "section",
      "title": "Initial Assessment",
      "blocks": [
        {
          "id": "blk_asm_01",
          "type": "checklist",
          "title": "Primary survey",
          "items": [
            { "id": "itm_01", "text": "Airway patency", "critical": true },
            { "id": "itm_02", "text": "Breathing effort and rate", "critical": true },
            { "id": "itm_03", "text": "Circulation: pulse, BP", "critical": true },
            { "id": "itm_04", "text": "Level of consciousness", "critical": false }
          ]
        }
      ]
    },
    {
      "id": "sec_intervention",
      "type": "section",
      "title": "Intervention",
      "blocks": [
        {
          "id": "blk_int_01",
          "type": "alert",
          "severity": "warning",
          "title": "Act fast",
          "content": "Epinephrine should be given within 5 minutes of symptom onset for best outcomes."
        },
        {
          "id": "blk_int_meds",
          "type": "dosage_table",
          "title": "First-line medications",
          "columns": ["drug", "dose", "route", "frequency", "notes"],
          "rows": [
            {
              "id": "row_01",
              "drug": "Epinephrine",
              "dose": "0.3 mg IM (0.3 mL 1:1000)",
              "route": "IM lateral thigh",
              "frequency": "Every 5-15 min PRN",
              "notes": "Max 3 doses"
            },
            {
              "id": "row_02",
              "drug": "Diphenhydramine",
              "dose": "25-50 mg",
              "route": "IV or IM",
              "frequency": "Once",
              "notes": "Adjunct only"
            }
          ]
        },
        {
          "id": "blk_int_03",
          "type": "steps",
          "title": "Supportive care",
          "steps": [
            {
              "id": "stp_01",
              "order": 1,
              "title": "Establish IV access",
              "detail": "Large-bore preferred"
            },
            {
              "id": "stp_02",
              "order": 2,
              "title": "High-flow oxygen",
              "detail": "15L non-rebreather"
            },
            {
              "id": "stp_03",
              "order": 3,
              "title": "Monitor continuously",
              "detail": "Cardiac monitor, pulse ox, BP q5min"
            }
          ]
        }
      ]
    }
  ]
}
```

Required blocks from the template (Indications, Initial Assessment, Intervention, Dosage Table within Intervention) are all present. Optional blocks (Contraindications, Monitoring, Escalation) are absent because the doctor chose not to populate them.

### Lock Consequences

While this protocol (and the type "Emergencia") exists:

- The type "Emergencia" can be renamed but not deleted.
- The template "Intervención de emergencia" cannot be edited or deleted — the type "Emergencia" holds it locked.
- The doctor wishing to edit that template would need to: delete this protocol (and any other protocols of type "Emergencia"), delete the type "Emergencia", edit the template, recreate the type, and recreate the protocols. In practice, most doctors will simply live with the seeded template or customize it before creating any protocols.

## 9. Validation Rules

The backend must enforce these rules on every save.

### Structural (templates and protocols)

1. Every block has a unique `id` within the document.
2. Every block has a valid `type` from the enum (`section`, `text`, `checklist`, `steps`, `decision`, `dosage_table`, `alert`).
3. Sections cannot contain other sections (1-level nesting cap).
4. Only sections can have a `blocks` array.

### Tenant & Reference Integrity

5. A `ProtocolType.template_id` must reference a template in the same tenant.
6. A `Protocol.type_id` must reference a type in the same tenant.
7. `ProtocolType.template_id` is immutable after creation (rejected at the service layer).

### Lock Enforcement

8. Template edit/delete is rejected if any non-deleted `ProtocolType` references it.
9. Type delete is rejected if any non-deleted `Protocol` references it.
10. Type rename is allowed regardless of lock state.

### Required-Block Enforcement (when protocol derives from a template via its type)

11. Every block/section the template marked as `required: true` must be present in the protocol content (by ID).
12. Required blocks cannot have their `type` changed.
13. Required blocks can be renamed and reordered, but not deleted.

### Block-Type-Specific

14. `text.content` is valid Markdown, sanitized (no HTML, no scripts).
15. `checklist.items` has at least 1 item.
16. `steps.steps` has at least 1 step with positive integer `order`.
17. `decision.branches` has at least 2 branches.
18. `dosage_table.columns` matches the fixed MVP column set exactly.
19. `dosage_table.rows` — every row has all required column fields.
20. `alert.severity` is one of the 4 valid values.

### Cross-Cutting

21. Every `id` referenced from a parent matches the child's actual `id`.
22. JSON must match the schema version (use the top-level `version` to route migrations).

## 10. Versioning & Migration

### Schema Versioning

Every template and protocol JSON includes a top-level `version` field (e.g. `"1.0"`). When the schema evolves:

- Increment the version
- Write a migration function that accepts the old version and outputs the new version
- Run migrations lazily on read, or as a batch job

Example scenarios requiring version bumps:

- Adding a new block type
- Changing a required-field structure
- Changing allowed enum values

### Protocol Version History

Every edit to a protocol creates a new `ProtocolVersion` row with full content. This is separate from schema versioning — it's clinical audit history. See the ERD for the `ProtocolVersion` entity.

### Template Versioning

**Not in MVP.** MVP templates are overwritten in place when edited (and only when no type references them — see `Section 3`). Future template versioning would relax the total lock and let authors edit templates non-destructively while existing protocols pin to the older template state. Until that lands, total lock is the compensating control.

## 11. MVP vs Future Scope

### MVP

| Feature                                                                         | In MVP? |
| ------------------------------------------------------------------------------- | ------- |
| 6 block types (text, checklist, steps, decision, dosage_table, alert) + section | ✅      |
| Tenant-owned templates                                                          | ✅      |
| Template editor (flat block list, required toggles, placeholder hints)          | ✅      |
| 5 starter templates seeded into tenant on signup                                | ✅      |
| `ProtocolType` layer (CRUD)                                                     | ✅      |
| 5 default types auto-created on signup                                          | ✅      |
| Onboarding flow gating protocol creation on types existing                      | ✅      |
| Required/optional block flagging by template author                             | ✅      |
| Fixed dosage table columns                                                      | ✅      |
| 2-level nesting cap                                                             | ✅      |
| Protocol versioning (every save creates a new `ProtocolVersion`)                | ✅      |
| Total template lock when any type references it                                 | ✅      |
| Type lock when any protocol references it                                       | ✅      |
| Cross-tenant template/type/protocol sharing                                     | ❌      |
| Template versioning                                                             | ❌ — v2 |
| Metadata/analytics on types                                                     | ❌ — v2 |

### v2

- **Template versioning** — non-destructive template edits, with existing protocols pinned to the version they were created against
- **Type metadata** — tags, default location, default specialty, analytics hooks
- **Custom dosage table columns** — add pediatric dose columns, etc.
- **Nested decision blocks** — for complex algorithms
- **Rich media blocks** — embedded images, diagrams
- **Calculator blocks** — BMI, GFR, pediatric dosing
- **Cross-reference blocks** — link to other protocols
- **Attachment blocks** — link to documents, PDFs
- **Approval workflows** — multi-signer protocol approval for clinics

### v3+

- **Shared template library** — cross-tenant template discovery and forking
- **Live protocol mode** — launch a protocol during a consultation, check off items in real time
- **Outcome tracking** — link protocol usage to patient outcomes for analytics
- **AI-assisted authoring** — suggest blocks based on specialty and indication
