# Global Loading Indicator — Design Spec

**Date:** 2026-07-02
**Status:** Approved by user (section-by-section review)
**Branch:** feat/global-loading-indicator

## Problem

The app has no global feedback while HTTP requests are in flight — only 27 scattered inline `ph-spinner` usages, each hand-rolled per view. There is no shared Spinner component and no way to know "something is loading" app-wide.

## Decisions (from brainstorming)

- **Presentation:** small non-blocking corner chip (bottom-right). Never a blocking overlay — the consultation autosave fires every ~30s and must not interrupt typing.
- **What counts:** every `apiClient` request flips the global state by default; call sites can opt out per-request with `silent: true` (used for autosave/polling traffic).
- **Approach:** interception at the `apiClient` choke point with a counter store (Approach A). Rejected: TanStack `useIsFetching`/`useIsMutating` (misses blob downloads, awkward autosave exclusion) and `window.fetch` monkey-patching (invasive, test-hostile).
- **Spinner:** a design-system `Spinner` ui component with shadcn's Spinner API shape, built on Phosphor + CVA + tokens (not Lucide/stock shadcn — Rezeta's system is custom).

## Architecture

Four small units:

### 1. `apps/web/src/store/loading.store.ts` (Zustand, matches `ui.store.ts` pattern)

```typescript
interface LoadingState {
  pendingCount: number
  isLoading: boolean // derived: pendingCount > 0, kept in sync on each update
  requestStarted: () => void
  requestFinished: () => void
}
```

- Counter, not boolean: overlapping requests keep `isLoading` true until the last settles.
- `requestFinished` clamps `pendingCount` at 0 (backstop against double-decrement).

### 2. Interception in `apps/web/src/lib/api-client.ts`

- `request()` and `downloadBlob()` gain an optional `{ silent?: boolean }` option.
- Unless `silent`: `useLoadingStore.getState().requestStarted()` before the fetch, `requestFinished()` in a `finally` — errors, 401 sign-outs, and 204s all decrement.
- Public methods (`get/post/patch/delete/download`) accept the option; **loud by default** — zero call-site changes required.

### 3. `apps/web/src/hooks/use-global-loading.ts`

`useGlobalLoading(): { isLoading: boolean }` — thin selector over the store; components re-render only when the boolean flips, not per count change.

### 4. UI components

**`apps/web/src/components/ui/Spinner.tsx`** — shadcn-Spinner-shaped API on the Rezeta system:
- `<Spinner size="sm" | "md" | "lg" className?: string aria-label?: string />`
- `<i className="ph ph-spinner animate-spin" role="status">` wrapped in CVA size variants mapping to the scale already used by inline spinners (`text-[14px]` / `text-[20px]` / `text-[32px]`); color via `currentColor`.
- Default `aria-label`: `"Cargando"` (Spanish UI convention), overridable. Storybook story alongside.

**`apps/web/src/components/layout/GlobalLoadingIndicator.tsx`** — the corner chip:
- Renders `null` when idle. While loading: fixed bottom-right pill (`fixed bottom-4 right-4 z-50`, `bg-n-0 border border-n-200 rounded-md shadow-floating`) with `<Spinner size="sm" className="text-p-500" />` + label `Cargando…` (mono label style).
- **Anti-flicker:** appears only after loading has persisted **250 ms** (timeout keyed on `isLoading`); hides immediately when loading ends. Fast requests never show it.
- `pointer-events-none`, `aria-live="polite"`.
- **Mounted once** in the authenticated app layout (alongside the Sidebar/Topbar shell) — covers every page; login excluded by placement.

## Silent opt-outs (initial scope)

- The consultation autosave mutation path (~30s protocol-usage updates) — the consultation header already shows `Guardado · hace 12s`.
- Any other polling discovered during implementation (e.g. resumable-consultation banner check) — each an explicit `silent: true` at its call site, grep-able.
- Everything else (navigation loads, saves, signing, PDF downloads) stays loud.

## Error handling

- Decrement in `finally` — thrown `ApiRequestError`s, 401 sign-outs, network failures cannot leak a stuck spinner.
- Clamp-at-zero in the store is the backstop.
- The indicator only reports in-flight state; errors keep their existing toast/inline handling.

## Testing (90% bar, tests beside source)

- `loading.store`: counter up/down, derived flag, clamp at zero.
- `api-client` (extend existing tests): increments before fetch; decrements on success, error, 401, 204; `silent` skips both; concurrent requests settle the flag only after the last.
- `Spinner`: role="status", size variants, label override.
- `GlobalLoadingIndicator`: hidden when idle; appears only after 250 ms (fake timers); disappears on end; `pointer-events-none`.
- `use-global-loading`: flips with the store.

## Out of scope

- Migrating the 27 existing inline `ph-spinner` usages to the new `Spinner` component (opportunistic follow-up).
- Per-route or per-feature loading UX changes; blocking overlays; progress bars.
- API-side changes (web-only feature).
