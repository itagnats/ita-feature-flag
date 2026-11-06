import type { FlagType } from '../model/constants'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Sum of a split over the current variations, rounded to 2 decimals (missing cells count as 0). */
export function percentTotal(
  serve: { percentages: Record<string, number | undefined> },
  variationIds: Array<string>,
): number {
  return round2(
    variationIds.reduce((acc, vid) => acc + (serve.percentages[vid] ?? 0), 0),
  )
}

/* ---------- Variation values (typed by the flag type) ---------- */

export type ParsedValue =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

/** Turns the raw text of a variation into its typed value, or explains what is wrong. */
export function parseVariationValue(raw: string, type: FlagType): ParsedValue {
  const text = raw.trim()
  switch (type) {
    case 'boolean':
      return text === 'true' || text === 'false'
        ? { ok: true, value: text === 'true' }
        : { ok: false, error: 'Choose true or false.' }
    case 'number': {
      const n = Number(text)
      return DECIMAL.test(text) && Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, error: 'Enter a number, e.g. 42 or 0.5.' }
    }
    case 'json':
      return parseJsonContainer(text)
    default:
      return text === ''
        ? { ok: false, error: 'Enter a value.' }
        : { ok: true, value: raw }
  }
}

function parseJsonContainer(text: string): ParsedValue {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON. Check quotes, commas and brackets.',
    }
  }
  return typeof value === 'object' && value !== null
    ? { ok: true, value }
    : {
        ok: false,
        error: 'Enter a JSON object or array, e.g. {"key": "value"}.',
      }
}

/** Keeps raw values usable when the flag type changes (only booleans need a valid default). */
export function coerceRawValue(raw: string, type: FlagType): string {
  if (type === 'boolean') return raw.trim() === 'true' ? 'true' : 'false'
  return raw
}

/* ---------- Query values (GOFF grammar literals) ---------- */

const INT = /^-?(0|[1-9]\d*)$/
const DOUBLE = /^-?(0|[1-9]\d*)\.\d+([eE][+-]?\d+)?$/
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/
/** Variation numbers: decimal notation only (no hex, Infinity or empty). */
const DECIMAL = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/

export type ScalarKind = 'int' | 'double' | 'boolean' | 'version' | 'string'

/** Auto-detects how a typed value is written in a query (integer, decimal, boolean, version or string). */
export function scalarKind(text: string): ScalarKind {
  if (INT.test(text)) return 'int'
  if (DOUBLE.test(text)) return 'double'
  if (text === 'true' || text === 'false') return 'boolean'
  if (SEMVER.test(text)) return 'version'
  return 'string'
}

/** Writes one scalar literal: raw for numbers/booleans/versions, quoted + escaped otherwise. */
export function formatScalar(text: string): string {
  return scalarKind(text) === 'string' ? JSON.stringify(text) : text
}

/** Splits an `in` value ("a, b, c") into trimmed, non-empty items. */
export function splitList(text: string): Array<string> {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

type ListKind = 'int' | 'double' | 'string'

/**
 * The grammar only has lists of ints (no sign), doubles, or strings, never mixed.
 * Booleans and versions inside a list are treated as strings.
 */
export function listKind(
  items: Array<string>,
): ListKind | 'mixed' | 'int-and-double' | 'negative-int' {
  const kinds = new Set<ListKind>(
    items.map((s) => {
      const k = scalarKind(s)
      return k === 'int' || k === 'double' ? k : 'string'
    }),
  )
  if (kinds.size > 1) return kinds.has('string') ? 'mixed' : 'int-and-double'
  const [kind = 'string'] = kinds
  if (kind === 'int' && items.some((s) => s.startsWith('-')))
    return 'negative-int'
  return kind
}

/** Writes an `in` list literal, e.g. ["admin","editor"] or [1,2,3]. */
export function formatList(text: string): string {
  const items = splitList(text)
  const kind = listKind(items)
  // a mixed list is invalid (validation says so); quoting all keeps the preview parseable
  const quote = kind === 'string' || kind === 'mixed'
  return `[${items.map((s) => (quote ? JSON.stringify(s) : s)).join(',')}]`
}
