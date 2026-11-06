/** Shared constants for the editor model. No React here. */

export const FLAG_TYPES = ['boolean', 'string', 'number', 'json'] as const
export type FlagType = (typeof FLAG_TYPES)[number]

/** Operators of the GOFF query grammar (nikunjy/rules). `not` is a group toggle, not an operator. */
export const OPERATORS = {
  eq: 'equals',
  ne: 'not equals',
  lt: 'less than',
  gt: 'greater than',
  le: 'less or equal',
  ge: 'greater or equal',
  co: 'contains',
  sw: 'starts with',
  ew: 'ends with',
  in: 'in a list',
  pr: 'present',
} as const
export type Operator = keyof typeof OPERATORS
export const OPERATOR_KEYS = Object.keys(OPERATORS) as Array<Operator>

/** Operators whose value is always text (written as a quoted string, never auto-typed). */
export const STRING_OPERATORS: ReadonlySet<Operator> = new Set([
  'co',
  'sw',
  'ew',
])

/** Words of the query grammar (case-sensitive); they cannot be used as an attribute name. */
export const QUERY_KEYWORDS: ReadonlySet<string> = new Set(
  `and or not NOT true false null pr
   in IN eq EQ ne NE gt GT lt LT ge GE le LE co CO sw SW ew EW`.split(/\s+/),
)

export const COMBINATORS = ['and', 'or'] as const
export type Combinator = (typeof COMBINATORS)[number]

/** Max nesting depth of condition groups (root group = level 1). */
export const MAX_GROUP_DEPTH = 5

/** Flag key: letters, digits, "-" and "_". */
export const FLAG_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/

/** Attribute path accepted by the GOFF grammar: starts with a letter, dots for nested keys. */
export const FIELD_PATTERN = /^[A-Za-z][\w:-]*(\.[A-Za-z][\w:-]*)*$/

/** Metadata key reserved for the Description field. */
export const DESCRIPTION_KEY = 'description'

/** Labels for the flag type select and header pill. */
export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  boolean: 'Boolean',
  string: 'String',
  number: 'Number',
  json: 'JSON',
}
