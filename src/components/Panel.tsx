import type { ReactNode } from 'react'

type PanelProps = {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function Panel({ title, children, action, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
