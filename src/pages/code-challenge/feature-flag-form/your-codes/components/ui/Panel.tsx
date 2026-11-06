import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** A titled block inside a flag card (Settings, Variations, ...). */
export function Panel({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: LucideIcon
  title: ReactNode
  subtitle: string
  /** Optional controls at the right of the header. */
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-muted/30 space-y-4 rounded-xl border p-3 sm:p-4">
      <header className="flex flex-wrap items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="text-base leading-tight font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
        </div>
        {actions && <div className="ml-auto max-w-full min-w-0">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
