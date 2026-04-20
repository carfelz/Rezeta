# Protocol Template Schema

> Living document. Last updated: April 2026.
>
> This document specifies the structure of protocol templates and protocol content in the Medical ERP's protocol engine.

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Core Concepts](#2-core-concepts)
3. [Block Type Catalog](#3-block-type-catalog)
4. [Template Schema](#4-template-schema)
5. [Protocol Content Schema](#5-protocol-content-schema)
6. [Worked Example](#6-worked-example)
7. [Validation Rules](#7-validation-rules)
8. [Versioning & Migration](#8-versioning--migration)
9. [MVP vs Future Scope](#9-mvp-vs-future-scope)

---

## 1. Design Principles

The schema is shaped by four guiding principles:

1. **Templates suggest, doctors decide.** Templates provide a starting structure but do not constrain what doctors can add, remove, or reorder (except for blocks the template creator explicitly marks as required).
2. **Template creators control rigidity.** The template author decides — per block and per section — whether each element is required or optional in resulting protocols. The system enforces no defaults.
3. **Two-level nesting only.** Sections contain blocks; blocks do not contain sections. This covers 95% of real protocols while keeping UX and data model simple.
4. **JSON-native, PostgreSQL-friendly.** All schemas stored as JSONB, searchable via GIN indexes, renderable without complex joins.

## 2. Core Concepts

### Template vs Protocol vs Version

| Concept      | Description                                                                                        | DB Entity          |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------ |
| **Template** | A reusable structure (schema + metadata) that defines how a class of protocols should be organized | `ProtocolTemplate` |
| **Protocol** | An instance of a template, representing a specific clinical procedure                              | `Protocol`         |
| **Version**  | An immutable snapshot of protocol content at a point in time                                       | `ProtocolVersion`  |

### Block vs Section

- A **section** is a container that groups related blocks under a heading
- A **block** is a leaf content unit (text, checklist, steps, decision, dosage table, alert)
- Sections can contain blocks; blocks cannot contain sections or other blocks

### ID Conventions

All elements use prefixed short IDs for readability and stability:

| Prefix | Meaning                        | Example            |
| ------ | ------------------------------ | ------------------ |
| `sec_` | Section                        | `sec_assessment`   |
| `blk_` | Block (any non-section type)   | `blk_checklist_01` |
| `stp_` | Step inside a steps block      | `stp_01`           |
| `itm_` | Item inside a checklist        | `itm_03`           |
| `row_` | Row inside a dosage table      | `row_02`           |
| `brn_` | Branch inside a decision block | `brn_yes`          |

IDs must be unique within a protocol (not globally).

## 3. Block Type Catalog

### 3.1 `section` — Container

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

### 3.2 `text` — Rich paragraph

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

### 3.3 `checklist` — Unordered items to verify

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

### 3.4 `steps` — Numbered sequential actions

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

### 3.5 `decision` — If/then/else branching

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

### 3.6 `dosage_table` — Structured medication data

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

### 3.7 `alert` — Warning or critical callout

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

## 4. Template Schema

The template schema is stored in `ProtocolTemplate.schema` as JSONB. It defines the suggested starting structure for protocols using that template.

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

- **`required`** (optional, boolean, default `false`) — Decided by the **template creator**. If `true`, protocols derived from this template cannot delete this block/section (but can rename and reorder). The system itself imposes no required blocks; everything is authored.
- **`placeholder`** (optional, string) — Hint text shown in the editor when the block is empty
- **`placeholder_blocks`** (optional, array, sections only) — Pre-seeded child blocks that suggest what should go in a section

### Required Semantics

When a template creator marks a block as `required: true`:

| Action                   | Allowed on Required Block? | Allowed on Optional Block? |
| ------------------------ | :------------------------: | :------------------------: |
| Delete the block         |             ❌             |             ✅             |
| Rename the block (title) |             ✅             |             ✅             |
| Reorder within parent    |             ✅             |             ✅             |
| Change block type        |             ❌             |             ✅             |
| Edit block content       |             ✅             |             ✅             |
| Add sibling blocks       |             ✅             |             ✅             |

**Sections inherit their own `required` flag independent of children.** A required section with no required child blocks means: "this section must exist, but its contents are entirely up to the doctor."

### Template Editor UX Implications

When building a template, the creator sees each block with a toggle:

```
[ Section: Initial Assessment ]  [ Required ✓ ]
  ├── [ Checklist: Primary survey ]  [ Required ✓ ]
  └── [ Text: Additional notes ]  [ Required ✗ ]
```

Required status is a per-block author decision, visible at a glance, and editable when the template creator is authoring or revising the template.

### Template Authoring Flow

1. Creator picks "New Template" or forks an existing one
2. Creator builds the structure: sections and placeholder blocks
3. For each block/section, creator marks required or optional
4. Creator adds placeholder content/hints to guide future protocol authors
5. Creator saves and publishes the template (private or shared)

## 5. Protocol Content Schema

The protocol content schema is stored in `ProtocolVersion.content` as JSONB. It represents a specific protocol that a doctor has filled in based on a template (or created from scratch).

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

### Linking Back to the Template

Every protocol references its template via `Protocol.template_id`. This allows:

- Showing the template's required-block rules in the editor (so doctors can't delete locked blocks)
- Detecting when a template has been updated and prompting review
- Generating reports of "all protocols using template X"

### Creation from a Template

When a protocol is instantiated from a template, the initial content contains the minimum structure required to be structurally valid and compliant with the template's required-block rules. Specifically:

Required sections (template marks required: true) are copied by ID, title, and description.
Required blocks within required sections are instantiated with minimum valid content for their type (empty strings, one empty item for collections, two empty branches for decisions). The template-defined id is preserved.
Optional sections and optional placeholder_blocks are NOT seeded. They become available as editor palette suggestions, not as initial content.
Template hints (placeholder strings, suggested severities) are surfaced to the editor via the template metadata carried with the protocol response, never by embedding them into content.

This rule ensures every newly-created protocol is immediately valid per Section 7 (Validation Rules) while preserving the template's structural intent.

## 6. Worked Example

### Example Template: Emergency Intervention Checklist

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

Note how the template creator made deliberate choices:

- **Required:** Indications, Initial Assessment, Intervention (section), and a Dosage Table inside it
- **Optional:** Contraindications, Monitoring, Escalation
- The author decided a dosage table _specifically_ must exist for this template (e.g. because emergency protocols without meds don't make sense for this use case)

### Example Protocol (Filled): Anaphylaxis

Derived from the template above. Note the required blocks remain; optional ones may be present, modified, or absent:

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

## 7. Validation Rules

The backend must enforce these rules on every protocol save:

### Structural

1. Every block has a unique `id` within the protocol.
2. Every block has a valid `type` from the enum (`section`, `text`, `checklist`, `steps`, `decision`, `dosage_table`, `alert`).
3. Sections cannot contain other sections (1-level nesting cap).
4. Only sections can have a `blocks` array.

### Required-Block Enforcement (when protocol derives from template)

5. Every block/section the template marked as `required: true` must be present in the protocol content (by ID).
6. Required blocks cannot have their `type` changed.
7. Required blocks can be renamed and reordered, but not deleted.

### Block-Type-Specific

8. `text.content` is valid Markdown, sanitized (no HTML, no scripts).
9. `checklist.items` has at least 1 item.
10. `steps.steps` has at least 1 step with positive integer `order`.
11. `decision.branches` has at least 2 branches.
12. `dosage_table.columns` matches the fixed MVP column set exactly.
13. `dosage_table.rows` — every row has all required column fields.
14. `alert.severity` is one of the 4 valid values.

### Cross-Cutting

15. Every `id` referenced from a parent matches the child's actual `id`.
16. JSON must match the schema version (use the top-level `version` to route migrations).

## 8. Versioning & Migration

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

### Template Updates

When a template is updated:

- Existing protocols based on that template are **not** automatically migrated
- The system flags affected protocols for review (shows a "template updated" badge)
- Doctors can opt in to adopting new required blocks from the updated template

## 9. MVP vs Future Scope

### MVP

| Feature                                                                         | In MVP?                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| 6 block types (text, checklist, steps, decision, dosage_table, alert) + section | ✅                                           |
| Template creation by doctors and admins                                         | ❌ — pre-built templates only                |
| Required/optional block flagging by template creator                            | ⚠️ — only used by pre-built templates in MVP |
| Fixed dosage table columns                                                      | ✅                                           |
| 2-level nesting cap                                                             | ✅                                           |
| Protocol versioning                                                             | ✅                                           |
| Template versioning                                                             | ✅                                           |
| Cross-tenant template/protocol sharing                                          | ❌                                           |

### v2

- **Custom template creation** — doctors and admins build templates from scratch
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
