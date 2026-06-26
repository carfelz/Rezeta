import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Extend twMerge so it knows our project's custom tokens:
// - font-weight (regular/medium/semibold) — without this, `font-sans` and
//   `font-regular` get classified as the same group and one gets stripped.
// - the `btn-{sm,md,lg,xl}` height/width tokens used by Button's size variants —
//   without this, twMerge can't tell `h-btn-sm` is a height utility, so a
//   `className` override like `h-auto` is kept *alongside* it instead of
//   replacing it (and the baked-in fixed height wins).
const customMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      h: [{ h: ['btn-sm', 'btn-md', 'btn-lg', 'btn-xl'] }],
      w: [{ w: ['btn-sm', 'btn-md', 'btn-lg', 'btn-xl'] }],
    },
  },
  override: {
    classGroups: {
      'font-weight': [{ font: ['regular', 'medium', 'semibold'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return customMerge(clsx(inputs))
}
