import { cn } from '#/lib/utils'
import { variationColor } from '../../model/colors'

/** Colour chip for a variation; the name always sits next to it (never colour alone). */
export function VariationSwatch({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3 shrink-0 rounded-sm',
        variationColor(index),
      )}
    />
  )
}
