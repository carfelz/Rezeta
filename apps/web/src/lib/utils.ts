import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Extend twMerge so it knows our project's custom font-weight tokens
// (regular/medium/semibold) — without this, `font-sans` and `font-regular` get
// classified as the same group and one of them gets stripped on merge.
const customMerge = extendTailwindMerge({
  override: {
    classGroups: {
      'font-weight': [{ font: ['regular', 'medium', 'semibold'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return customMerge(clsx(inputs))
}
