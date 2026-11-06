import type { Operator } from '../model/constants'
import type { Condition, Flag, Group, Node, Serve } from '../model/schema'
import { newFlag } from '../model/defaults'
import { editorSchema } from '../model/schema'

let n = 0
const tid = () => `t${++n}`

/** c('role', 'in', 'admin, editor') */
export const c = (
  field: string,
  operator: Operator,
  value = '',
): Condition => ({
  id: tid(),
  kind: 'condition',
  field,
  operator,
  value,
})

/** and(c(...), or(...)) */
export const and = (...children: Array<Node>): Group => ({
  id: tid(),
  kind: 'group',
  combinator: 'and',
  not: false,
  children,
})
export const or = (...children: Array<Node>): Group => ({
  ...and(...children),
  combinator: 'or',
})
export const not = (g: Group): Group => ({ ...g, not: true })

export const serveVar = (variation: string): Serve => ({
  mode: 'variation',
  variation,
  percentages: {},
})
export const serveSplit = (percentages: Record<string, number>): Serve => ({
  mode: 'percentage',
  variation: '',
  percentages,
})

/** A valid boolean flag: variations v-on (true) / v-off (false), default serves v-off. */
export function validFlag(overrides: Partial<Flag> = {}): Flag {
  const base = newFlag('my-flag', tid)
  return {
    ...base,
    variations: [
      { id: 'v-on', name: 'on', value: 'true' },
      { id: 'v-off', name: 'off', value: 'false' },
    ],
    defaultRule: serveVar('v-off'),
    ...overrides,
  }
}

/** Validates flags with the editor schema; returns "path: message" lines (empty = valid). */
export function issues(flags: Flag | Array<Flag>): Array<string> {
  const r = editorSchema.safeParse({
    flags: Array.isArray(flags) ? flags : [flags],
  })
  return r.success
    ? []
    : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}
