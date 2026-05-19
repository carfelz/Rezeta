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
        success: <i className="ph ph-check-circle text-success-text text-[18px]" />,
        error: <i className="ph ph-warning-circle text-danger-text text-[18px]" />,
        warning: <i className="ph ph-warning text-warning-text text-[18px]" />,
        info: <i className="ph ph-info text-info-text text-[18px]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'flex items-start gap-3 p-[12px_16px] bg-n-0 border border-n-200 rounded shadow-floating text-[13px] font-sans',
          title: 'text-[13px] font-semibold text-n-800 leading-snug',
          description: 'text-[12.5px] text-n-500 leading-[1.45] mt-1',
          icon: 'shrink-0 mt-px',
          closeButton: 'text-n-400 hover:text-n-700',
        },
      }}
    />
  )
}
