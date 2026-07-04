# Global Loading Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A global `isLoading` state fed by every `apiClient` request, rendered as a non-blocking corner spinner chip, with a reusable design-system `Spinner` component.

**Architecture:** Counter-based Zustand store; `request()`/`downloadBlob()` in the api client increment/decrement it (opt-out via `silent: true`); a `useGlobalLoading()` hook exposes the boolean; a `GlobalLoadingIndicator` chip mounted once in `AppLayout` shows a `Spinner` after 250 ms of sustained loading. Spec: `docs/superpowers/specs/2026-07-02-global-loading-indicator-design.md`.

**Tech Stack:** React 18, Zustand, CVA, Phosphor icons, Vitest + Testing Library. Web-only (`apps/web`).

## Global Constraints

- Spanish user-facing strings (`Cargando`, `Cargando…`); English code.
- Design tokens / existing Tailwind utility idiom only; Phosphor icons (`ph ph-spinner`).
- No `TODO`/`FIXME` (ESLint `no-warning-comments` fails CI).
- Tests in `__tests__/` beside source, matching each file's existing harness. 90% coverage bar (`pnpm test:coverage`).
- `.husky/pre-commit` runs `pnpm lint` + workspace-wide typecheck — every commit must be workspace-green. Commitlint: header < 100 chars, lowercase subject.
- Run verification commands in the FOREGROUND (never background them).
- All new units are `apps/web` only — no shared/api changes.

---

### Task 1: Loading store + `useGlobalLoading` hook

**Files:**
- Create: `apps/web/src/store/loading.store.ts`
- Create: `apps/web/src/hooks/use-global-loading.ts`
- Test: `apps/web/src/store/__tests__/loading.store.test.ts`
- Test: `apps/web/src/hooks/__tests__/use-global-loading.test.ts` (place beside the existing tests in `apps/web/src/hooks/__tests__/`)

**Interfaces:**
- Consumes: nothing (foundation).
- Produces:
  ```typescript
  // loading.store.ts
  export interface LoadingState {
    pendingCount: number
    isLoading: boolean
    requestStarted: () => void
    requestFinished: () => void
  }
  export const useLoadingStore: UseBoundStore<StoreApi<LoadingState>>
  // use-global-loading.ts
  export function useGlobalLoading(): { isLoading: boolean }
  ```

- [ ] **Step 1: Write the failing store tests**

`apps/web/src/store/__tests__/loading.store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useLoadingStore } from '../loading.store'

describe('loading.store', () => {
  beforeEach(() => {
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })

  it('starts idle', () => {
    expect(useLoadingStore.getState().pendingCount).toBe(0)
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('requestStarted flips isLoading and increments the count', () => {
    useLoadingStore.getState().requestStarted()
    expect(useLoadingStore.getState().pendingCount).toBe(1)
    expect(useLoadingStore.getState().isLoading).toBe(true)
  })

  it('stays loading until the last concurrent request finishes', () => {
    const s = useLoadingStore.getState()
    s.requestStarted()
    s.requestStarted()
    s.requestFinished()
    expect(useLoadingStore.getState().isLoading).toBe(true)
    useLoadingStore.getState().requestFinished()
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('clamps at zero on extra requestFinished calls', () => {
    useLoadingStore.getState().requestFinished()
    expect(useLoadingStore.getState().pendingCount).toBe(0)
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- loading.store`
Expected: FAIL — module `../loading.store` not found.

- [ ] **Step 3: Implement the store**

`apps/web/src/store/loading.store.ts` (matches `ui.store.ts` idiom):

```typescript
import { create } from 'zustand'

export interface LoadingState {
  pendingCount: number
  isLoading: boolean
  requestStarted: () => void
  requestFinished: () => void
}

export const useLoadingStore = create<LoadingState>((set) => ({
  pendingCount: 0,
  isLoading: false,
  requestStarted: () =>
    set((s) => {
      const pendingCount = s.pendingCount + 1
      return { pendingCount, isLoading: pendingCount > 0 }
    }),
  requestFinished: () =>
    set((s) => {
      const pendingCount = Math.max(0, s.pendingCount - 1)
      return { pendingCount, isLoading: pendingCount > 0 }
    }),
}))
```

- [ ] **Step 4: Write the failing hook test**

`apps/web/src/hooks/__tests__/use-global-loading.test.ts` (use the render pattern of the sibling hook tests — `renderHook` from Testing Library):

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGlobalLoading } from '../use-global-loading'
import { useLoadingStore } from '@/store/loading.store'

describe('useGlobalLoading', () => {
  beforeEach(() => {
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })

  it('reflects the store flag', () => {
    const { result } = renderHook(() => useGlobalLoading())
    expect(result.current.isLoading).toBe(false)
    act(() => useLoadingStore.getState().requestStarted())
    expect(result.current.isLoading).toBe(true)
    act(() => useLoadingStore.getState().requestFinished())
    expect(result.current.isLoading).toBe(false)
  })
})
```

- [ ] **Step 5: Implement the hook**

`apps/web/src/hooks/use-global-loading.ts`:

```typescript
import { useLoadingStore } from '@/store/loading.store'

export function useGlobalLoading(): { isLoading: boolean } {
  const isLoading = useLoadingStore((s) => s.isLoading)
  return { isLoading }
}
```

- [ ] **Step 6: Run tests, lint, typecheck; commit**

Run: `pnpm --filter @rezeta/web test -- loading.store use-global-loading && pnpm lint && pnpm -r typecheck`
Expected: PASS / clean.

```bash
git add apps/web/src/store apps/web/src/hooks
git commit -m "feat(web): global loading store and useGlobalLoading hook"
```

---

### Task 2: apiClient interception with `silent` opt-out

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/src/lib/__tests__/api-client.test.ts` (extend the existing file; it mocks `@/lib/auth` and `globalThis.fetch` — follow that harness)

**Interfaces:**
- Consumes: `useLoadingStore` from Task 1.
- Produces (exact public API — Task 4's autosave silencing and all existing call sites depend on it):
  ```typescript
  export interface RequestOptions { silent?: boolean }
  export const apiClient: {
    get: <T>(path: string, opts?: RequestOptions) => Promise<T>
    post: <T>(path: string, body: unknown, opts?: RequestOptions) => Promise<T>
    patch: <T>(path: string, body: unknown, opts?: RequestOptions) => Promise<T>
    delete: (path: string, opts?: RequestOptions) => Promise<void>
    download: (path: string, opts?: RequestOptions) => Promise<Blob>
  }
  ```
  All options default loud — zero existing call sites change.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/lib/__tests__/api-client.test.ts` (reuse the file's `fetchMock` setup; import the store):

```typescript
import { useLoadingStore } from '@/store/loading.store'

describe('global loading interception', () => {
  beforeEach(() => {
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })

  const okResponse = (): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve({ data: { id: '1' } }) }) as never

  it('increments while a request is in flight and settles after success', async () => {
    let midFlight = -1
    fetchMock.mockImplementation(() => {
      midFlight = useLoadingStore.getState().pendingCount
      return Promise.resolve(okResponse())
    })
    await apiClient.get('/v1/patients')
    expect(midFlight).toBe(1)
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })

  it('decrements on API error responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { code: 'ERR', message: 'bad' } }),
    } as never)
    await expect(apiClient.get('/v1/patients')).rejects.toThrow()
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })

  it('decrements on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(apiClient.get('/v1/patients')).rejects.toThrow('network down')
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })

  it('decrements on 204 responses', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as never)
    await apiClient.delete('/v1/appointments/a1')
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })

  it('silent requests never touch the store', async () => {
    fetchMock.mockImplementation(() => {
      expect(useLoadingStore.getState().pendingCount).toBe(0)
      return Promise.resolve(okResponse())
    })
    await apiClient.patch('/v1/consultations/c1/protocols/u1', {}, { silent: true })
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })

  it('download participates too', async () => {
    fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) } as never)
    await apiClient.download('/v1/invoices/i1/pdf')
    expect(useLoadingStore.getState().pendingCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- api-client`
Expected: FAIL — `silent`/3rd argument not accepted; store never incremented.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/api-client.ts`:

```typescript
import { useLoadingStore } from '@/store/loading.store'

export interface RequestOptions {
  /** Skip the global loading indicator (autosave/polling traffic). */
  silent?: boolean
}

async function withLoading<T>(silent: boolean | undefined, run: () => Promise<T>): Promise<T> {
  if (silent) return run()
  useLoadingStore.getState().requestStarted()
  try {
    return await run()
  } finally {
    useLoadingStore.getState().requestFinished()
  }
}
```

Wrap the existing bodies (keep `request`/`downloadBlob` logic byte-identical inside the closure):

```typescript
async function request<T>(path: string, init?: RequestInit, opts?: RequestOptions): Promise<T> {
  return withLoading(opts?.silent, async () => {
    // ...existing body of request() unchanged...
  })
}

async function downloadBlob(path: string, opts?: RequestOptions): Promise<Blob> {
  return withLoading(opts?.silent, async () => {
    // ...existing body of downloadBlob() unchanged...
  })
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions): Promise<T> => request<T>(path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),
  delete: (path: string, opts?: RequestOptions): Promise<void> =>
    request<void>(path, { method: 'DELETE' }, opts),
  download: (path: string, opts?: RequestOptions): Promise<Blob> => downloadBlob(path, opts),
}
```

- [ ] **Step 4: Run full api-client tests + suite spot-check; commit**

Run: `pnpm --filter @rezeta/web test -- api-client && pnpm lint && pnpm -r typecheck`
Expected: all existing api-client tests still green (loud-by-default is backward compatible) + new ones pass.

```bash
git add apps/web/src/lib
git commit -m "feat(web): api client feeds the global loading store with silent opt-out"
```

---

### Task 3: `Spinner` ui component

**Files:**
- Create: `apps/web/src/components/ui/Spinner.tsx`
- Create: `apps/web/src/components/ui/Spinner.stories.tsx` (match a sibling like `Badge.stories.tsx` in format)
- Modify: `apps/web/src/components/ui/index.ts` (add the export, matching how siblings are exported)
- Test: `apps/web/src/components/ui/__tests__/Spinner.test.tsx` (create beside existing ui tests if a `__tests__` dir exists there; otherwise follow wherever sibling ui component tests live — check first)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```typescript
  export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
    className?: string
    'aria-label'?: string
  }
  export function Spinner(props: SpinnerProps): JSX.Element
  // sizes: 'sm' (text-[14px]) | 'md' (text-[20px], default) | 'lg' (text-[32px])
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders a status role with the default Spanish label', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-label', 'Cargando')
    expect(el.className).toContain('ph-spinner')
    expect(el.className).toContain('animate-spin')
  })

  it('applies size variants', () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole('status').className).toContain('text-[32px]')
  })

  it('defaults to md', () => {
    render(<Spinner />)
    expect(screen.getByRole('status').className).toContain('text-[20px]')
  })

  it('accepts a custom label and className', () => {
    render(<Spinner aria-label="Guardando" className="text-p-500" />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-label', 'Guardando')
    expect(el.className).toContain('text-p-500')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- Spinner`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

`apps/web/src/components/ui/Spinner.tsx` (CVA idiom per `Badge.tsx`):

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('ph ph-spinner animate-spin inline-block leading-none', {
  variants: {
    size: {
      sm: 'text-[14px]',
      md: 'text-[20px]',
      lg: 'text-[32px]',
    },
  },
  defaultVariants: { size: 'md' },
})

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  'aria-label'?: string
}

export function Spinner({ size, className, 'aria-label': ariaLabel }: SpinnerProps): JSX.Element {
  return (
    <i role="status" aria-label={ariaLabel ?? 'Cargando'} className={cn(spinnerVariants({ size }), className)} />
  )
}
```

Story file mirrors `Badge.stories.tsx` structure with the three sizes and a colored example (`className="text-p-500"`).

- [ ] **Step 4: Run tests, lint; commit**

Run: `pnpm --filter @rezeta/web test -- Spinner && pnpm lint && pnpm -r typecheck`
Expected: PASS / clean.

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): spinner ui component with cva size variants"
```

---

### Task 4: `GlobalLoadingIndicator` + mount + silence autosave + changelog

**Files:**
- Create: `apps/web/src/components/layout/GlobalLoadingIndicator.tsx`
- Modify: `apps/web/src/components/layout/AppLayout.tsx` (mount once, inside the authenticated return)
- Modify: `apps/web/src/components/layout/strings.ts` (add `Cargando…` label per the file's pattern)
- Modify: `apps/web/src/hooks/consultations/use-consultations.ts` — `useUpdateProtocolUsage` and `useUpdateCheckedState` (the autosave write paths) pass `{ silent: true }` as the new third arg to `apiClient.patch`
- Modify: `CHANGELOG.md` (prepend entry)
- Test: `apps/web/src/components/layout/__tests__/GlobalLoadingIndicator.test.tsx`

**Interfaces:**
- Consumes: `useGlobalLoading` (Task 1), `Spinner` (Task 3), `RequestOptions` (Task 2).
- Produces: `<GlobalLoadingIndicator />` — self-contained, no props.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GlobalLoadingIndicator } from '../GlobalLoadingIndicator'
import { useLoadingStore } from '@/store/loading.store'

describe('GlobalLoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing while idle', () => {
    render(<GlobalLoadingIndicator />)
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('appears only after loading persists 250ms', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('never appears for fast requests', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(100))
    act(() => useLoadingStore.getState().requestFinished())
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('hides immediately when loading ends', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(250))
    act(() => useLoadingStore.getState().requestFinished())
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('does not intercept pointer events', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(250))
    const chip = screen.getByText('Cargando…').closest('div')
    expect(chip?.className).toContain('pointer-events-none')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @rezeta/web test -- GlobalLoadingIndicator`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the component**

`apps/web/src/components/layout/GlobalLoadingIndicator.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'
import { useGlobalLoading } from '@/hooks/use-global-loading'
import { layoutStrings } from './strings'

const SHOW_DELAY_MS = 250

export function GlobalLoadingIndicator(): JSX.Element | null {
  const { isLoading } = useGlobalLoading()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setVisible(false)
      return
    }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [isLoading])

  if (!visible) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 pointer-events-none flex items-center gap-2 bg-n-0 border border-n-200 rounded-md shadow-floating px-3 py-2"
    >
      <Spinner size="sm" className="text-p-500" />
      <span className="text-[11.5px] font-mono text-n-600">{layoutStrings.globalLoading}</span>
    </div>
  )
}
```

`strings.ts` gains `globalLoading: 'Cargando…'` following the file's existing export shape (check the actual object name — use whatever the file exports; `layoutStrings` above is illustrative and must match reality).

- [ ] **Step 4: Mount in AppLayout**

In `apps/web/src/components/layout/AppLayout.tsx`, inside the authenticated return, after `<Topbar …/>`:

```tsx
<Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
<GlobalLoadingIndicator />
```

- [ ] **Step 5: Silence the autosave write paths**

In `apps/web/src/hooks/consultations/use-consultations.ts`, the mutations that fire on the consultation autosave loop — `useUpdateProtocolUsage` and `useUpdateCheckedState` — pass the option:

```typescript
apiClient.patch<ConsultationProtocolUsage>(url, dto, { silent: true })
```

(Exact call expressions per the current file; only add the third argument. If other autosave/polling call paths surface while in the file — e.g. the resumable-consultation poll — apply the same option and note it in the report.)

- [ ] **Step 6: Changelog**

Prepend to `CHANGELOG.md`:

```markdown
## [2026-07-02] Global loading indicator

### Added

- Global `isLoading` state fed by every `apiClient` request via a counter-based Zustand store (`apps/web/src/store/loading.store.ts`), exposed through `useGlobalLoading()`; per-request opt-out with `apiClient.*(…, { silent: true })` used by the consultation autosave paths.
- `Spinner` ui component (CVA sizes sm/md/lg, Phosphor `ph-spinner`, `role="status"`, Spanish `Cargando` label) with Storybook story (`apps/web/src/components/ui/Spinner.tsx`).
- `GlobalLoadingIndicator` — non-blocking bottom-right chip mounted in `AppLayout`; appears after 250 ms of sustained loading, `aria-live="polite"`, `pointer-events-none`.
```

- [ ] **Step 7: Full gates; commit**

Run: `pnpm lint && pnpm -r typecheck && pnpm --filter @rezeta/web test && pnpm test:coverage`
Expected: all green, coverage ≥90%.

```bash
git add apps/web CHANGELOG.md
git commit -m "feat(web): global loading indicator chip mounted in app layout"
```
