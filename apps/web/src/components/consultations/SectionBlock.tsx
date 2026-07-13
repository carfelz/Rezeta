import type { ReactNode } from 'react'

export function SectionBlock({
  title,
  children,
  id,
}: {
  title: string
  children: ReactNode
  id?: string
}): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md px-6 py-5 mb-4" {...(id ? { id } : {})}>
      <h3 className="font-serif font-medium text-h3 text-n-900 tracking-[-0.005em] mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
