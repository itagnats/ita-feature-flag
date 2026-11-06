import type { CSSProperties } from 'react'
import { cn } from '#/lib/utils'
import type { EditorForm } from '../../form/use-editor-form'
import { variationColor, variationCssColor } from '../../model/colors'
import type { Serve } from '../../model/schema'
import { VariationSwatch } from '../ui/VariationSwatch'
import { useServeView } from './hooks'

type Variations = Array<{ id: string; name: string }>
interface ViewProps {
  form: EditorForm
  flagIndex: number
  path: string
}

const clamp = (n: number | undefined) => Math.min(Math.max(n || 0, 0), 100)

/**
 * Gradient for a split. Each variation keeps a solid plateau in the middle of its share;
 * neighbours blend across the boundary, centred on it. The blend is a quarter of the smaller
 * neighbouring share on each side, so 70/30 stays clearly teal-heavy and small shares are not
 * swallowed. Past the total the gradient is transparent (the muted track shows).
 */
function splitGradient(
  parts: Array<{ index: number; share: number }>,
  dark: boolean,
  direction: string,
) {
  const total = parts.reduce((sum, p) => sum + p.share, 0)
  const stops: string[] = []
  let start = 0
  parts.forEach((p, i) => {
    const end = start + p.share
    const color = variationCssColor(p.index, dark)
    const lead = i === 0 ? 0 : Math.min(p.share, parts[i - 1].share) / 4
    const tail =
      i === parts.length - 1 ? 0 : Math.min(p.share, parts[i + 1].share) / 4
    stops.push(`${color} ${start + lead}%`, `${color} ${end - tail}%`)
    start = end
  })
  stops.push(`transparent ${total}%`)
  return `linear-gradient(${direction}, ${stops.join(', ')})`
}

/** Colour bar of a split: one gradient (to right, or to bottom when vertical) blending the variations. */
export function SplitBar({
  variations,
  serve,
  vertical,
  className,
}: {
  variations: Variations
  serve: Serve
  vertical?: boolean
  className?: string
}) {
  const parts = variations
    .map((v, index) => ({ index, share: clamp(serve.percentages[v.id]) }))
    .filter((p) => p.share > 0)
  const direction = vertical ? 'to bottom' : 'to right'
  const style = {
    '--split-light': splitGradient(parts, false, direction),
    '--split-dark': splitGradient(parts, true, direction),
  } as CSSProperties
  return (
    <span
      aria-hidden
      className={cn(
        'bg-muted block overflow-hidden rounded-full',
        parts.length > 0 &&
          'bg-(image:--split-light) dark:bg-(image:--split-dark)',
        className,
      )}
      style={style}
    />
  )
}

/** "Serves ● name" or "Split ▬ 50/50" for a rule header. */
export function ServeChip({ form, flagIndex, path }: ViewProps) {
  const { serve, variations } = useServeView(form, flagIndex, path)
  if (serve.mode === 'percentage')
    return (
      <span className="flex items-center gap-1.5 text-xs">
        Split
        <SplitBar variations={variations} serve={serve} className="h-2 w-12" />
        <span className="font-mono">
          {variations.map((v) => serve.percentages[v.id] ?? 0).join('/')}
        </span>
      </span>
    )
  const at = variations.findIndex((v) => v.id === serve.variation)
  return (
    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      Serves
      {at < 0 ? (
        <em>not set</em>
      ) : (
        <span className="text-foreground bg-background flex items-center gap-1.5 min-w-0 rounded-full border py-0.5 pr-2 pl-1.5 font-medium">
          <VariationSwatch index={at} />
          <span className="max-w-32 truncate" title={variations[at].name}>
            {variations[at].name}
          </span>
        </span>
      )}
    </span>
  )
}

/** Left edge of a rule card: the served variation's colour, or stacked colours for a split. */
export function ServeEdge({ form, flagIndex, path }: ViewProps) {
  const { serve, variations } = useServeView(form, flagIndex, path)
  const edge = 'absolute inset-y-0 left-0 w-1'
  if (serve.mode === 'percentage')
    return (
      <SplitBar
        variations={variations}
        serve={serve}
        vertical
        className={cn(edge, 'rounded-none')}
      />
    )
  const at = variations.findIndex((v) => v.id === serve.variation)
  return (
    <span
      aria-hidden
      className={cn(edge, at < 0 ? 'bg-border' : variationColor(at))}
    />
  )
}
