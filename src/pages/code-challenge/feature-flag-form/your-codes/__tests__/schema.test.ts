import { describe, expect, it } from 'vitest'
import { editorSchema } from '../model/schema'
import type { EditorValues, Flag, Group } from '../model/schema'
import { and, c, or, serveSplit, serveVar, validFlag } from './helpers'

/** Validates one flag (or several) and returns "path: message" lines. */
function issues(flags: Flag | Array<Flag>): Array<string> {
  const values: EditorValues = { flags: Array.isArray(flags) ? flags : [flags] }
  const r = editorSchema.safeParse(values)
  return r.success
    ? []
    : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

const rule = (tree: Group, serve = serveVar('v-on'), name = 'R') => ({
  id: `r-${name}`,
  name,
  tree,
  serve,
})

describe('percentages never abort the flag checks', () => {
  const cleared = {
    mode: 'percentage' as const,
    variation: '',
    percentages: { 'v-on': undefined, 'v-off': 50 },
  }
  it('duplicate variation name + empty percentage cell: both errors are reported', () => {
    const base = validFlag()
    const flag = validFlag({
      variations: [
        base.variations[0],
        { ...base.variations[1], name: base.variations[0].name },
      ],
      defaultRule: cleared,
    })
    expect(issues(flag)).toEqual([
      expect.stringContaining('flags.0.variations.1.name:'),
      'flags.0.defaultRule.percentages.v-on: Enter a number.',
    ])
  })
  it('ignores a blank cell in Variation mode and stale keys of deleted variations', () => {
    expect(
      issues(
        validFlag({
          defaultRule: { ...cleared, mode: 'variation', variation: 'v-off' },
        }),
      ),
    ).toEqual([])
    expect(
      issues(
        validFlag({
          defaultRule: serveSplit({
            'v-on': 50,
            'v-off': 50,
            gone: undefined as never,
          }),
        }),
      ),
    ).toEqual([])
  })
})

describe('editorSchema', () => {
  it('accepts a valid flag', () => {
    expect(issues(validFlag())).toEqual([])
  })

  it('checks the flag name', () => {
    expect(issues(validFlag({ key: '  ' }))).toEqual([
      'flags.0.key: Enter a flag name, e.g. my-flag.',
    ])
    expect(issues(validFlag({ key: 'my flag!' }))).toEqual([
      'flags.0.key: Use letters, numbers, "-" or "_" only.',
    ])
    expect(issues([validFlag(), validFlag()])).toEqual([
      'flags.1.key: Another flag already uses "my-flag". Use a different name.',
    ])
  })

  it('checks variations: unique names, values typed by flag type', () => {
    const flag = validFlag({ type: 'number' })
    flag.variations[0].value = '1'
    flag.variations[1] = { id: 'v-off', name: 'on', value: 'abc' }
    expect(issues(flag)).toEqual([
      'flags.0.variations.1.name: "on" is already used. Use a different name.',
      'flags.0.variations.1.value: Enter a number, e.g. 42 or 0.5.',
    ])
    expect(issues(validFlag({ variations: [] }))).toContain(
      'flags.0.variations: Add at least one variation.',
    )
  })

  it('checks what a rule serves', () => {
    expect(issues(validFlag({ defaultRule: serveVar('') }))).toEqual([
      'flags.0.defaultRule.variation: Pick a variation to serve.',
    ])
    expect(issues(validFlag({ defaultRule: serveVar('gone') }))).toEqual([
      'flags.0.defaultRule.variation: That variation was removed. Pick another one.',
    ])
    expect(
      issues(
        validFlag({ defaultRule: serveSplit({ 'v-on': 20, 'v-off': 70 }) }),
      ),
    ).toEqual([
      'flags.0.defaultRule.percentages: Percentages must add up to 100% (now 90%). Adjust them or press Split evenly.',
    ])
    expect(
      issues(
        validFlag({
          defaultRule: serveSplit({ 'v-on': 33.33, 'v-off': 66.67 }),
        }),
      ),
    ).toEqual([])
    const one = validFlag({ defaultRule: serveSplit({ 'v-on': 100 }) })
    one.variations = [one.variations[0]]
    expect(issues(one)).toEqual([
      'flags.0.defaultRule.mode: A split needs 2 or more variations. Add one, or serve a single variation.',
    ])
  })

  it('checks conditions and groups at any depth with exact paths', () => {
    const tree = and(
      c('role', 'eq', 'admin'),
      or(c('', 'eq', 'x'), and()),
      c('9lives', 'pr'),
    )
    expect(issues(validFlag({ rules: [rule(tree)] }))).toEqual([
      'flags.0.rules.0.tree.children.1.children.0.field: Enter an attribute, e.g. role.',
      'flags.0.rules.0.tree.children.1.children.1.children: Add at least one condition to this group.',
      'flags.0.rules.0.tree.children.2.field: Start with an English letter (a–z); then letters, digits, _ - : and dots for nested keys.',
    ])
  })

  it('checks condition values', () => {
    const tree = and(
      c('a', 'eq', ' '),
      c('b', 'in', '1, x'),
      c('d', 'in', '1, -2'),
      c('e', 'pr'),
    )
    expect(issues(validFlag({ rules: [rule(tree)] }))).toEqual([
      'flags.0.rules.0.tree.children.0.value: Enter a value.',
      'flags.0.rules.0.tree.children.1.value: Use one kind of value in a list: all numbers or all text.',
      'flags.0.rules.0.tree.children.2.value: Whole numbers in a list cannot be negative.',
    ])
  })

  it('limits nesting to 5 levels', () => {
    const deep = (levels: number): Group =>
      levels === 1 ? and(c('a', 'pr')) : and(c('a', 'pr'), deep(levels - 1))
    expect(issues(validFlag({ rules: [rule(deep(5))] }))).toEqual([])
    expect(issues(validFlag({ rules: [rule(deep(6))] }))).toEqual([
      'flags.0.rules.0.tree.children.1.children.1.children.1.children.1.children.1: Groups can be nested up to 5 levels. Delete or flatten this group.',
    ])
  })

  it('checks rule names and metadata keys', () => {
    const flag = validFlag({
      rules: [
        rule(and(c('a', 'pr')), serveVar('v-on'), 'Same'),
        {
          ...rule(and(c('a', 'pr')), serveVar('v-on'), 'Same'),
          id: 'r2',
        },
      ],
      metadata: [
        { id: 'm1', key: 'description', value: 'x' },
        { id: 'm2', key: 'jira', value: '1' },
        { id: 'm3', key: 'jira', value: '2' },
      ],
    })
    expect(issues(flag)).toEqual([
      'flags.0.rules.1.name: Another rule is already named "Same". Rename one of them.',
      'flags.0.metadata.0.key: "description" is set by the Description field. Use another key.',
      'flags.0.metadata.2.key: This key is already used. Use a different key.',
    ])
  })
})
