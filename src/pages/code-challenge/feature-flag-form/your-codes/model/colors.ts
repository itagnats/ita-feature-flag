/**
 * Variation palette: one colour per variation position, cycled. Full class names (not built
 * strings) so Tailwind can see them. No red, green, blue or violet: those mean error/success/link.
 * `hue` is the matching Tailwind colour name, used for gradients via `var(--color-<hue>-600|400)`.
 */
const PALETTE = [
  { hue: 'teal', cls: 'bg-teal-600 dark:bg-teal-400' },
  { hue: 'amber', cls: 'bg-amber-600 dark:bg-amber-400' },
  { hue: 'pink', cls: 'bg-pink-600 dark:bg-pink-400' },
  { hue: 'lime', cls: 'bg-lime-600 dark:bg-lime-400' },
  { hue: 'orange', cls: 'bg-orange-600 dark:bg-orange-400' },
  { hue: 'cyan', cls: 'bg-cyan-600 dark:bg-cyan-400' },
] as const

export const variationColor = (index: number): string =>
  PALETTE[index % PALETTE.length].cls

/** CSS colour value (a theme variable) for gradients: `*-600` in light, `*-400` in dark. */
export const variationCssColor = (index: number, dark: boolean): string =>
  `var(--color-${PALETTE[index % PALETTE.length].hue}-${dark ? 400 : 600})`
