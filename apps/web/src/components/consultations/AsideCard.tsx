import type { ReactNode } from 'react'

export function AsideCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-[18px]">
      <h4 className="text-overline font-mono uppercase tracking-[0.06em] text-n-700 font-semibold mb-3">
        {title}
      </h4>
      {children}
    </div>
  )
}
