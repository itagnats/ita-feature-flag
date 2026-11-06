import type { z } from 'zod'
import { parseVariationValue, percentTotal, round2 } from '../logic/values'
import {
  DESCRIPTION_KEY,
  FIELD_PATTERN,
  MAX_GROUP_DEPTH,
  QUERY_KEYWORDS,
} from './constants'
import type { FlagShape, Group, Serve } from './schema'

/* Cross-field checks used by the schema: they add issues with a `path`, so each message lands on its field. */

type Ctx = z.RefinementCtx
type Path = Array<string | number>

/** One message per attribute: empty, bad shape, or a reserved query word. */
export function fieldError(field: string): string | undefined {
  if (!field) return 'Enter an attribute, e.g. role.'
  if (!FIELD_PATTERN.test(field))
    return 'Start with an English letter (a–z); then letters, digits, _ - : and dots for nested keys.'
  if (QUERY_KEYWORDS.has(field))
    return `"${field}" is a query keyword. Use another attribute name.`
}

/** Indexes of items whose (non-empty) value appeared earlier in the list. */
export function duplicates(values: Array<string>): Array<number> {
  const seen = new Set<string>()
  return values.flatMap((v, i) => {
    if (!v) return []
    if (seen.has(v)) return [i]
    seen.add(v)
    return []
  })
}

export function checkFlag(flag: FlagShape, ctx: Ctx) {
  const add = (path: Path, message: string) =>
    ctx.addIssue({ code: 'custom', path, message })

  duplicates(flag.variations.map((v) => v.name.trim())).forEach((i) =>
    add(
      ['variations', i, 'name'],
      `"${flag.variations[i].name.trim()}" is already used. Use a different name.`,
    ),
  )
  flag.variations.forEach((v, i) => {
    const parsed = parseVariationValue(v.value, flag.type)
    if (!parsed.ok) add(['variations', i, 'value'], parsed.error)
  })

  duplicates(flag.rules.map((r) => r.name.trim())).forEach((i) =>
    add(
      ['rules', i, 'name'],
      `Another rule is already named "${flag.rules[i].name.trim()}". Rename one of them.`,
    ),
  )
  flag.rules.forEach((r, i) => {
    checkServe(flag, r.serve, ['rules', i, 'serve'], add)
    checkDepth(r.tree, ['rules', i, 'tree'], 1, add)
  })
  checkServe(flag, flag.defaultRule, ['defaultRule'], add)

  flag.metadata.forEach((m, i) => {
    if (m.key.trim() === DESCRIPTION_KEY)
      add(
        ['metadata', i, 'key'],
        '"description" is set by the Description field. Use another key.',
      )
  })
  duplicates(flag.metadata.map((m) => m.key.trim())).forEach((i) =>
    add(
      ['metadata', i, 'key'],
      'This key is already used. Use a different key.',
    ),
  )
}

function checkServe(
  flag: FlagShape,
  serve: Serve,
  path: Path,
  add: (p: Path, m: string) => void,
) {
  const ids = flag.variations.map((v) => v.id)
  if (serve.mode === 'variation') {
    if (!serve.variation)
      add([...path, 'variation'], 'Pick a variation to serve.')
    else if (!ids.includes(serve.variation))
      add(
        [...path, 'variation'],
        'That variation was removed. Pick another one.',
      )
    return
  }
  if (ids.length < 2)
    return add(
      [...path, 'mode'],
      'A split needs 2 or more variations. Add one, or serve a single variation.',
    )
  let cellsOk = true
  for (const vid of ids) {
    const n = serve.percentages[vid]
    const message =
      typeof n !== 'number' || Number.isNaN(n)
        ? 'Enter a number.'
        : n < 0 || n > 100
          ? 'Use 0 to 100.'
          : round2(n) !== n && 'Use at most 2 decimals.'
    if (message) {
      cellsOk = false
      add([...path, 'percentages', vid], message)
    }
  }
  const total = percentTotal(serve, ids)
  if (cellsOk && total !== 100)
    add(
      [...path, 'percentages'],
      `Percentages must add up to 100% (now ${total}%). Adjust them or press Split evenly.`,
    )
}

function checkDepth(
  group: Group,
  path: Path,
  depth: number,
  add: (p: Path, m: string) => void,
) {
  if (depth > MAX_GROUP_DEPTH)
    return add(
      path,
      `Groups can be nested up to ${MAX_GROUP_DEPTH} levels. Delete or flatten this group.`,
    )
  group.children.forEach((child, i) => {
    if (child.kind === 'group')
      checkDepth(child, [...path, 'children', i], depth + 1, add)
  })
}
