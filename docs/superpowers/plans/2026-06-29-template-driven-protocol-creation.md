# Template-driven Protocol Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make creating a protocol mean picking a template — the new protocol copies the template's block structure, records `template_id`, and inherits the template's (now required) category.

**Architecture:** Add a required `category_id` to `ProtocolTemplate` and a nullable, informational `template_id` to `Protocol` (schema + backfilling migration). Thread category through the templates module and editor. Replace the protocol-creation modal's category cards with template cards (name + category pill). On the API, `POST /v1/protocols` takes `{ templateId, title }`, loads the template, transforms its schema into protocol content via a pure tested function, and sets `categoryId = template.categoryId`. Block category deletion when templates reference the category. Reduce seed data to 2 categories + 2 linked templates.

**Tech Stack:** PostgreSQL + Prisma, NestJS, Zod (`@rezeta/shared`), React 18 + Vite + TanStack Query, Vitest.

## Global Constraints

- Indentation: 2 spaces. DB columns/tables `snake_case` (via Prisma `@map`); TypeScript `camelCase`.
- UUID primary keys; soft deletes (`deleted_at`) everywhere these models already use them.
- Repository layer always filters by `tenant_id`.
- Spanish for user-facing strings; English for code/specs. No hardcoded user-facing strings in components — add to the colocated `strings` modules.
- Every color/spacing/radius/type token must reference `index.css` tokens via Tailwind classes (`text-n-700`, `bg-p-500`, `rounded-sm`, etc.). No raw hex/px in component code.
- No `TODO`/`FIXME`/`HACK`/`XXX` comments (ESLint `no-warning-comments` fails CI).
- `pnpm lint` clean, `pnpm test` green, ≥90% coverage (statements/branches/functions/lines) on changed packages.
- Prepend a `CHANGELOG.md` entry at the end (date `[2026-06-29]`).
- Source of truth for the model: `specs/updated-specs/02-protocol-model.md`. Design: `docs/superpowers/specs/2026-06-29-template-driven-protocol-creation-design.md`.

Commands: `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm lint:fix` · `pnpm dev`. Per-package test example: `pnpm --filter @rezeta/api test -- <path>`.

---

### Task 1: Schema + backfilling migration (DB)

Adds the two new columns and the relations. The migration is hand-edited so `protocol_templates.category_id` is added nullable, backfilled, *then* set `NOT NULL` — existing rows are preserved.

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`ProtocolTemplate` 408-429, `Protocol` 431-462, `ProtocolCategory` 538-558)
- Create: `packages/db/prisma/migrations/<generated>_template_category_link/migration.sql`

**Interfaces:**
- Produces: Prisma client with `ProtocolTemplate.categoryId: string`, `ProtocolTemplate.category` relation, `ProtocolTemplate.protocols` back-relation; `Protocol.templateId: string | null`, `Protocol.template` relation; `ProtocolCategory.templates` back-relation.

- [ ] **Step 1: Edit `schema.prisma` — `ProtocolTemplate`**

Add the category field/relation, a back-relation to protocols, and an index. Insert `categoryId` after `suggestedSpecialty`, add relations in the relation block, add the index:

```prisma
model ProtocolTemplate {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId           String    @map("tenant_id") @db.Uuid
  templateKey        String?   @map("template_key") @db.VarChar(100)
  name               String    @db.VarChar(300)
  description        String?   @db.Text
  suggestedSpecialty String?   @map("suggested_specialty") @db.VarChar(100)
  categoryId         String    @map("category_id") @db.Uuid
  isSystem           Boolean   @default(false) @map("is_system")
  schema             Json
  isSeeded           Boolean   @default(false) @map("is_seeded")
  createdBy          String?   @map("created_by") @db.Uuid
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")

  tenant    Tenant           @relation(fields: [tenantId], references: [id])
  creator   User?            @relation(fields: [createdBy], references: [id])
  category  ProtocolCategory @relation(fields: [categoryId], references: [id])
  protocols Protocol[]

  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@index([categoryId])
  @@map("protocol_templates")
}
```

- [ ] **Step 2: Edit `schema.prisma` — `Protocol`**

Add `templateId` after `categoryId` and the relation in the relation block:

```prisma
  categoryId       String?   @map("category_id") @db.Uuid
  templateId       String?   @map("template_id") @db.Uuid
```

```prisma
  category    ProtocolCategory?    @relation(fields: [categoryId], references: [id])
  template    ProtocolTemplate?    @relation(fields: [templateId], references: [id])
```

- [ ] **Step 3: Edit `schema.prisma` — `ProtocolCategory`**

Add a back-relation to templates in the relation block (after `protocols`):

```prisma
  tenant     Tenant             @relation(fields: [tenantId], references: [id])
  protocols  Protocol[]
  templates  ProtocolTemplate[]
```

- [ ] **Step 4: Generate the migration WITHOUT applying it**

Run: `pnpm --filter @rezeta/db exec prisma migrate dev --name template_category_link --create-only`
Expected: a new folder under `packages/db/prisma/migrations/` containing `migration.sql`. It will contain a naive `ADD COLUMN "category_id" UUID NOT NULL` — we replace that next.

- [ ] **Step 5: Hand-edit the generated `migration.sql`**

Replace its entire contents with this ordered, backfilling version (keep the generated folder name):

```sql
-- Protocol.template_id (nullable, informational)
ALTER TABLE "protocols" ADD COLUMN "template_id" UUID;
ALTER TABLE "protocols"
  ADD CONSTRAINT "protocols_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "protocol_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ProtocolTemplate.category_id — add nullable first
ALTER TABLE "protocol_templates" ADD COLUMN "category_id" UUID;

-- Defensive: ensure every tenant that owns templates has at least one category.
INSERT INTO "protocol_categories" ("id", "tenant_id", "name", "color", "is_seeded", "created_at", "updated_at")
SELECT gen_random_uuid(), t."tenant_id", 'Emergencias', '#EF4444', true, now(), now()
FROM (SELECT DISTINCT "tenant_id" FROM "protocol_templates") t
WHERE NOT EXISTS (
  SELECT 1 FROM "protocol_categories" c
  WHERE c."tenant_id" = t."tenant_id" AND c."deleted_at" IS NULL
);

-- Backfill: each template -> its tenant's earliest-created live category.
UPDATE "protocol_templates" pt
SET "category_id" = sub."category_id"
FROM (
  SELECT DISTINCT ON (c."tenant_id") c."tenant_id", c."id" AS "category_id"
  FROM "protocol_categories" c
  WHERE c."deleted_at" IS NULL
  ORDER BY c."tenant_id", c."created_at" ASC
) sub
WHERE pt."tenant_id" = sub."tenant_id";

-- Enforce NOT NULL + FK now that every row has a value.
ALTER TABLE "protocol_templates" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "protocol_templates"
  ADD CONSTRAINT "protocol_templates_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "protocol_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "protocol_templates_category_id_idx" ON "protocol_templates"("category_id");
```

- [ ] **Step 6: Apply the migration and regenerate the client**

Run: `pnpm --filter @rezeta/db exec prisma migrate dev`
Expected: "Already in sync" / applies the edited migration cleanly; Prisma client regenerated. If a shadow-DB drift error appears, confirm the SQL matches the schema edits above.

- [ ] **Step 7: Typecheck the DB package**

Run: `pnpm --filter @rezeta/db typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): link templates to categories, add protocol.template_id"
```

---

### Task 2: Shared schemas + error code

**Files:**
- Modify: `packages/shared/src/errors.ts:59-62`
- Modify: `packages/shared/src/schemas/protocol.ts` (266-269, 298-308, 324-335)
- Test: `packages/shared/src/schemas/__tests__/protocol.test.ts` (create if absent; otherwise append)

**Interfaces:**
- Produces: `CreateProtocolSchema = { templateId: string(uuid); title: string }`; `CreateProtocolTemplateDto` gains required `categoryId: string`; `UpdateProtocolTemplateDto` gains optional `categoryId?: string`; `ProtocolTemplateDto` gains `categoryId: string` and `category: { id: string; name: string; color: string }`; `ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES`.

- [ ] **Step 1: Write failing tests**

Append to `packages/shared/src/schemas/__tests__/protocol.test.ts` (create with these imports if the file does not exist):

```ts
import { describe, it, expect } from 'vitest'
import {
  CreateProtocolSchema,
  CreateProtocolTemplateSchema,
  ProtocolTemplateDtoSchema,
} from '../protocol.js'
import { ErrorCode } from '../../errors.js'

describe('CreateProtocolSchema (template-driven)', () => {
  it('requires templateId and title', () => {
    const ok = CreateProtocolSchema.safeParse({
      templateId: '11111111-1111-1111-1111-111111111111',
      title: 'Mi protocolo',
    })
    expect(ok.success).toBe(true)
  })
  it('rejects when templateId is missing', () => {
    expect(CreateProtocolSchema.safeParse({ title: 'X' }).success).toBe(false)
  })
})

describe('CreateProtocolTemplateSchema requires categoryId', () => {
  it('rejects without categoryId', () => {
    expect(
      CreateProtocolTemplateSchema.safeParse({ name: 'T', schema: { version: '1.0', blocks: [] } })
        .success,
    ).toBe(false)
  })
  it('accepts with categoryId', () => {
    expect(
      CreateProtocolTemplateSchema.safeParse({
        name: 'T',
        categoryId: '22222222-2222-2222-2222-222222222222',
        schema: { version: '1.0', blocks: [] },
      }).success,
    ).toBe(true)
  })
})

describe('ProtocolTemplateDtoSchema embeds category', () => {
  it('parses categoryId + category', () => {
    const dto = {
      id: '33333333-3333-3333-3333-333333333333',
      tenantId: '44444444-4444-4444-4444-444444444444',
      name: 'T',
      description: null,
      suggestedSpecialty: null,
      categoryId: '22222222-2222-2222-2222-222222222222',
      category: { id: '22222222-2222-2222-2222-222222222222', name: 'Emergencias', color: '#EF4444' },
      schema: { version: '1.0', blocks: [] },
      isSeeded: true,
      isLocked: false,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }
    expect(ProtocolTemplateDtoSchema.safeParse(dto).success).toBe(true)
  })
})

describe('ErrorCode', () => {
  it('has CATEGORY_IN_USE_BY_TEMPLATES', () => {
    expect(ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES).toBe('CATEGORY_IN_USE_BY_TEMPLATES')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/shared test -- protocol.test`
Expected: FAIL (schemas not yet updated / error code missing).

- [ ] **Step 3: Add the error code**

In `packages/shared/src/errors.ts`, under the `── Protocol Category ──` block (after line 62) add:

```ts
  CATEGORY_IN_USE_BY_TEMPLATES: 'CATEGORY_IN_USE_BY_TEMPLATES',
```

- [ ] **Step 4: Update the schemas**

In `packages/shared/src/schemas/protocol.ts`:

Replace `CreateProtocolSchema` (266-269):

```ts
export const CreateProtocolSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(2).max(300),
})
```

Replace `CreateProtocolTemplateSchema` (298-302):

```ts
export const CreateProtocolTemplateSchema = z.object({
  name: z.string().min(1).max(300),
  categoryId: z.string().uuid(),
  suggestedSpecialty: z.string().max(200).optional(),
  schema: ProtocolTemplateSchemaContent,
})
```

Replace `UpdateProtocolTemplateSchema` (304-308):

```ts
export const UpdateProtocolTemplateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  categoryId: z.string().uuid().optional(),
  suggestedSpecialty: z.string().max(200).nullable().optional(),
  schema: ProtocolTemplateSchemaContent.optional(),
})
```

In `ProtocolTemplateDtoSchema` (324-335), add after `suggestedSpecialty`:

```ts
  categoryId: z.string().uuid(),
  category: z.object({ id: z.string().uuid(), name: z.string(), color: z.string() }),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/shared test -- protocol.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): template requires categoryId, protocol create takes templateId"
```

---

### Task 3: `buildProtocolContentFromTemplate` transform (API, pure function)

The riskiest unit. Converts a template `schema` into valid protocol `content`: rename nested `placeholder_blocks` → `blocks`, strip template-only hints (`required`, `placeholder`, `description`, top-level `metadata`), and give every block a unique `id`. Output MUST pass `ProtocolContentSchema`.

**Files:**
- Create: `apps/api/src/modules/protocols/template-to-content.ts`
- Test: `apps/api/src/modules/protocols/__tests__/template-to-content.test.ts`

**Interfaces:**
- Produces: `buildProtocolContentFromTemplate(schema: unknown): { version: string; template_version: string; blocks: unknown[] }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { ProtocolContentSchema } from '@rezeta/shared'
import { buildProtocolContentFromTemplate } from '../template-to-content.js'
import { getStarterFixtures } from '../../../lib/starter-fixtures/index.js'

describe('buildProtocolContentFromTemplate', () => {
  it('produces content that passes ProtocolContentSchema for every seed template (es + en)', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const fixture of getStarterFixtures(locale)) {
        const content = buildProtocolContentFromTemplate(fixture.schema)
        const parsed = ProtocolContentSchema.safeParse(content)
        expect(parsed.success, `${locale}/${fixture.name}: ${JSON.stringify(parsed)}`).toBe(true)
      }
    }
  })

  it('renames placeholder_blocks to blocks recursively', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [
        { id: 'sec', type: 'section', title: 'S', required: true, placeholder_blocks: [
          { type: 'text', placeholder: 'hint' },
        ] },
      ],
    })
    const section = (out.blocks as Array<Record<string, unknown>>)[0]
    expect(section).not.toHaveProperty('placeholder_blocks')
    expect(section).not.toHaveProperty('required')
    expect(Array.isArray(section.blocks)).toBe(true)
  })

  it('strips placeholder/required/description hints from leaf blocks', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [{ type: 'text', placeholder: 'hint', required: true, description: 'd' }],
    })
    const block = (out.blocks as Array<Record<string, unknown>>)[0]
    expect(block).not.toHaveProperty('placeholder')
    expect(block).not.toHaveProperty('required')
    expect(block).not.toHaveProperty('description')
  })

  it('assigns a unique id to every block, generating ids where absent', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [
        { type: 'text', placeholder: 'a' },
        { id: 'sec', type: 'section', placeholder_blocks: [{ type: 'text' }, { type: 'text' }] },
      ],
    })
    const ids: string[] = []
    const walk = (blocks: Array<Record<string, unknown>>): void => {
      for (const b of blocks) {
        expect(typeof b.id).toBe('string')
        expect((b.id as string).length).toBeGreaterThan(0)
        ids.push(b.id as string)
        if (Array.isArray(b.blocks)) walk(b.blocks as Array<Record<string, unknown>>)
      }
    }
    walk(out.blocks as Array<Record<string, unknown>>)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries template_version from schema.version, defaulting to 1.0', () => {
    expect(buildProtocolContentFromTemplate({ version: '2.3', blocks: [] }).template_version).toBe('2.3')
    expect(buildProtocolContentFromTemplate({ blocks: [] }).template_version).toBe('1.0')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- template-to-content`
Expected: FAIL ("buildProtocolContentFromTemplate is not a function").

- [ ] **Step 3: Read `ProtocolBlockSchema`**

Read `packages/shared/src/schemas/protocol.ts` (the `ProtocolBlockSchema` definition and the block-type variants it unions). Note the required fields per block type — your empty blocks must include them (e.g. `clinical_notes.content`, `vitals.values`, `checklist.items`, `dosage_table.columns/rows`, etc.). The first test pins this: output must parse.

- [ ] **Step 4: Implement the transform**

```ts
// Template-only hint fields that must NOT appear in protocol content.
const HINT_FIELDS = new Set(['required', 'placeholder', 'description', 'placeholder_blocks'])

interface RawBlock {
  id?: string
  type: string
  placeholder_blocks?: RawBlock[]
  blocks?: RawBlock[]
  [key: string]: unknown
}

interface BuiltContent {
  version: string
  template_version: string
  blocks: unknown[]
}

/**
 * Converts a ProtocolTemplate.schema into an initial ProtocolVersion.content:
 * renames nested `placeholder_blocks` -> `blocks`, drops template-only hints,
 * ensures every block has a unique id, and initializes empty value fields so the
 * result satisfies ProtocolContentSchema.
 */
export function buildProtocolContentFromTemplate(schema: unknown): BuiltContent {
  const root = (schema ?? {}) as { version?: string; blocks?: RawBlock[] }
  const counter = { n: 0 }
  return {
    version: '1.0',
    template_version: typeof root.version === 'string' ? root.version : '1.0',
    blocks: (root.blocks ?? []).map((b) => transformBlock(b, counter)),
  }
}

function transformBlock(block: RawBlock, counter: { n: number }): Record<string, unknown> {
  const children = block.placeholder_blocks ?? block.blocks
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(block)) {
    if (HINT_FIELDS.has(key) || key === 'blocks') continue
    out[key] = value
  }
  out.id = typeof block.id === 'string' && block.id.length > 0 ? block.id : nextId(block.type, counter)
  initEmptyValueFields(out)
  if (block.type === 'section') {
    out.blocks = (children ?? []).map((c) => transformBlock(c, counter))
  }
  return out
}

function nextId(type: string, counter: { n: number }): string {
  counter.n += 1
  return `blk_${type}_${counter.n}`
}

// Initialize the value-bearing field each block type requires for ProtocolContentSchema.
function initEmptyValueFields(block: Record<string, unknown>): void {
  switch (block.type) {
    case 'clinical_notes':
      if (typeof block.content !== 'string') block.content = ''
      break
    case 'text':
      if (typeof block.content !== 'string') block.content = ''
      break
    case 'alert':
      if (typeof block.content !== 'string') block.content = ''
      if (typeof block.severity !== 'string') block.severity = 'info'
      break
    case 'vitals':
      if (!Array.isArray(block.fields)) block.fields = []
      break
    case 'checklist':
      if (!Array.isArray(block.items)) block.items = []
      break
    case 'steps':
      if (!Array.isArray(block.steps)) block.steps = []
      break
    case 'decision':
      if (typeof block.condition !== 'string') block.condition = ''
      if (!Array.isArray(block.branches)) block.branches = []
      break
    case 'dosage_table':
      if (!Array.isArray(block.columns)) block.columns = ['drug', 'dose', 'route', 'frequency', 'notes']
      if (!Array.isArray(block.rows)) block.rows = []
      break
    case 'lab_order':
      if (!Array.isArray(block.orders)) block.orders = []
      break
    case 'imaging_order':
      if (!Array.isArray(block.orders)) block.orders = []
      break
    default:
      break
  }
}
```

> Note: adjust `initEmptyValueFields` field names/defaults to whatever `ProtocolBlockSchema` actually requires — the first test (parses against `ProtocolContentSchema`) is the contract. If the schema requires a field not handled here, add it; if a default here is rejected, fix it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- template-to-content`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocols/template-to-content.ts apps/api/src/modules/protocols/__tests__/template-to-content.test.ts
git commit -m "feat(api): add template-to-content transform"
```

---

### Task 4: Templates module — thread category through

**Files:**
- Modify: `apps/api/src/modules/protocol-templates/protocol-templates.repository.ts`
- Modify: `apps/api/src/modules/protocol-templates/protocol-templates.service.ts`
- Test: `apps/api/src/modules/protocol-templates/__tests__/protocol-templates.service.spec.ts` (append; create if absent)

**Interfaces:**
- Consumes: `CreateProtocolTemplateDto.categoryId`, `UpdateProtocolTemplateDto.categoryId` (Task 2).
- Produces: template DTOs include `categoryId` + `category {id,name,color}`; `create` validates the category exists in-tenant (throws `PROTOCOL_CATEGORY_NOT_FOUND`).

- [ ] **Step 1: Write failing tests**

Append service tests (mock the repository) asserting: (a) `create` with an unknown `categoryId` throws `NotFoundException` carrying `ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND`; (b) `toDto` output includes `categoryId` and a `category` object. Follow the existing spec's mocking style in this folder; if no spec exists, model it on `apps/api/src/modules/protocol-categories/__tests__/`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { ProtocolTemplatesService } from '../protocol-templates.service.js'

const repo = {
  findAllWithLockInfo: vi.fn(),
  findById: vi.fn(),
  findCategory: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

const baseTemplate = {
  id: '33333333-3333-3333-3333-333333333333',
  tenantId: '44444444-4444-4444-4444-444444444444',
  name: 'T',
  description: null,
  suggestedSpecialty: null,
  categoryId: '22222222-2222-2222-2222-222222222222',
  category: { id: '22222222-2222-2222-2222-222222222222', name: 'Emergencias', color: '#EF4444' },
  schema: { version: '1.0', blocks: [] },
  isSeeded: false,
  createdAt: new Date('2026-06-29T00:00:00Z'),
  updatedAt: new Date('2026-06-29T00:00:00Z'),
}

describe('ProtocolTemplatesService category', () => {
  let service: ProtocolTemplatesService
  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolTemplatesService(repo as never)
  })

  it('throws when categoryId does not exist in tenant', async () => {
    repo.findCategory.mockResolvedValue(null)
    await expect(
      service.create('44444444-4444-4444-4444-444444444444', {
        name: 'T', categoryId: 'bad', schema: { version: '1.0', blocks: [] },
      } as never, 'user'),
    ).rejects.toMatchObject({ response: { code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND } })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('maps category into the DTO', async () => {
    repo.findCategory.mockResolvedValue(baseTemplate.category)
    repo.create.mockResolvedValue(baseTemplate)
    const dto = await service.create('44444444-4444-4444-4444-444444444444', {
      name: 'T', categoryId: baseTemplate.categoryId, schema: { version: '1.0', blocks: [] },
    } as never, 'user')
    expect(dto.categoryId).toBe(baseTemplate.categoryId)
    expect(dto.category).toEqual(baseTemplate.category)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/api test -- protocol-templates.service`
Expected: FAIL.

- [ ] **Step 3: Update the repository**

In `protocol-templates.repository.ts`: include the category relation on reads, accept `categoryId` on create/update, and add a `findCategory` helper. The returned row type becomes `ProtocolTemplate & { category: ProtocolCategory }` — define a local type and use it.

```ts
import type { ProtocolTemplate, ProtocolCategory } from '@rezeta/db'

export type TemplateWithCategory = ProtocolTemplate & { category: ProtocolCategory }

// findAllWithLockInfo + findById: add `include: { category: true }` and return TemplateWithCategory.
// create:
async create(
  tenantId: string,
  data: { name: string; categoryId: string; suggestedSpecialty?: string | undefined; schema: object },
  createdBy: string,
): Promise<TemplateWithCategory> {
  return this.prisma.protocolTemplate.create({
    data: {
      tenantId,
      name: data.name,
      categoryId: data.categoryId,
      suggestedSpecialty: data.suggestedSpecialty ?? null,
      schema: data.schema,
      isSeeded: false,
      createdBy,
    },
    include: { category: true },
  }) as Promise<TemplateWithCategory>
}

// update: add `...(data.categoryId !== undefined && { categoryId: data.categoryId })` and `include: { category: true }`.

// new helper:
async findCategory(id: string, tenantId: string): Promise<ProtocolCategory | null> {
  return this.prisma.protocolCategory.findFirst({ where: { id, tenantId, deletedAt: null } })
}
```

- [ ] **Step 4: Update the service**

In `protocol-templates.service.ts`: import the new type; map `categoryId` + `category` in `toDto`; validate the category in `create` and (when provided) in `update`.

```ts
private toDto(t: TemplateWithCategory): ProtocolTemplateDto {
  return {
    id: t.id,
    tenantId: t.tenantId,
    name: t.name,
    description: t.description,
    suggestedSpecialty: t.suggestedSpecialty,
    categoryId: t.categoryId,
    category: { id: t.category.id, name: t.category.name, color: t.category.color },
    schema: t.schema,
    isSeeded: t.isSeeded,
    isLocked: false,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

async create(tenantId: string, dto: CreateProtocolTemplateDto, userId: string): Promise<ProtocolTemplateDto> {
  const category = await this.repo.findCategory(dto.categoryId, tenantId)
  if (!category) {
    throw new NotFoundException({ code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND, message: 'Category not found' })
  }
  const t = await this.repo.create(tenantId, dto, userId)
  return this.toDto(t)
}
```

In `update`, when `dto.categoryId` is provided, run the same `findCategory` guard before `this.repo.update`.

- [ ] **Step 5: Run to verify pass + typecheck**

Run: `pnpm --filter @rezeta/api test -- protocol-templates.service`
Expected: PASS.
Run: `pnpm --filter @rezeta/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocol-templates
git commit -m "feat(api): templates carry a required category"
```

---

### Task 5: Protocols module — create from template

**Files:**
- Modify: `apps/api/src/modules/protocols/protocols.service.ts:23-45`
- Modify: `apps/api/src/modules/protocols/protocols.repository.ts` (the `create` method)
- Test: `apps/api/src/modules/protocols/__tests__/protocols.service.spec.ts` (append; create if absent)

**Interfaces:**
- Consumes: `CreateProtocolDto = { templateId, title }` (Task 2); `buildProtocolContentFromTemplate` (Task 3).
- Produces: `ProtocolsService.create` loads the template, sets `content`, `templateId`, and `categoryId = template.categoryId`; throws `PROTOCOL_TEMPLATE_NOT_FOUND` for an unknown/foreign template. `ProtocolsRepository.create` accepts `templateId`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@rezeta/shared'
import { ProtocolsService } from '../protocols.service.js'

const repository = {
  findTemplateForCreate: vi.fn(),
  create: vi.fn(),
}

describe('ProtocolsService.create from template', () => {
  let service: ProtocolsService
  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolsService(repository as never)
  })

  it('throws PROTOCOL_TEMPLATE_NOT_FOUND when template is missing', async () => {
    repository.findTemplateForCreate.mockResolvedValue(null)
    await expect(
      service.create('t', 'u', { templateId: 'missing', title: 'New' } as never),
    ).rejects.toMatchObject({ response: { code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND } })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('copies template blocks into content and inherits categoryId + templateId', async () => {
    repository.findTemplateForCreate.mockResolvedValue({
      id: 'tmpl-1',
      categoryId: 'cat-1',
      schema: { version: '1.0', blocks: [{ id: 's', type: 'section', placeholder_blocks: [] }] },
    })
    repository.create.mockResolvedValue({
      protocol: {
        id: 'p1', title: 'New', status: 'draft', isFavorite: false,
        createdAt: new Date(), updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Emergencias' },
      },
      version: { id: 'v1', versionNumber: 1, content: {}, changeSummary: null, createdAt: new Date() },
    })
    await service.create('t', 'u', { templateId: 'tmpl-1', title: 'New' } as never)
    const arg = repository.create.mock.calls[0][0]
    expect(arg.templateId).toBe('tmpl-1')
    expect(arg.categoryId).toBe('cat-1')
    expect((arg.content as { blocks: unknown[] }).blocks).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/api test -- protocols.service`
Expected: FAIL.

- [ ] **Step 3: Update the service `create`**

Replace `protocols.service.ts:23-45` with:

```ts
async create(
  tenantId: string,
  userId: string,
  dto: CreateProtocolDto,
): Promise<ProtocolResponse> {
  const template = await this.repository.findTemplateForCreate(dto.templateId, tenantId)
  if (!template) {
    throw new NotFoundException({
      code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND,
      message: 'Template not found',
    })
  }

  const content = buildProtocolContentFromTemplate(template.schema)

  const createResult = await this.repository.create({
    tenantId,
    title: dto.title.trim(),
    createdBy: userId,
    templateId: template.id,
    categoryId: template.categoryId,
    tags: [],
    content,
  })
  const { protocol, version } = createResult

  return this.formatResponse({
    ...protocol,
    currentVersion: version,
    category: protocol.category,
  })
}
```

Add the import at the top of the file:

```ts
import { buildProtocolContentFromTemplate } from './template-to-content.js'
```

- [ ] **Step 4: Update the repository**

In `protocols.repository.ts`: add a `findTemplateForCreate` method and accept `templateId` in `create`'s input type + `protocol.create` data.

```ts
async findTemplateForCreate(
  templateId: string,
  tenantId: string,
): Promise<{ id: string; categoryId: string; schema: unknown } | null> {
  const t = await this.prisma.protocolTemplate.findFirst({
    where: { id: templateId, tenantId, deletedAt: null },
    select: { id: true, categoryId: true, schema: true },
  })
  return t
}
```

In `create`'s `data` param type add `templateId?: string`, and in the `tx.protocol.create({ data: {...} })` add:

```ts
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
```

- [ ] **Step 5: Run to verify pass + typecheck**

Run: `pnpm --filter @rezeta/api test -- protocols.service`
Expected: PASS.
Run: `pnpm --filter @rezeta/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocols
git commit -m "feat(api): create protocols from a template, inheriting its category"
```

---

### Task 6: Categories module — block deletion when templates reference it

**Files:**
- Modify: `apps/api/src/modules/protocol-categories/protocol-categories.repository.ts` (add a count helper)
- Modify: `apps/api/src/modules/protocol-categories/protocol-categories.service.ts:41-50`
- Test: `apps/api/src/modules/protocol-categories/__tests__/protocol-categories.service.spec.ts` (append)

**Interfaces:**
- Produces: `ProtocolCategoriesService.delete` throws `ConflictException` carrying `ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES` and `details.count` when ≥1 active template references the category.

- [ ] **Step 1: Write failing test**

```ts
it('blocks deletion when active templates reference the category', async () => {
  repo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
  repo.countTemplates.mockResolvedValue(2)
  await expect(service.delete('tenant', 'cat-1')).rejects.toMatchObject({
    response: { code: ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES, details: { count: 2 } },
  })
  expect(repo.softDelete).not.toHaveBeenCalled()
})

it('deletes when no templates reference the category', async () => {
  repo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
  repo.countTemplates.mockResolvedValue(0)
  repo.softDelete.mockResolvedValue({ id: 'cat-1' })
  await expect(service.delete('tenant', 'cat-1')).resolves.toEqual({ id: 'cat-1' })
})
```

(Ensure the test's `repo` mock includes `countTemplates: vi.fn()`.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/api test -- protocol-categories.service`
Expected: FAIL.

- [ ] **Step 3: Add the repository count helper**

In `protocol-categories.repository.ts`:

```ts
async countTemplates(categoryId: string, tenantId: string): Promise<number> {
  return this.prisma.protocolTemplate.count({
    where: { categoryId, tenantId, deletedAt: null },
  })
}
```

- [ ] **Step 4: Add the guard in the service**

In `protocol-categories.service.ts`, import `ConflictException` from `@nestjs/common`, and update `delete` (after the `isSeeded` check, before `softDelete`):

```ts
const count = await this.repo.countTemplates(id, tenantId)
if (count > 0) {
  throw new ConflictException({
    code: ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES,
    message: 'Category is in use by templates',
    details: { count },
  })
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @rezeta/api test -- protocol-categories.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocol-categories
git commit -m "feat(api): block category deletion while templates reference it"
```

---

### Task 7: Seeding — 2 categories + 2 linked templates

**Files:**
- Modify: `apps/api/src/lib/starter-fixtures/index.ts`
- Modify: `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`
- Test: `apps/api/src/lib/starter-fixtures/__tests__/index.test.ts` (create) + update any existing `tenant-seeding` spec

**Interfaces:**
- Consumes: nothing new.
- Produces: `getStarterFixtures(locale)` returns exactly 2 fixtures, each with a `categoryName` matching a seeded category; `seedDefault` creates 2 categories first, then 2 templates each with the mapped `categoryId`; `seedCustom` assigns each custom template the tenant's first category.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { getStarterFixtures } from '../index.js'

describe('starter fixtures (2 templates)', () => {
  for (const locale of ['es', 'en'] as const) {
    it(`${locale}: has exactly 2 fixtures each naming a category`, () => {
      const fixtures = getStarterFixtures(locale)
      expect(fixtures).toHaveLength(2)
      for (const f of fixtures) {
        expect(typeof f.categoryName).toBe('string')
        expect(f.categoryName.length).toBeGreaterThan(0)
      }
    })
  }
  it('es maps emergency->Emergencias, diagnostic->Diagnóstico', () => {
    const byKey = Object.fromEntries(getStarterFixtures('es').map((f) => [f.key, f.categoryName]))
    expect(byKey.emergency).toBe('Emergencias')
    expect(byKey.diagnostic).toBe('Diagnóstico')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/api test -- starter-fixtures`
Expected: FAIL.

- [ ] **Step 3: Edit `starter-fixtures/index.ts`**

- Replace the `TemplateFixture` interface: drop `typeName`, add `categoryName`:

```ts
export interface TemplateFixture {
  key: string
  name: string
  suggestedSpecialty: string
  intendedUse: string
  schema: object
  /** Name of the seeded category this template belongs to */
  categoryName: string
}
```

- In `esFixtures`, keep only the `emergency` and `diagnostic` entries; delete `procedure`, `pharmacology`, `physiotherapy`. On the kept entries, replace `typeName: '…'` with `categoryName: 'Emergencias'` (emergency) and `categoryName: 'Diagnóstico'` (diagnostic).
- In `enFixtures`, keep only `emergency` and `diagnostic`; set `categoryName: 'Emergencies'` and `categoryName: 'Diagnosis'`.

- [ ] **Step 4: Edit `tenant-seeding.service.ts`**

- Reduce `SEEDED_CATEGORIES` to two per locale:

```ts
const SEEDED_CATEGORIES: Record<'es' | 'en', { name: string; color: string }[]> = {
  es: [
    { name: 'Emergencias', color: '#EF4444' },
    { name: 'Diagnóstico', color: '#3B82F6' },
  ],
  en: [
    { name: 'Emergencies', color: '#EF4444' },
    { name: 'Diagnosis', color: '#3B82F6' },
  ],
}
```

- In `seedDefault`'s transaction, create categories FIRST and capture their ids, then create templates with the mapped category:

```ts
// Seed protocol categories first so templates can link to them.
const categories = await Promise.all(
  SEEDED_CATEGORIES[locale].map((c) =>
    tx.protocolCategory.create({
      data: { tenantId, name: c.name, color: c.color, isSeeded: true },
    }),
  ),
)
const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

await Promise.all(
  fixtures.map((f) => {
    const categoryId = categoryIdByName.get(f.categoryName)
    if (!categoryId) {
      throw new Error(`Seed fixture "${f.name}" references unknown category "${f.categoryName}"`)
    }
    return tx.protocolTemplate.create({
      data: {
        tenantId,
        name: f.name,
        categoryId,
        suggestedSpecialty: f.suggestedSpecialty,
        schema: f.schema,
        isSeeded: true,
      },
    })
  }),
)
```

Remove the old `createMany` categories block and the `void createdTemplates` line. Update the method's doc comment (was "5 starter templates and 5 default protocol categories" → "2 starter templates and 2 default protocol categories").

- In `seedCustom`'s transaction, every custom template now needs a category. Before inserting templates, create one seed category and use its id:

```ts
const [defaultCategory] = await Promise.all([
  tx.protocolCategory.create({
    data: { tenantId, name: 'Diagnóstico', color: '#3B82F6', isSeeded: true },
  }),
])
// ...then in each tx.protocolTemplate.create data, add: categoryId: defaultCategory.id,
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @rezeta/api test -- starter-fixtures`
Expected: PASS.
Run: `pnpm --filter @rezeta/api test -- tenant-seeding` (fix any now-stale "5 templates/5 categories" assertions to expect 2/2)
Expected: PASS.
Run: `pnpm --filter @rezeta/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/starter-fixtures apps/api/src/modules/tenant-seeding
git commit -m "feat(api): seed 2 categories + 2 category-linked templates"
```

---

### Task 8: Template editor — required category select + list pill

**Files:**
- Modify: `apps/web/src/hooks/protocol-templates/use-protocol-templates.ts`
- Modify: `apps/web/src/pages/settings/TemplateEditor.tsx`
- Modify: `apps/web/src/pages/settings/Templates.tsx`
- Test: `apps/web/src/pages/settings/__tests__/TemplateEditor.test.tsx` (create or append)

**Interfaces:**
- Consumes: `useProtocolCategories` (`apps/web/src/hooks/protocol-categories/use-protocol-categories.ts`), `ProtocolTemplateDto.categoryId`/`category` (Task 2).
- Produces: create/update template payloads include `categoryId`; save disabled until a category is chosen.

- [ ] **Step 1: Write failing component test**

Render `TemplateEditorNew` inside the app's test providers (QueryClientProvider + MemoryRouter — copy the pattern from a sibling test under `apps/web/src/pages/settings/__tests__/`). Assert: the category `<select>`/combobox renders with options from a mocked `useProtocolCategories`; the save button is disabled until a category is selected; selecting one and submitting calls the create mutation with `categoryId`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- TemplateEditor`
Expected: FAIL.

- [ ] **Step 3: Update the hook types**

In `use-protocol-templates.ts`, extend the create/update mutation input types to include `categoryId` (required on create, optional on update) so callers pass it through. If the hook uses `CreateProtocolTemplateDto`/`UpdateProtocolTemplateDto` from `@rezeta/shared`, no change is needed beyond Task 2 — verify the create form provides `categoryId`.

- [ ] **Step 4: Add the category select to `TemplateEditor.tsx`**

In both `TemplateEditorNew` and `TemplateEditor`: call `useProtocolCategories()`, add a required category `<Select>` (use the existing UI `Select` from `@/components/ui`; options = categories with a color chip + name), store `categoryId` in form state (prefill from the loaded template in edit mode), gate the save button on a chosen category, and include `categoryId` in the `mutateAsync` payload. Add any new labels to the page's colocated strings module (Spanish).

- [ ] **Step 5: Add the category pill column to `Templates.tsx`**

Add a "Categoría" column rendering a pill: a colored dot (`style={{ backgroundColor: t.category.color }}`) + `t.category.name`, matching the chip style already used in `TemplatePickerModal`'s `CategoryCard`.

- [ ] **Step 6: Run tests + lint + typecheck**

Run: `pnpm --filter @rezeta/web test -- TemplateEditor`
Expected: PASS.
Run: `pnpm --filter @rezeta/web typecheck && pnpm --filter @rezeta/web lint`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/settings apps/web/src/hooks/protocol-templates
git commit -m "feat(web): template editor requires a category; list shows category pill"
```

---

### Task 9: Protocol-creation modal — pick a template

**Files:**
- Modify: `apps/web/src/components/protocols/TemplatePickerModal.tsx`
- Modify: `apps/web/src/components/protocols/strings.ts` (the `blockEditorStrings` source)
- Modify: `apps/web/src/hooks/protocols/use-protocols.ts` (create mutation input type → `{ templateId, title }`)
- Test: `apps/web/src/components/protocols/__tests__/TemplatePickerModal.test.tsx` (create or append)

**Interfaces:**
- Consumes: `useProtocolTemplates` (returns `ProtocolTemplateDto[]` with `category {name,color}`); `CreateProtocolDto = { templateId, title }`.
- Produces: modal lists templates as cards (name + category pill); submit posts `{ templateId, title }`; navigates to `/protocolos/{id}/edit`.

- [ ] **Step 1: Write failing test**

Render `TemplatePickerModal` (open) with a mocked `useProtocolTemplates` returning 2 templates each with a `category`. Assert: a card per template shows the template name and its category name; there is NO "Desde cero" card; selecting a template + typing a ≥2-char title enables the submit button; clicking submit calls the create mutation with `{ templateId, title }`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- TemplatePickerModal`
Expected: FAIL.

- [ ] **Step 3: Add new strings**

In the strings module backing `blockEditorStrings`, add template-oriented copy (Spanish), e.g.:

```ts
templatePickerTitle: 'Nuevo protocolo',
templatePickerSubtitle: 'Elige una plantilla para empezar',
templatePickerEmpty: 'Aún no tienes plantillas. Crea una primero.',
templatePickerEmptyCta: 'Crear plantilla',
templatePickerNameLabel: 'Nombre del protocolo',
templatePickerNamePlaceholder: 'Ej. Manejo de hipertensión',
```

Keep reusing existing `typePickerCancel`/`typePickerSubmit`/`typePickerCreating` if present, or add `templatePicker*` equivalents. Do not leave unused string keys behind (lint/coverage).

- [ ] **Step 4: Rewrite the modal**

Replace category sourcing with `useProtocolTemplates()`. Render a `TemplateCard` (name + category pill using `template.category.color`/`.name`). Remove `scratchMode`, `handleSelectScratch`, the "Desde cero" `SelectableCard`, and the category-specific empty state. Track `selectedTemplateId`. `canSubmit = !!selectedTemplateId && title.trim().length >= 2 && !isPending`. On submit:

```ts
const dto = { templateId: selectedTemplateId, title: title.trim() }
createProtocol(dto, { onSuccess: (data) => { handleClose(); void navigate(`/protocolos/${data.id}/edit`) } })
```

Empty state (no templates): message + `Link` to `/ajustes/plantillas/new`.

- [ ] **Step 5: Update `use-protocols.ts`**

Ensure `useCreateProtocol`'s `mutationFn` is typed `(dto: CreateProtocolDto) => ...` (now `{ templateId, title }`) — it imports `CreateProtocolDto` from `@rezeta/shared`, so it tracks Task 2 automatically. Verify no other caller still passes `categoryId`.

- [ ] **Step 6: Run tests + lint + typecheck**

Run: `pnpm --filter @rezeta/web test -- TemplatePickerModal`
Expected: PASS.
Run: `pnpm --filter @rezeta/web typecheck && pnpm --filter @rezeta/web lint`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/protocols apps/web/src/hooks/protocols
git commit -m "feat(web): protocol creation picks a template (name + category pill)"
```

---

### Task 10: Category-delete modal in settings

**Files:**
- Modify: the categories settings page (find via `useDeleteProtocolCategory` usage, likely `apps/web/src/pages/settings/Categories.tsx` or `Tipos.tsx`)
- Test: the page's test file (create or append)

**Interfaces:**
- Consumes: `useDeleteProtocolCategory`; the API error `{ code: 'CATEGORY_IN_USE_BY_TEMPLATES', details: { count } }`.
- Produces: on that error, a modal explaining the block; no deletion proceeds.

- [ ] **Step 1: Locate the page**

Run: `grep -rl "useDeleteProtocolCategory" apps/web/src`
Open the matching page to see how delete + errors are currently surfaced (toast vs modal).

- [ ] **Step 2: Write failing test**

Simulate delete rejecting with `{ response: { data: { code: 'CATEGORY_IN_USE_BY_TEMPLATES', details: { count: 2 } } } }` (match the app's error shape — check `apiClient`), and assert a modal with the explanatory Spanish message renders and the category is not removed from the list.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- <PageName>`
Expected: FAIL.

- [ ] **Step 4: Implement**

In the delete handler's `onError`, detect `code === 'CATEGORY_IN_USE_BY_TEMPLATES'` and open a `Modal` (from `@/components/ui`) with title + body using a new Spanish string, e.g.: `"No puedes eliminar esta categoría: {count} plantilla(s) la usan. Reasígnalas a otra categoría antes de eliminarla."` Fall back to the existing error toast for any other error. Add the string to the page's colocated strings.

- [ ] **Step 5: Run tests + lint + typecheck**

Run: `pnpm --filter @rezeta/web test -- <PageName> && pnpm --filter @rezeta/web typecheck && pnpm --filter @rezeta/web lint`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/settings
git commit -m "feat(web): explain blocked category deletion when templates use it"
```

---

### Task 11: Full verification + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full lint**

Run: `pnpm lint`
Expected: zero errors/warnings. Fix any (`pnpm lint:fix` for autofixable).

- [ ] **Step 2: Full test + coverage**

Run: `pnpm test` then `pnpm test:coverage`
Expected: green; ≥90% statements/branches/functions/lines on changed packages. Add focused tests for any uncovered new branch (e.g. `update` category guard in Task 4, `seedCustom` category path in Task 7).

- [ ] **Step 3: Full build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Prepend changelog entry**

Prepend to `CHANGELOG.md`:

```markdown
## [2026-06-29] Template-driven protocol creation

### Added
- `ProtocolTemplate.category_id` (required) and `Protocol.template_id` (informational) with a backfilling migration.
- `buildProtocolContentFromTemplate` transform seeding new protocols from a template's block structure.
- Category `<Select>` in the template editor; category pill column in the templates list.
- Blocked category deletion (`CATEGORY_IN_USE_BY_TEMPLATES`) with an explanatory modal when templates reference the category.

### Changed
- Creating a protocol now requires choosing a template; the protocol inherits the template's category. `POST /v1/protocols` takes `{ templateId, title }` (was `{ categoryId?, title }`).
- `TemplatePickerModal` now lists templates (name + category pill); the "Desde cero" path was removed.
- Tenant seeding now creates 2 categories (Emergencias, Diagnóstico) and 2 category-linked templates (Intervención de emergencia, Algoritmo diagnóstico).
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): template-driven protocol creation"
```

---

## Self-Review notes

- **Spec coverage:** §3 schema → Task 1; §4 shared/error → Task 2; §5.4 transform → Task 3; §5.1 templates → Task 4; §5.3 protocol create → Task 5; §5.2 category guard → Task 6; §7 seeding → Task 7; §6.1 editor → Task 8; §6.2 modal → Task 9; §6.3 delete modal → Task 10; §10 gates → Task 11. All sections covered.
- **Migration safety:** add-nullable → backfill → set-NOT-NULL with a defensive category-creation guard (design §3, §11).
- **Type consistency:** `buildProtocolContentFromTemplate`, `findTemplateForCreate`, `findCategory`, `countTemplates` are referenced by the same names in their producing and consuming tasks.
- **Open detail deferred to a test contract:** exact empty-block fields in Task 3 are pinned by "output parses `ProtocolContentSchema`", not guessed — read the schema in Step 3.
