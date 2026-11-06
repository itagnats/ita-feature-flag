import type { EditorValues, Flag } from '../model/schema'
import { segmentsOf } from './path-access'

/** One schema issue, ready to show in the error summary. */
export interface ErrorItem {
  /** `flags.0.rules.1.tree.children.2.value` (the schema path) */
  path: string
  /** TanStack field name: `flags[0].rules[1].tree.children[2].value` (also the DOM id of the input) */
  fieldName: string
  /** Where it is, for people: `my-flag › Rule 2 "Beta" › Group 1 › Condition 3 › Value` */
  label: string
  message: string
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  key: 'Key',
  value: 'Value',
  field: 'Attribute',
  operator: 'Operator',
  variation: 'Variation',
  mode: 'Split',
  percentages: 'Split',
}

/** Reading order of the editor, so the list is not in validator order. Unknown keys go last. */
const ORDER = [
  'key', 'variations', 'rules', 'defaultRule', 'metadata', // inside a flag
  'name', 'tree', 'children', 'field', 'operator', 'value', 'serve', // rule, condition
  'mode', 'variation', 'percentages', // serve
] // prettier-ignore
const rank = (seg: string) => {
  const i = ORDER.indexOf(seg)
  return i < 0 ? ORDER.length : i
}

function compareSegments(a: Array<string>, b: Array<string>): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    const [x, y] = [Number(a[i]), Number(b[i])]
    return !Number.isNaN(x) && !Number.isNaN(y)
      ? x - y
      : rank(a[i]) - rank(b[i])
  }
  return a.length - b.length
}

/** Destructure with "may be missing" element types (the path can end early). */
const parts = (segments: Array<string>) =>
  segments as [string?, string?, ...Array<string>]

const nth = (index: string) => Number(index) + 1
const fieldLabel = (seg: string) => FIELD_LABELS[seg] ?? seg

/** `Variations › #2 › Name` (same shape for Metadata). */
const listCrumbs = (
  title: string,
  row: string | undefined,
  tail: Array<string>,
) =>
  row === undefined ? [title] : [title, `#${nth(row)}`, ...tail.map(fieldLabel)]

/** Breadcrumb inside a condition tree; `rest` starts after `tree`. */
function treeCrumbs(rest: Array<string>): Array<string> {
  const crumbs = ['Group 1']
  let depth = 1
  while (rest[0] === 'children') {
    const [, row, ...next] = parts(rest)
    if (row === undefined) return [...crumbs, 'Conditions']
    if (next.length === 0 || next[0] === 'children') {
      crumbs.push(`Group ${++depth}`) // a nested group
      rest = next
    } else {
      return [...crumbs, `Condition ${nth(row)}`, fieldLabel(next[0])]
    }
  }
  return crumbs
}

/** Breadcrumb for a serve object (`variation`, `mode`, `percentages`, `percentages.<id>`). */
function serveCrumbs(flag: Flag | undefined, rest: Array<string>) {
  const [what, variationId] = rest
  if (!what) return []
  const name = flag?.variations.find((v) => v.id === variationId)?.name
  return what === 'percentages' && variationId
    ? ['Split', name || 'Percentage']
    : [fieldLabel(what)]
}

/** Everything after the flag's own name. */
function flagCrumbs(flag: Flag | undefined, rest: Array<string>) {
  const [head, row, ...tail] = parts(rest)
  switch (head) {
    case 'key':
      return ['Settings', 'Flag name']
    case 'variations':
      return listCrumbs('Variations', row, tail)
    case 'metadata':
      return listCrumbs('Metadata', row, tail)
    case 'defaultRule':
      return ['Default rule', ...serveCrumbs(flag, rest.slice(1))]
    case 'rules': {
      if (row === undefined) return ['Rules']
      const name = flag?.rules.at(Number(row))?.name.trim()
      const rule = `Rule ${nth(row)}${name ? ` "${name}"` : ''}`
      const [part, ...more] = tail
      if (part === 'tree') return [rule, ...treeCrumbs(more)]
      if (part === 'serve') return [rule, ...serveCrumbs(flag, more)]
      return [rule, ...(part ? [fieldLabel(part)] : [])]
    }
    default:
      return rest
  }
}

/** Where an issue sits, e.g. `my-flag › Variations › #2 › Name`. */
function labelOf(segments: Array<string>, values: EditorValues): string {
  const [, row, ...rest] = parts(segments)
  if (row === undefined) return 'Flags'
  const flag = values.flags.at(Number(row))
  const name = flag?.key.trim() || `Flag ${nth(row)}`
  return [name, ...flagCrumbs(flag, rest)].join(' › ')
}

/**
 * Turns the form-level validation result into a flat list, in reading order.
 * `byField` is TanStack's `errorMap.onChange`: `{ [fieldName]: Array<{ message }> }`.
 */
export function buildErrorList(
  byField: unknown,
  values: EditorValues,
): Array<ErrorItem> {
  if (!byField || typeof byField !== 'object') return []
  return Object.entries(byField as Record<string, unknown>)
    .flatMap(([fieldName, issues]) => {
      const segments = segmentsOf(fieldName)
      const label = labelOf(segments, values)
      const list = Array.isArray(issues) ? issues : [issues]
      return list
        .map((i) => (i as { message?: string }).message ?? '')
        .filter(Boolean)
        .map((message) => ({
          path: segments.join('.'),
          fieldName,
          label,
          message,
        }))
    })
    .sort((a, b) => compareSegments(a.path.split('.'), b.path.split('.')))
}
