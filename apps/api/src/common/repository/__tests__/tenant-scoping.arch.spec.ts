import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve, relative } from 'path'
import ts from 'typescript'

/**
 * Architectural guardrail: every Prisma WRITE in the repository layer must be
 * scoped by `tenantId` (or `userId` for tenant-less models) in its `where`
 * clause. This is the class of bug behind the cross-tenant FK-injection finding:
 * a mutation scoped by `id` alone silently trusts that some earlier check
 * proved ownership — one refactor away from a cross-tenant write.
 *
 * The test parses each `*.repository.ts` file and flags any
 * update/updateMany/delete/deleteMany on `this.prisma.<model>` / `tx.<model>`
 * whose `where` does not mention `tenantId` or `userId`.
 */
const MUTATION_METHODS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert'])

// Models with no `tenant_id` column — scoped by `userId` or a parent relation.
const TENANTLESS_MODELS = new Set(['scheduleBlock', 'scheduleException'])

const modulesDir = resolve(process.cwd(), 'src/modules')
const repoRoot = resolve(process.cwd(), '../..')

function repositoryFiles(): string[] {
  const out: string[] = []
  for (const moduleName of readdirSync(modulesDir)) {
    const moduleDir = resolve(modulesDir, moduleName)
    let entries: string[]
    try {
      entries = readdirSync(moduleDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.endsWith('.repository.ts') && !entry.endsWith('.spec.ts')) {
        out.push(resolve(moduleDir, entry))
      }
    }
  }
  return out
}

interface Violation {
  file: string
  line: number
  model: string
  method: string
}

/** Is this expression a Prisma model accessor: `this.prisma.<model>`, `tx.<model>`, `prisma.<model>`? */
function prismaModel(expr: ts.Expression): string | null {
  if (!ts.isPropertyAccessExpression(expr)) return null
  const base = expr.expression
  const model = expr.name.text
  // this.prisma.<model>
  if (
    ts.isPropertyAccessExpression(base) &&
    base.name.text === 'prisma' &&
    base.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    return model
  }
  // tx.<model> / prisma.<model>
  if (ts.isIdentifier(base) && (base.text === 'tx' || base.text === 'prisma')) {
    return model
  }
  return null
}

function findWhereText(arg: ts.Expression): string | null {
  if (!ts.isObjectLiteralExpression(arg)) return null
  for (const prop of arg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'where'
    ) {
      return prop.initializer.getText()
    }
  }
  return null
}

function collectViolations(file: string): Violation[] {
  const source = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const violations: Violation[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (MUTATION_METHODS.has(method)) {
        const model = prismaModel(node.expression.expression)
        if (model && !TENANTLESS_MODELS.has(model)) {
          const arg = node.arguments[0]
          const whereText = arg ? findWhereText(arg) : null
          const scoped = whereText != null && /\b(tenantId|userId)\b/.test(whereText)
          if (!scoped) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
            violations.push({ file, line: line + 1, model, method })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return violations
}

describe('tenant-scoping architectural guardrail', () => {
  it('every Prisma write in a repository is scoped by tenantId or userId', () => {
    const all: Violation[] = []
    for (const file of repositoryFiles()) {
      all.push(...collectViolations(file))
    }
    const report = all
      .map((v) => `  ${relative(repoRoot, v.file)}:${v.line} — ${v.model}.${v.method}() where lacks tenantId/userId`)
      .join('\n')
    expect(all, `Unscoped Prisma writes found:\n${report}`).toEqual([])
  })
})
