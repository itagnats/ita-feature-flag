import { DESCRIPTION_KEY } from '../model/constants'
import type { EditorValues, Flag, Serve } from '../model/schema'
import { toQuery } from './query'
import { parseVariationValue } from './values'

/** GOFF flag as written to the output file. Optional keys are omitted at their default. */
export interface GoffRule {
  name?: string
  query?: string
  variation?: string
  percentage?: Record<string, number>
}
export interface GoffFlag {
  variations: Record<string, unknown>
  targeting?: Array<GoffRule>
  defaultRule: GoffRule
  disable?: true
  trackEvents?: false
  version?: string
  metadata?: Record<string, string>
}
export interface GoffFile {
  flags: Record<string, GoffFlag>
}

/**
 * Editor state → output file `{ "flags": { "<key>": GoffFlag } }`.
 * Best effort while the form is invalid: the preview still shows what will be written.
 */
export function toFlagFile({ flags }: EditorValues): GoffFile {
  return {
    flags: Object.fromEntries(
      flags.map((f) => [f.key.trim() || 'untitled', toFlagJson(f)]),
    ),
  }
}

export function toFlagJson(flag: Flag): GoffFlag {
  const names = new Map(flag.variations.map((v) => [v.id, v.name.trim()]))
  const serve = (s: Serve): GoffRule => serveJson(s, flag, names)

  const targeting = flag.rules.map((r) => ({
    name: r.name.trim(),
    query: toQuery(r.tree),
    ...serve(r.serve),
  }))
  // key order follows GOFF: variations, targeting, defaultRule, …
  const out: GoffFlag = {
    variations: Object.fromEntries(
      flag.variations.map((v) => {
        const parsed = parseVariationValue(v.value, flag.type)
        return [v.name.trim(), parsed.ok ? parsed.value : v.value]
      }),
    ),
    ...(targeting.length ? { targeting } : {}),
    defaultRule: serve(flag.defaultRule),
  }
  // like the GOFF editor: write these only when they differ from the GOFF default
  if (flag.disable) out.disable = true
  if (!flag.trackEvents) out.trackEvents = false
  if (flag.version.trim()) out.version = flag.version.trim()

  const metadata = Object.fromEntries(
    flag.metadata
      .filter((m) => m.key.trim())
      .map((m) => [m.key.trim(), m.value]),
  )
  if (flag.description.trim())
    metadata[DESCRIPTION_KEY] = flag.description.trim()
  if (Object.keys(metadata).length) out.metadata = metadata
  return out
}

/** A cleared or NaN cell is written as 0 (JSON has no NaN). */
const finiteOrZero = (n: number | undefined): number =>
  n !== undefined && Number.isFinite(n) ? n : 0

function serveJson(
  serve: Serve,
  flag: Flag,
  names: Map<string, string>,
): GoffRule {
  if (serve.mode === 'percentage') {
    return {
      percentage: Object.fromEntries(
        flag.variations.map((v) => [
          v.name.trim(),
          finiteOrZero(serve.percentages[v.id]),
        ]),
      ),
    }
  }
  const name = names.get(serve.variation)
  return name === undefined ? {} : { variation: name }
}
