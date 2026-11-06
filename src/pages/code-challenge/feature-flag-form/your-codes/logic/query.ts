import { STRING_OPERATORS } from '../model/constants'
import type { Operator } from '../model/constants'
import type { Condition, Group, Node } from '../model/schema'
import { formatList, formatScalar, splitList } from './values'

/**
 * Compiles a condition tree to a GOFF query (nikunjy/rules grammar).
 *   group  → children joined by " and " / " or "; nested groups in "( … )"
 *   not    → "not ( … )"
 *   values → numbers, booleans and versions raw; text quoted and escaped; `in` → [ … ]
 * Pure and total: incomplete parts are skipped, so the preview always has something to show.
 */
export function toQuery(root: Group): string {
  return compileGroup(root, true)
}

function compileGroup(group: Group, isRoot: boolean): string {
  const parts = group.children.map(compileNode).filter(Boolean)
  if (parts.length === 0) return ''
  const body = parts.join(` ${group.combinator} `)
  if (group.not) return `not (${body})`
  return isRoot ? body : `(${body})`
}

function compileNode(node: Node): string {
  return node.kind === 'group'
    ? compileGroup(node, false)
    : compileCondition(node)
}

export function compileCondition({
  field,
  operator,
  value,
}: Condition): string {
  const attr = field.trim()
  if (!attr) return ''
  if (operator === 'pr') return `${attr} pr`
  const text = value.trim()
  const literal = formatLiteral(operator, text)
  return literal ? `${attr} ${operator} ${literal}` : ''
}

/** The written value, or '' when there is nothing to write (blank, or an `in` list without items). */
function formatLiteral(operator: Operator, text: string): string {
  if (!text) return ''
  if (operator === 'in') return splitList(text).length ? formatList(text) : ''
  // co/sw/ew are string operators: always quoted, even for number-like text
  return STRING_OPERATORS.has(operator)
    ? JSON.stringify(text)
    : formatScalar(text)
}
