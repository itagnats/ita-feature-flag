import type {
  Condition,
  EditorValues,
  Flag,
  Group,
  MetadataEntry,
  Rule,
  Serve,
  Variation,
} from './schema'
import type { FlagType } from './constants'
import { round2 } from '../logic/values'

/** New ids for items added in the browser; randomUUID needs a secure context (https/localhost). */
export function createId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  if (c?.getRandomValues)
    return Array.from(c.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** First `label(n)` (n from 1) that no existing name uses, so defaults never collide. */
function firstUnused(taken: Array<string>, label: (n: number) => string) {
  const used = new Set(taken.map((t) => t.trim()))
  let n = 1
  while (used.has(label(n))) n++
  return label(n)
}

/** Equal split of 100% over the variations; the first one takes the rounding remainder. */
export function splitEvenly(ids: Array<string>): Record<string, number> {
  const base = Math.floor(10000 / ids.length) / 100
  const rest = round2(100 - base * ids.length)
  return Object.fromEntries(
    ids.map((id, i) => [id, i === 0 ? round2(base + rest) : base]),
  )
}

export const newServe = (): Serve => ({
  mode: 'variation',
  variation: '',
  percentages: {},
})

export const newCondition = (): Condition => ({
  id: createId(),
  kind: 'condition',
  field: '',
  operator: 'eq',
  value: '',
})

/** GOFF's query builder starts a group with one empty condition. */
export const newGroup = (): Group => ({
  id: createId(),
  kind: 'group',
  combinator: 'and',
  not: false,
  children: [newCondition()],
})

export const newRule = (existingNames: Array<string>): Rule => ({
  id: createId(),
  name: firstUnused(existingNames, (n) => `Rule ${n}`),
  tree: newGroup(),
  serve: newServe(),
})

/** A raw value that is valid for the type (strings start empty: the user types one). */
const DEFAULT_RAW: Record<FlagType, string> = {
  boolean: 'false',
  number: '0',
  json: '{}',
  string: '',
}

export const newVariation = (
  existingNames: Array<string>,
  type: FlagType,
): Variation => ({
  id: createId(),
  name: firstUnused(existingNames, (n) => `Variation_${n}`),
  value: DEFAULT_RAW[type],
})

export const newMetadata = (): MetadataEntry => ({
  id: createId(),
  key: '',
  value: '',
})

/**
 * A flag with the GOFF editor defaults. `ids` keeps the first render deterministic
 * (server and client must produce the same markup).
 */
export function newFlag(key: string, ids = createId): Flag {
  return {
    id: ids(),
    key,
    description: '',
    disable: false,
    trackEvents: true,
    type: 'boolean',
    version: '',
    variations: [
      { id: ids(), name: 'Variation_1', value: 'true' },
      { id: ids(), name: 'Variation_2', value: 'false' },
    ],
    rules: [],
    defaultRule: newServe(),
    metadata: [],
  }
}

/** Key for an added flag, like the GOFF editor: new-flag-1, new-flag-2… (first unused). */
export const nextFlagKey = (existingKeys: Array<string>): string =>
  firstUnused(existingKeys, (n) => `new-flag-${n}`)

/** Start state (same as the GO Feature Flag editor): one flag "my-first-flag" with fixed ids for SSR. */
export function initialValues(): EditorValues {
  let n = 0
  return { flags: [newFlag('my-first-flag', () => `init-${++n}`)] }
}
