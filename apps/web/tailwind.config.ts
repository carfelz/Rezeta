import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './index.html'],

  theme: {
    // ── Colors ──────────────────────────────────────────────────────────────
    // All references point to CSS custom properties in tokens.css.
    // tokens.css is authoritative — no raw hex values here.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      n: {
        '0': 'var(--color-n-0)',
        '25': 'var(--color-n-25)',
        '50': 'var(--color-n-50)',
        '100': 'var(--color-n-100)',
        '200': 'var(--color-n-200)',
        '300': 'var(--color-n-300)',
        '400': 'var(--color-n-400)',
        '500': 'var(--color-n-500)',
        '600': 'var(--color-n-600)',
        '700': 'var(--color-n-700)',
        '800': 'var(--color-n-800)',
        '900': 'var(--color-n-900)',
      },

      p: {
        '50': 'var(--color-p-50)',
        '100': 'var(--color-p-100)',
        '300': 'var(--color-p-300)',
        '500': 'var(--color-p-500)',
        '700': 'var(--color-p-700)',
        '900': 'var(--color-p-900)',
      },

      success: {
        bg: 'var(--color-success-bg)',
        border: 'var(--color-success-border)',
        text: 'var(--color-success-text)',
      },

      warning: {
        bg: 'var(--color-warning-bg)',
        border: 'var(--color-warning-border)',
        text: 'var(--color-warning-text)',
      },

      danger: {
        bg: 'var(--color-danger-bg)',
        border: 'var(--color-danger-border)',
        text: 'var(--color-danger-text)',
        solid: 'var(--color-danger-solid)',
      },

      info: {
        bg: 'var(--color-info-bg)',
        border: 'var(--color-info-border)',
        text: 'var(--color-info-text)',
      },
    },

    // ── Border radius ────────────────────────────────────────────────────────
    // Three values only. No deviation.
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      full: '9999px',
    },

    // ── Spacing ──────────────────────────────────────────────────────────────
    // 4px base unit. Only these steps — no arbitrary values.
    // Intentional gaps (no 7, 9, 11, etc.) enforce the scale.
    spacing: {
      '0': '0px',
      px: '1px',
      '1': 'var(--space-1)', // 4px
      '2': 'var(--space-2)', // 8px
      '3': 'var(--space-3)', // 12px
      '4': 'var(--space-4)', // 16px
      '5': 'var(--space-5)', // 20px
      '6': 'var(--space-6)', // 24px
      '8': 'var(--space-8)', // 32px
      '10': 'var(--space-10)', // 40px
      '12': 'var(--space-12)', // 48px
      '16': 'var(--space-16)', // 64px
      // Layout-level values for sidebar/topbar utilities
      sidebar: 'var(--layout-sidebar-width)', // 240px  → w-sidebar, ml-sidebar
      topbar: 'var(--layout-topbar-height)', // 56px   → h-topbar, pt-topbar
    },

    // ── Font families ────────────────────────────────────────────────────────
    // Fonts are loaded by tokens.css @import — no extra setup needed.
    fontFamily: {
      serif: ['var(--font-serif)'],
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)'],
    },

    // ── Font sizes ───────────────────────────────────────────────────────────
    // Includes lineHeight and letterSpacing per the type scale spec.
    // fontWeight and fontFamily per step live in .text-* CSS classes
    // (components.css) — those are the full composite type styles.
    fontSize: {
      display: ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      h1: ['40px', { lineHeight: '1.10', letterSpacing: '-0.015em' }],
      h2: ['28px', { lineHeight: '1.20', letterSpacing: '-0.01em' }],
      h3: ['18px', { lineHeight: '1.35', letterSpacing: '-0.005em' }],
      'body-lg': ['16px', { lineHeight: '1.55' }],
      body: ['14px', { lineHeight: '1.55' }],
      'body-sm': ['13px', { lineHeight: '1.50' }],
      caption: ['12px', { lineHeight: '1.40' }],
      overline: ['11px', { lineHeight: '1.40', letterSpacing: '0.10em' }],
    },

    // ── Font weights ─────────────────────────────────────────────────────────
    // Three weights only, matching the spec exactly.
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
    },

    // ── Box shadows ──────────────────────────────────────────────────────────
    boxShadow: {
      none: 'none',
      raised: 'var(--shadow-raised)',
      floating: 'var(--shadow-floating)',
      focus: 'var(--shadow-focus)',
      'focus-danger': 'var(--shadow-focus-danger)',
    },

    // ── Breakpoints ──────────────────────────────────────────────────────────
    // Matches layout tokens. Only two breakpoints — no sm, md, 2xl.
    screens: {
      lg: '1024px',
      xl: '1440px',
    },

    // ── Border widths ────────────────────────────────────────────────────────
    // Keep 1px and 2px for the design system border/accent patterns.
    borderWidth: {
      DEFAULT: '1px',
      '0': '0',
      '1': '1px',
      '2': '2px',
    },

    // ── Opacity, z-index, transitions kept at defaults ───────────────────────
    extend: {
      // shadcn semantic color names — reference the CSS vars from index.css
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      // Transition shorthands referencing token values
      transitionDuration: {
        fast: '100ms',
        medium: '150ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease',
      },
      // Min/max sizes for touch targets and component heights
      minHeight: {
        touch: 'var(--size-touch-min)', // 44px
      },
      height: {
        'btn-sm': 'var(--size-btn-sm)', // 28px
        'btn-md': 'var(--size-btn-md)', // 32px
        'btn-lg': 'var(--size-btn-lg)', // 40px
        'input-md': 'var(--size-input-md)', // 34px
        'touch-min': 'var(--size-touch-min)', // 44px
      },
      width: {
        'btn-sm': 'var(--size-btn-sm)',
        'btn-md': 'var(--size-btn-md)',
        'btn-lg': 'var(--size-btn-lg)',
        'touch-min': 'var(--size-touch-min)',
      },
      maxWidth: {
        layout: 'var(--layout-max-width)', // 1440px
      },
    },
  },

  plugins: [],
}

export default config
