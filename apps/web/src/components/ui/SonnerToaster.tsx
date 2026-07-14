import { Toaster as Sonner } from 'sonner'

/**
 * App-wide toast surface. Mounted once in the provider tree.
 * Styling follows the design system: neutral surface, 1px border,
 * Phosphor icons, semantic text colors.
 */
export function AppToaster(): JSX.Element {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      icons={{
        success: <i className="ph ph-check-circle text-success-text text-h3" />,
        error: <i className="ph ph-warning-circle text-danger-text text-h3" />,
        warning: <i className="ph ph-warning text-warning-text text-h3" />,
        info: <i className="ph ph-info text-info-text text-h3" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'flex items-start gap-3 py-3 px-4 bg-n-0 border border-n-200 rounded shadow-floating text-sm font-sans',
          title: 'text-sm font-semibold text-n-800 leading-snug',
          description: 'text-xs text-n-500 leading-prose-snug mt-1',
          icon: 'shrink-0 mt-px',
          closeButton: 'text-n-400 hover:text-n-700',
        },
      }}
    />
  )
}
