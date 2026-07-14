import type { ReactNode } from 'react'

export function AsideCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-4.5">
      <h4 className="text-overline font-mono uppercase tracking-label text-n-700 font-semibold mb-3">
        {title}
      </h4>
      {children}
    </div>
  )
}
