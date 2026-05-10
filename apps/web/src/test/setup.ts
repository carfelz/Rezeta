import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Firebase mocks ────────────────────────────────────────────────────────────
// `lib/auth/index.ts` instantiates FirebaseAuthClient at module load, which
// calls initializeApp + getAuth. CI has no VITE_FIREBASE_* env vars, so the
// real SDK throws "auth/invalid-api-key" before any test can run. Mock both
// modules globally so tests never touch real Firebase. File-level vi.mock
// calls (e.g. in firebase-auth-client.test.ts) still take precedence.
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
  getApps: vi.fn(() => []),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

// ── localStorage mock ─────────────────────────────────────────────────────────
// jsdom has a limited localStorage — provide a full implementation

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })
