# Protocol API Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-layer (Template → ProtocolType → Protocol) backend with a 2-layer model (Template → Protocol with optional ProtocolCategory tag). Remove all template lock rules. Add block validation for `vitals` and `clinical_notes`. Update tenant seeding to seed 5 categories and 5 updated templates.

**Architecture:** Delete `protocol-types` NestJS module entirely. Create `protocol-categories` module with CRUD. Update `protocols` module to accept `categoryId`. Update `protocol-templates` module to remove lock-rule logic. All changes are behind the existing `/v1/` route prefix.

**Tech Stack:** NestJS + Prisma (`@rezeta/db`) + Zod shared schemas (`@rezeta/shared`), pnpm monorepo

**Prerequisite:** Plan 01 (schema-reset) must be complete — `ProtocolCategory` model and updated shared schemas must exist.

---

## File Map

| Action | File |
|---|---|
| Delete | `apps/api/src/modules/protocol-types/` (entire directory) |
| Create | `apps/api/src/modules/protocol-categories/protocol-categories.module.ts` |
| Create | `apps/api/src/modules/protocol-categories/protocol-categories.controller.ts` |
| Create | `apps/api/src/modules/protocol-categories/protocol-categories.service.ts` |
| Create | `apps/api/src/modules/protocol-categories/protocol-categories.repository.ts` |
| Create | `apps/api/src/modules/protocol-categories/index.ts` |
| Create | `apps/api/src/modules/protocol-categories/__tests__/protocol-categories.service.spec.ts` |
| Modify | `apps/api/src/modules/protocols/protocols.service.ts` |
| Modify | `apps/api/src/modules/protocols/protocols.repository.ts` |
| Modify | `apps/api/src/modules/protocols/protocols.controller.ts` |
| Modify | `apps/api/src/modules/protocol-templates/protocol-templates.service.ts` |
| Modify | `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts` |
| Modify | `apps/api/src/app.module.ts` |

---

## Task 1: Delete protocol-types module

**Files:**
- Delete: `apps/api/src/modules/protocol-types/` (entire directory)

- [ ] **Step 1: Confirm references**

```bash
grep -r "protocol-types\|ProtocolType\|protocolType" apps/api/src --include="*.ts" -l
```

Note all files that reference `ProtocolType`. These will all need to be updated in this and subsequent tasks.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf apps/api/src/modules/protocol-types
```

- [ ] **Step 3: Run typecheck — expect FAIL with known errors**

```bash
pnpm typecheck
```

Expected: Errors about `ProtocolTypesModule` not found, `typeId` references, etc. These are expected — this task only removes the old code; subsequent tasks add the replacements.

---

## Task 2: Create protocol-categories repository

**Files:**
- Create: `apps/api/src/modules/protocol-categories/protocol-categories.repository.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/src/modules/protocol-categories/__tests__/protocol-categories.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { ProtocolCategoriesService } from '../protocol-categories.service.js'
import { ProtocolCategoriesRepository } from '../protocol-categories.repository.js'
import { PrismaService } from '../../../lib/prisma.service.js'

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
}

describe('ProtocolCategoriesService', () => {
  let service: ProtocolCategoriesService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProtocolCategoriesService,
        { provide: ProtocolCategoriesRepository, useValue: mockRepo },
      ],
    }).compile()
    service = module.get(ProtocolCategoriesService)
    jest.clearAllMocks()
  })

  it('findAll delegates to repository', async () => {
    mockRepo.findAll.mockResolvedValue([])
    const result = await service.findAll('tenant-1')
    expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual([])
  })

  it('create returns new category', async () => {
    const created = { id: 'cat-1', tenantId: 'tenant-1', name: 'Emergencias', color: '#EF4444', isSeeded: false }
    mockRepo.create.mockResolvedValue(created)
    const result = await service.create('tenant-1', { name: 'Emergencias', color: '#EF4444' })
    expect(result).toEqual(created)
  })

  it('softDelete throws if category is seeded', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: true })
    await expect(service.delete('tenant-1', 'cat-1')).rejects.toThrow('Cannot delete a seeded category')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (files don't exist yet)

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocol-categories
```

- [ ] **Step 3: Create repository**

```typescript
// apps/api/src/modules/protocol-categories/protocol-categories.repository.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'

@Injectable()
export class ProtocolCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.protocolCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    })
  }

  findById(tenantId: string, id: string) {
    return this.prisma.protocolCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }

  create(tenantId: string, dto: CreateProtocolCategoryDto) {
    return this.prisma.protocolCategory.create({
      data: {
        tenantId,
        name: dto.name,
        color: dto.color ?? '#6B7280',
      },
    })
  }

  update(tenantId: string, id: string, dto: UpdateProtocolCategoryDto) {
    return this.prisma.protocolCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    })
  }

  softDelete(tenantId: string, id: string) {
    return this.prisma.protocolCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
```

- [ ] **Step 4: Create service**

```typescript
// apps/api/src/modules/protocol-categories/protocol-categories.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { ProtocolCategoriesRepository } from './protocol-categories.repository.js'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'

@Injectable()
export class ProtocolCategoriesService {
  constructor(private readonly repo: ProtocolCategoriesRepository) {}

  findAll(tenantId: string) {
    return this.repo.findAll(tenantId)
  }

  async findById(tenantId: string, id: string) {
    const cat = await this.repo.findById(tenantId, id)
    if (!cat) throw new NotFoundException(`Protocol category ${id} not found`)
    return cat
  }

  create(tenantId: string, dto: CreateProtocolCategoryDto) {
    return this.repo.create(tenantId, dto)
  }

  async update(tenantId: string, id: string, dto: UpdateProtocolCategoryDto) {
    await this.findById(tenantId, id)
    return this.repo.update(tenantId, id, dto)
  }

  async delete(tenantId: string, id: string) {
    const cat = await this.repo.findById(tenantId, id)
    if (!cat) throw new NotFoundException(`Protocol category ${id} not found`)
    if (cat.isSeeded) throw new BadRequestException('Cannot delete a seeded category')
    return this.repo.softDelete(tenantId, id)
  }
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocol-categories
```

---

## Task 3: Create protocol-categories controller and module

**Files:**
- Create: `apps/api/src/modules/protocol-categories/protocol-categories.controller.ts`
- Create: `apps/api/src/modules/protocol-categories/protocol-categories.module.ts`
- Create: `apps/api/src/modules/protocol-categories/index.ts`

- [ ] **Step 1: Create controller**

```typescript
// apps/api/src/modules/protocol-categories/protocol-categories.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { TenantId } from '../../common/tenant-id.decorator.js'
import { ProtocolCategoriesService } from './protocol-categories.service.js'
import {
  CreateProtocolCategorySchema,
  UpdateProtocolCategorySchema,
  type CreateProtocolCategoryDto,
  type UpdateProtocolCategoryDto,
} from '@rezeta/shared'

@Controller('v1/protocol-categories')
export class ProtocolCategoriesController {
  constructor(private readonly service: ProtocolCategoriesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId)
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenantId, id)
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateProtocolCategorySchema)) dto: CreateProtocolCategoryDto,
  ) {
    return this.service.create(tenantId, dto)
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProtocolCategorySchema)) dto: UpdateProtocolCategoryDto,
  ) {
    return this.service.update(tenantId, id, dto)
  }

  @Delete(':id')
  delete(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(tenantId, id)
  }
}
```

- [ ] **Step 2: Create module**

```typescript
// apps/api/src/modules/protocol-categories/protocol-categories.module.ts
import { Module } from '@nestjs/common'
import { ProtocolCategoriesController } from './protocol-categories.controller.js'
import { ProtocolCategoriesService } from './protocol-categories.service.js'
import { ProtocolCategoriesRepository } from './protocol-categories.repository.js'

@Module({
  controllers: [ProtocolCategoriesController],
  providers: [ProtocolCategoriesService, ProtocolCategoriesRepository],
  exports: [ProtocolCategoriesService],
})
export class ProtocolCategoriesModule {}
```

```typescript
// apps/api/src/modules/protocol-categories/index.ts
export { ProtocolCategoriesModule } from './protocol-categories.module.js'
export { ProtocolCategoriesService } from './protocol-categories.service.js'
```

- [ ] **Step 3: Register module in app.module.ts**

Open `apps/api/src/app.module.ts`. Add `ProtocolCategoriesModule` to the imports array and remove `ProtocolTypesModule`:

```typescript
import { ProtocolCategoriesModule } from './modules/protocol-categories/index.js'
// Remove: import { ProtocolTypesModule } from './modules/protocol-types/index.js'
```

In the `@Module({ imports: [...] })` array:
- Remove: `ProtocolTypesModule`
- Add: `ProtocolCategoriesModule`

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Fix any remaining type errors. Common: missing `@rezeta/shared` exports for `CreateProtocolCategoryDto` — add them if absent.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/protocol-categories/ apps/api/src/app.module.ts
git commit -m "feat(api): add protocol-categories module, remove protocol-types"
```

---

## Task 4: Update protocols module — replace typeId with categoryId

**Files:**
- Modify: `apps/api/src/modules/protocols/protocols.repository.ts`
- Modify: `apps/api/src/modules/protocols/protocols.service.ts`
- Modify: `apps/api/src/modules/protocols/protocols.controller.ts`
- Modify: `apps/api/src/modules/protocols/__tests__/*.spec.ts`

- [ ] **Step 1: Write failing test**

Add to `apps/api/src/modules/protocols/__tests__/protocols.service.spec.ts` (or update existing):

```typescript
it('creates protocol with categoryId (not typeId)', async () => {
  const mockProtocol = { id: 'proto-1', categoryId: 'cat-1', title: 'Mi protocolo' }
  mockRepo.create.mockResolvedValue(mockProtocol)
  const result = await service.create('tenant-1', 'user-1', {
    categoryId: 'cat-1',
    title: 'Mi protocolo',
  })
  expect(mockRepo.create).toHaveBeenCalledWith(
    'tenant-1',
    'user-1',
    expect.objectContaining({ categoryId: 'cat-1' }),
  )
  expect(result.categoryId).toBe('cat-1')
})

it('list query accepts categoryId filter', async () => {
  mockRepo.findAll.mockResolvedValue([])
  await service.findAll('tenant-1', { categoryId: 'cat-2' })
  expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ categoryId: 'cat-2' }))
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocols.service
```

- [ ] **Step 3: Update repository**

In `protocols.repository.ts`, replace all occurrences of `typeId` with `categoryId`. The Prisma model field is now `categoryId`. Also update the `findAll` where clause:

```typescript
// In findAll query:
where: {
  tenantId,
  deletedAt: null,
  ...(query.categoryId && { categoryId: query.categoryId }),
  ...(query.status && { status: query.status }),
  ...(query.search && {
    title: { contains: query.search, mode: 'insensitive' as const },
  }),
  ...(query.favoritesOnly && { isFavorite: true }),
},
// In create:
data: {
  tenantId,
  categoryId: dto.categoryId,
  title: dto.title,
  createdBy: userId,
},
```

In the return mapper, replace `typeId: row.typeId, typeName: row.type?.name` with `categoryId: row.categoryId, categoryName: row.category?.name`.

Include `category: true` in the Prisma `include` clause instead of `type: true`.

- [ ] **Step 4: Update controller**

In `protocols.controller.ts`, replace any `typeId` query param with `categoryId`:

```typescript
// Remove: @Query('typeId') typeId: string | undefined
// Add:    @Query('categoryId') categoryId: string | undefined
```

Pass `categoryId` (not `typeId`) to `service.findAll(tenantId, { categoryId, ... })`.

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocols
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocols/
git commit -m "feat(api): update protocols module — categoryId replaces typeId"
```

---

## Task 5: Remove template lock rules from protocol-templates module

**Files:**
- Modify: `apps/api/src/modules/protocol-templates/protocol-templates.service.ts`
- Modify: `apps/api/src/modules/protocol-templates/protocol-templates.repository.ts`
- Modify: `apps/api/src/modules/protocol-templates/__tests__/*.spec.ts`

- [ ] **Step 1: Write test asserting no lock checks**

Add to `apps/api/src/modules/protocol-templates/__tests__/protocol-templates.service.spec.ts`:

```typescript
it('update does not throw when template is referenced by protocols', async () => {
  // Previously this would throw "Template is locked" — now it should succeed
  mockRepo.findById.mockResolvedValue({
    id: 'tmpl-1',
    name: 'Old name',
    isSeeded: false,
  })
  mockRepo.update.mockResolvedValue({ id: 'tmpl-1', name: 'New name' })
  // Should NOT throw
  await expect(service.update('tenant-1', 'tmpl-1', { name: 'New name' })).resolves.toBeDefined()
})

it('delete does not throw when template has no active protocols', async () => {
  mockRepo.findById.mockResolvedValue({ id: 'tmpl-1', isSeeded: false })
  mockRepo.softDelete.mockResolvedValue({ id: 'tmpl-1', deletedAt: new Date() })
  await expect(service.delete('tenant-1', 'tmpl-1')).resolves.toBeDefined()
})
```

- [ ] **Step 2: Run — check current behavior**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocol-templates
```

Note which tests fail vs pass before changes.

- [ ] **Step 3: Remove lock-rule logic from service**

In `protocol-templates.service.ts`, remove any code that:
- Queries `ProtocolType` records referencing the template
- Queries `Protocol` records to check if template is "in use"
- Throws `ConflictException` or `ForbiddenException` about template being locked

The `update()` and `delete()` methods should only check:
- Template exists (404 if not)
- Template is not seeded (400 if `isSeeded === true` and caller tries to delete)

Simplified `update`:
```typescript
async update(tenantId: string, id: string, dto: UpdateProtocolTemplateDto) {
  const template = await this.repo.findById(tenantId, id)
  if (!template) throw new NotFoundException(`Template ${id} not found`)
  return this.repo.update(tenantId, id, dto)
}
```

Simplified `delete`:
```typescript
async delete(tenantId: string, id: string) {
  const template = await this.repo.findById(tenantId, id)
  if (!template) throw new NotFoundException(`Template ${id} not found`)
  if (template.isSeeded) throw new BadRequestException('Cannot delete a system template')
  return this.repo.softDelete(tenantId, id)
}
```

Remove the `isLocked` and `blockingTypeIds` fields from the template DTO response mapper — these concepts no longer exist.

- [ ] **Step 4: Remove ProtocolType references from repository**

In `protocol-templates.repository.ts`, remove any `include: { protocolTypes: true }` and related logic. Remove any join queries counting protocols-via-types.

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern protocol-templates
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/protocol-templates/
git commit -m "feat(api): remove template lock rules — templates freely editable"
```

---

## Task 6: Update tenant seeding — 5 categories + 5 updated templates

**Files:**
- Modify: `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`

The seeding runs when a new tenant is created (via onboarding). It must now seed `ProtocolCategory` records (instead of `ProtocolType`) and ensure templates use `vitals` and `clinical_notes` block types.

- [ ] **Step 1: Write test**

Add to `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.service.spec.ts`:

```typescript
it('seeds 5 protocol categories', async () => {
  // After seeding, there should be 5 categories for the tenant
  await service.seedTenant('tenant-new', 'user-new')
  expect(mockPrisma.protocolCategory.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'Emergencias', color: '#EF4444' }),
        expect.objectContaining({ name: 'Diagnóstico', color: '#3B82F6' }),
      ]),
    }),
  )
})

it('does not seed ProtocolType records', async () => {
  await service.seedTenant('tenant-new', 'user-new')
  expect(mockPrisma.protocolType?.create).toBeUndefined()
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern tenant-seeding
```

- [ ] **Step 3: Update seeding service**

Replace all `protocolType.create` calls with `protocolCategory.createMany`:

```typescript
// Seed categories (idempotent via skipDuplicates)
await tx.protocolCategory.createMany({
  skipDuplicates: true,
  data: [
    { tenantId, name: 'Emergencias',    color: '#EF4444', isSeeded: true },
    { tenantId, name: 'Diagnóstico',    color: '#3B82F6', isSeeded: true },
    { tenantId, name: 'Medicación',     color: '#22C55E', isSeeded: true },
    { tenantId, name: 'Procedimiento',  color: '#F59E0B', isSeeded: true },
    { tenantId, name: 'Rehabilitación', color: '#A855F7', isSeeded: true },
  ],
})
```

Update the seeded template schemas to include `vitals` and `clinical_notes` blocks where appropriate. Example — the "Consulta General" template:

```typescript
const consultaGeneralSchema = {
  version: '1.0',
  metadata: { suggested_specialty: 'general' },
  blocks: [
    {
      id: 'blk_vitals',
      type: 'vitals',
      fields: [
        { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
        { id: 'hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
        { id: 'temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
        { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
        { id: 'height', label: 'Talla', unit: 'cm', input_type: 'number' },
      ],
    },
    {
      id: 'blk_motivo',
      type: 'clinical_notes',
      label: 'Motivo de consulta',
      required: true,
      content: '',
    },
    {
      id: 'blk_hea',
      type: 'clinical_notes',
      label: 'Historia de la enfermedad actual',
      required: false,
      content: '',
    },
    {
      id: 'blk_plan',
      type: 'clinical_notes',
      label: 'Plan',
      required: false,
      content: '',
    },
  ],
}
```

Remove any FK references to `ProtocolType` in template seeding. Protocol templates no longer require a `typeId` at creation — category is attached at the Protocol level, not the template level.

Update the 5 seeded templates to use `vitals` + `clinical_notes` block types as appropriate for each specialty:
1. **Consulta General** — vitals + motivo + HEA + plan
2. **Consulta de Emergencia** — vitals + motivo + evaluación + plan + steps for triage
3. **Seguimiento Crónico** — vitals + clinical_notes for evolución + checklist for adherencia
4. **Procedimiento** — steps (preparation, procedure, post-procedure) + clinical_notes for notas
5. **Orden de Estudios** — lab_order + imaging_order blocks

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern tenant-seeding
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tenant-seeding/
git commit -m "feat(api): seed 5 protocol categories, update seeded templates with vitals/clinical_notes blocks"
```

---

## Task 7: Full test run + typecheck

- [ ] **Step 1: Run all API tests**

```bash
pnpm --filter @rezeta/api test
```

Expected: All pass. If failures exist in other modules due to `ProtocolType` references, fix them now:
- Search for `protocol-types` import paths
- Search for `typeId` usage in non-updated files
- Search for `ProtocolTypeDtoSchema` references

```bash
grep -r "protocol-types\|ProtocolType\|typeId\|typeName" apps/api/src --include="*.ts" -l
```

Fix each remaining file.

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(api): resolve all remaining ProtocolType references after protocol model simplification"
```

---

## Self-Review

**Spec coverage check:**
- [x] ProtocolType module removed entirely
- [x] ProtocolCategory CRUD: GET /v1/protocol-categories, POST, PATCH :id, DELETE :id
- [x] Seeded categories: Emergencias, Diagnóstico, Medicación, Procedimiento, Rehabilitación
- [x] Template lock rules removed — templates freely editable
- [x] Protocol creation accepts `categoryId` (not `typeId`)
- [x] Protocol list filterable by `categoryId`
- [x] Seeded templates use `vitals` and `clinical_notes` blocks
- [x] No `isLocked` / `blockingTypeIds` in template responses

**Type consistency:** `categoryId`/`categoryName` used consistently in Protocol responses. `CreateProtocolCategoryDto` exported from `@rezeta/shared`.
