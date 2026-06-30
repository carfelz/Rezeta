# Template-driven protocol creation — Design

> Status: APPROVED-PENDING-REVIEW · Date: 2026-06-29 · Author: Carlos Feliz (with Claude)
> Implements the missing template-selection step of the 2-layer protocol model.
> Source of truth for the protocol model: `specs/updated-specs/02-protocol-model.md`.

## 1. Problem

The spec (`specs/updated-specs/02-protocol-model.md` §2, §3.3) defines a two-layer model where
creating a protocol means **picking a template** whose block structure is copied into the new
protocol's first version. This was never implemented:

- `Protocol` has **no `template_id`** column.
- The "template picker" modal (`apps/web/src/components/protocols/TemplatePickerModal.tsx`) actually
  picks a **category**, not a template, and seeds the protocol with **empty blocks** (`blocks: []`).
- `ProtocolTemplate` has **no category** linkage.

## 2. Decisions (locked)

1. **A template belongs to exactly one category — required.** `ProtocolTemplate.category_id` is
   `NOT NULL`. The template editor forces a category selection before save.
2. **Creating a protocol = picking one template — mandatory.** No blank/"Desde cero" path. The new
   protocol:
   - copies the template's block structure into `ProtocolVersion.content` (version 1),
   - records `Protocol.template_id` (informational only, per spec — not enforced, not locked),
   - **inherits `category_id` from the chosen template** (category is no longer selected directly at
     protocol-creation time).
3. **Deleting a category referenced by any active template is blocked.** The doctor must reassign
   those templates to another category first. A modal explains this. (Category→Protocol behavior is
   unchanged: deleting a category still nulls `Protocol.category_id`.)
4. **Creation modal card** = template name + a category pill (the template's category color + name).
5. **Seed data is reduced to 2 categories + 2 templates** (see §8).

## 3. Data model changes

`packages/db/prisma/schema.prisma`:

```prisma
model ProtocolTemplate {
  // ...existing fields...
  categoryId String @map("category_id") @db.Uuid   // NEW — required
  category   ProtocolCategory @relation(fields: [categoryId], references: [id])  // NEW
  protocols  Protocol[]                              // NEW — informational back-reference
  @@index([categoryId])                              // NEW
}

model Protocol {
  // ...existing fields...
  templateId String?           @map("template_id") @db.Uuid  // NEW — nullable, informational
  template   ProtocolTemplate? @relation(fields: [templateId], references: [id])  // NEW
}

model ProtocolCategory {
  // ...existing fields...
  templates ProtocolTemplate[]  // NEW — back-relation
}
```

### Migration (single migration, ordered)

1. `ALTER TABLE protocols ADD COLUMN template_id uuid NULL` + FK to `protocol_templates(id)`.
2. `ALTER TABLE protocol_templates ADD COLUMN category_id uuid NULL`.
3. **Backfill** every existing template's `category_id`:
   - For each tenant, set `category_id` to that tenant's **earliest-created** `ProtocolCategory`
     (`MIN(created_at)`, excluding soft-deleted). This is deterministic and guarantees a value.
   - Guard: if a tenant somehow has templates but **zero** categories, the migration creates the two
     seed categories (Emergencias, Diagnóstico) for that tenant first, then backfills. (Defensive —
     should not occur, since seeding always creates categories.)
4. `ALTER TABLE protocol_templates ALTER COLUMN category_id SET NOT NULL` + FK to
   `protocol_categories(id)` + index `(category_id)`.

## 4. Shared schemas & error codes

`packages/shared/src/schemas/protocol.ts`:

- `CreateProtocolTemplateSchema`: add `categoryId: z.string().uuid()` (required).
- `UpdateProtocolTemplateSchema`: add `categoryId: z.string().uuid().optional()`.
- `ProtocolTemplateDto` (response): add `categoryId: string` and embedded
  `category: { id: string; name: string; color: string }` — the modal needs name + color for the pill.
- `CreateProtocolSchema`: **remove** `categoryId`; **add** `templateId: z.string().uuid()` (required).
  Result: `{ templateId, title }`.

`packages/shared/src/errors.ts`: add `CATEGORY_IN_USE_BY_TEMPLATES`.

## 5. Backend

### 5.1 Templates module (`apps/api/src/modules/protocol-templates/`)
- Repository `create`/`update`: thread `categoryId` through.
- Repository `list`/`get`: `include: { category: true }`; `toDto` maps `categoryId` + `category`.
- Service `create`: validate the category exists in the tenant (404/400 otherwise) before insert.

### 5.2 Categories module (`apps/api/src/modules/protocol-categories/`)
- Service `delete`: before soft-delete, count active (`deletedAt: null`) templates with this
  `categoryId`. If `> 0`, throw a `BadRequest`/conflict carrying `CATEGORY_IN_USE_BY_TEMPLATES` and
  the count.

### 5.3 Protocols module (`apps/api/src/modules/protocols/`)
- `protocols.service.create(tenantId, userId, { templateId, title })`:
  1. Load the template tenant-scoped (`deletedAt: null`); 404 if missing.
  2. `content = buildProtocolContentFromTemplate(template.schema)` (see §5.4).
  3. Create protocol with `templateId` and `categoryId = template.categoryId`; create version 1 with
     `content`.
- Repository `create`: accept and persist `templateId` (already accepts `categoryId`).

### 5.4 Template → content transform (the tricky unit) — `buildProtocolContentFromTemplate`
A pure, well-tested function (own file, e.g. `apps/api/src/modules/protocols/template-to-content.ts`).
Converts a template `schema` into valid protocol `content`:

- Output shape: `{ version: '1.0', template_version: <schema.version ?? '1.0'>, blocks: [...] }`.
- Recursively walk blocks. For each block:
  - **Rename** `placeholder_blocks` → `blocks` (templates nest children under `placeholder_blocks`;
    protocol content nests under `blocks`).
  - **Drop** template-only hint fields: `required`, `placeholder`, `description`, and top-level
    `metadata`.
  - **Ensure an `id`**: keep the template block's `id`; if absent, generate a stable unique one
    (e.g. `blk_<type>_<index>`).
  - Keep structural/content fields valid for protocol content per the block catalog
    (`id`, `type`, `title`, `severity`, `collapsed_by_default`, etc.), initialized empty
    (e.g. `clinical_notes.content = ''`, `vitals.values = {}`) where the catalog defines a value field.
- Unit tests cover: nested sections, id generation, hint stripping, every block type in the seed
  templates, and idempotent valid output that the existing protocol-content validator accepts.

## 6. Frontend

### 6.1 Template editor — `apps/web/src/pages/settings/TemplateEditor.tsx`
- Add a **required** category `<Select>` (options from `useProtocolCategories`) to both
  `TemplateEditorNew` and `TemplateEditor`. Disable save until a category is chosen.
- Pass `categoryId` through `useCreateProtocolTemplate` / `useUpdateProtocolTemplate`.
- `Templates.tsx` list: add a category pill column.

### 6.2 Protocol creation modal — `apps/web/src/components/protocols/TemplatePickerModal.tsx`
- Source **templates** from `useProtocolTemplates` (not categories).
- Each card: template `name` + a category pill using `template.category.color` and
  `template.category.name`.
- Remove the "Desde cero" card and `scratchMode`.
- Empty state (no templates): message + link to `/ajustes/plantillas/new`.
- Submit sends `{ templateId, title }`; navigate to `/protocolos/{id}/edit` on success.
- Add the needed Spanish strings to `./strings`.

### 6.3 Category deletion modal — categories settings page
- On delete, catch the `CATEGORY_IN_USE_BY_TEMPLATES` error and show a modal:
  "No puedes eliminar esta categoría: N plantilla(s) la usan. Reasígnalas a otra categoría antes de
  eliminarla." (No deletion proceeds.)

## 7. Seeding — `apps/api/src/modules/tenant-seeding/` + `apps/api/src/lib/starter-fixtures/`

- `SEEDED_CATEGORIES` reduced to **2** per locale:
  - ES: `Emergencias` (#EF4444), `Diagnóstico` (#3B82F6)
  - EN: `Emergencies` (#EF4444), `Diagnosis` (#3B82F6)
- Starter fixtures reduced to **2** per locale: keep `emergency` and `diagnostic`; drop `procedure`,
  `pharmacology`, `physiotherapy`. Add a `categoryName` (or `categoryKey`) field to `TemplateFixture`.
- `seedDefault`: create the 2 categories first, capture their ids, then create each template with the
  mapped `categoryId`. Wrap in the existing transaction. The legacy `typeName` field is removed (dead
  since ProtocolType was removed).

### 8. Seed mapping (confirmed)

| Template (ES / EN)                          | → Category (ES / EN)      |
| ------------------------------------------- | ------------------------- |
| Intervención de emergencia / Emergency Intervention | Emergencias / Emergencies |
| Algoritmo diagnóstico / Diagnostic Algorithm        | Diagnóstico / Diagnosis   |

## 9. Out of scope

- Re-categorizing existing protocols. Existing protocols keep whatever `category_id` they have.
- Template versioning / snapshotting beyond the existing `template_version` string in content.
- Changing the protocol editor's block-editing behavior.

## 10. Quality gates (per CLAUDE.md)

- Tests colocated in `__tests__/`; TDD for `buildProtocolContentFromTemplate` and the category-delete
  guard.
- `pnpm lint` clean (no warning comments), `pnpm test` green, ≥90% coverage on changed packages.
- New `CHANGELOG.md` entry.

## 11. Risks / notes

- **Backfill correctness** for older dev tenants — covered by the earliest-category fallback (§3).
- **Transform fidelity** — the `placeholder_blocks`→`blocks` rename and id generation are the main
  source of subtle bugs; mitigated by exhaustive unit tests against the seed templates.
- **Coverage gate** — reducing fixtures from 5→2 removes code; ensure no now-dead branches drag
  coverage. Remove dead `typeName` handling rather than leave it untested.
