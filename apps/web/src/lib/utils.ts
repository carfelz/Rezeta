import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Extend twMerge so it knows our project's custom tokens:
// - font-size — our type scale uses custom names (text-2xs/overline/caption/
//   body-sm/body/body-lg/h3/h2/h1/display). Without registering them, twMerge
//   classifies e.g. `text-overline` as a text-COLOR, so pairing it with a real
//   color (`text-success-text`) drops the size and the element inherits 16px.
//   The stock names (xs/sm/base/lg/xl…) are already known to twMerge.
// - font-weight (regular/medium/semibold) — without this, `font-sans` and
//   `font-regular` get classified as the same group and one gets stripped.
// - the `btn-{sm,md,lg,xl}` height/width tokens used by Button's size variants —
//   without this, twMerge can't tell `h-btn-sm` is a height utility, so a
//   `className` override like `h-auto` is kept *alongside* it instead of
//   replacing it (and the baked-in fixed height wins).
const customMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            '2xs',
            'overline',
            'caption',
            'body-sm',
            'body',
            'body-lg',
            'h3',
            'h2',
            'h1',
            'display',
          ],
        },
      ],
      // Custom size/dimension + tracking/leading tokens (arbitrary-value
      // migration). twMerge only knows stock keys; register ours so a
      // cn()-composed `w-440`/`tracking-label` isn't dropped against another
      // class in the same group.
      h: [
        {
          h: [
            'btn-sm', 'btn-md', 'btn-lg', 'btn-xl', 'input-md', 'touch-min',
            '30', '36', '52', '200', '256',
          ],
        },
      ],
      w: [
        {
          w: [
            'btn-sm', 'btn-md', 'btn-lg', 'btn-xl', 'touch-min', 'input-md',
            '30', '36', '52', '56', '96', '110', '120', '180', '200', '380',
            '440', '460', '480', '520', '540', '560',
            'pct-8', 'pct-10', 'pct-15', 'pct-22', 'pct-26', 'pct-34',
          ],
        },
      ],
      'min-w': [{ 'min-w': ['menu', '72', '80', '168', '180', '200', '220'] }],
      'max-w': [
        {
          'max-w': [
            'layout', '260', '320', '400', '440', '480', '560', '640', '800', '880',
            'measure-xs', 'measure-sm', 'measure', 'measure-lg',
          ],
        },
      ],
      'min-h': [{ 'min-h': ['touch', 'input-md', '60', '80', '120', '300', '400', 'screen-60'] }],
      'max-h': [{ 'max-h': ['200', '240', '260', '320'] }],
      tracking: [
        { tracking: ['heading-lg', 'heading', 'heading-sm', 'label-tight', 'label', 'label-wide', 'caps'] },
      ],
      leading: [{ leading: ['display-tight', 'label', 'prose-snug', 'prose'] }],
      'grid-cols': [{ 'grid-cols': ['panel-fixed'] }],
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
