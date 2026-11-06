import { z } from 'zod'
import {
  COMBINATORS,
  FLAG_KEY_PATTERN,
  FLAG_TYPES,
  OPERATOR_KEYS,
} from './constants'
import type { Operator } from './constants'
import { listKind, splitList } from '../logic/values'
import { checkFlag, duplicates, fieldError } from './checks'

/*
 * Form model (what the editor edits). Every list item has a stable `id` for React keys
 * and drag & drop. `toFlagJson()` maps this model to the GOFF output.
 * Rules point to variations by id, so renaming a variation never breaks a rule.
 */

const id = z.string()

/* ---------- Conditions & recursive groups ---------- */

export const conditionSchema = z
  .object({
    id,
    kind: z.literal('condition'),
    field: z
      .string()
      .trim()
      .superRefine((field, ctx) => {
        const message = fieldError(field)
        if (message) ctx.addIssue({ code: 'custom', message })
      }),
    operator: z.enum(OPERATOR_KEYS as [Operator, ...Array<Operator>]),
    value: z.string(),
  })
  .superRefine((c, ctx) => {
    if (c.operator === 'pr') return
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', path: ['value'], message })
    const items = c.operator === 'in' ? splitList(c.value) : [c.value.trim()]
    if (!items[0]) return issue('Enter a value.')
    if (c.operator !== 'in') return
    const kind = listKind(items)
    if (kind === 'mixed')
      issue('Use one kind of value in a list: all numbers or all text.')
    if (kind === 'int-and-double')
      issue(
        'Use one number style: all whole numbers or all decimals (e.g. 1.0, 2.5).',
      )
    if (kind === 'negative-int')
      issue('Whole numbers in a list cannot be negative.')
  })

export const groupSchema = z.object({
  id,
  kind: z.literal('group'),
  combinator: z.enum(COMBINATORS),
  not: z.boolean(),
  // getter = Zod 4 recursion; the annotation lets TypeScript follow the cycle
  get children(): z.ZodArray<
    z.ZodDiscriminatedUnion<[typeof conditionSchema, typeof groupSchema]>
  > {
    return z
      .array(z.discriminatedUnion('kind', [conditionSchema, groupSchema]))
      .min(1, { error: 'Add at least one condition to this group.' })
  },
})

/* ---------- Serve: one variation or a percentage split ---------- */

export const serveSchema = z.object({
  mode: z.enum(['variation', 'percentage']),
  /** variation id ('' = not chosen yet) */
  variation: z.string(),
  /** variation id → percent (undefined = cell cleared); checked in checkServe so it never aborts the flag */
  percentages: z.record(z.string(), z.number().optional()),
})

/* ---------- Flag ---------- */

export const variationSchema = z.object({
  id,
  name: z.string().trim().min(1, { error: 'Enter a variation name.' }),
  /** raw text; typed by the flag type ("true"/"false" for booleans) */
  value: z.string(),
})

export const ruleSchema = z.object({
  id,
  name: z.string().trim().min(1, { error: 'Give the rule a name.' }),
  tree: groupSchema,
  serve: serveSchema,
})

export const metadataSchema = z.object({
  id,
  key: z.string().trim().min(1, { error: 'Enter a key.' }),
  value: z.string(),
})

const flagObject = z.object({
  id,
  key: z
    .string()
    .trim()
    .superRefine((key, ctx) => {
      const message = !key
        ? 'Enter a flag name, e.g. my-flag.'
        : !FLAG_KEY_PATTERN.test(key) &&
          'Use letters, numbers, "-" or "_" only.'
      if (message) ctx.addIssue({ code: 'custom', message })
    }),
  description: z.string(),
  disable: z.boolean(),
  trackEvents: z.boolean(),
  type: z.enum(FLAG_TYPES),
  version: z.string(),
  variations: z
    .array(variationSchema)
    .min(1, { error: 'Add at least one variation.' }),
  rules: z.array(ruleSchema),
  defaultRule: serveSchema,
  metadata: z.array(metadataSchema),
})

export const flagSchema = flagObject.superRefine(checkFlag)

export const editorSchema = z
  .object({
    flags: z.array(flagSchema).min(1, { error: 'Add at least one flag.' }),
  })
  .superRefine(({ flags }, ctx) => {
    duplicates(flags.map((f) => f.key.trim())).forEach((i) =>
      ctx.addIssue({
        code: 'custom',
        path: ['flags', i, 'key'],
        message: `Another flag already uses "${flags[i].key.trim()}". Use a different name.`,
      }),
    )
  })

/* ---------- Types ---------- */

export type Condition = z.infer<typeof conditionSchema>
export type Group = z.infer<typeof groupSchema>
export type Node = Condition | Group
export type Serve = z.infer<typeof serveSchema>
export type Variation = z.infer<typeof variationSchema>
export type Rule = z.infer<typeof ruleSchema>
export type MetadataEntry = z.infer<typeof metadataSchema>
export type Flag = z.infer<typeof flagSchema>
export type EditorValues = z.infer<typeof editorSchema>
/** Output of the plain flag object (before cross-field checks); used by model/checks.ts. */
export type FlagShape = z.infer<typeof flagObject>
