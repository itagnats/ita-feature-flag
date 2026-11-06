/**
 * Edge cases that try to break the pure logic (QA, step 1).
 * A failing test here is a finding: production code is not changed to make it pass.
 */
import { describe, expect, it } from 'vitest'
import { toFlagFile, toFlagJson } from '../logic/flag-json'
import { toQuery } from '../logic/query'
import {
  formatList,
  formatScalar,
  parseVariationValue,
  percentTotal,
} from '../logic/values'
import { newFlag, newRule } from '../model/defaults'
import { editorSchema } from '../model/schema'
import type { EditorValues, Flag, Group, Rule } from '../model/schema'
import { and, c, not, or, serveSplit, serveVar, validFlag } from './helpers'

function issues(flags: Flag | Array<Flag>): Array<string> {
  const values: EditorValues = { flags: Array.isArray(flags) ? flags : [flags] }
  const r = editorSchema.safeParse(values)
  return r.success
    ? []
    : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

const rule = (id: string, tree: Group, serve = serveVar('v-on')): Rule => ({
  id,
  name: id,
  tree,
  serve,
})

const q = (field: string, op: Parameters<typeof c>[1], value = '') =>
  toQuery(and(c(field, op, value)))

describe('query values: number-like and version-like text', () => {
  it.each([
    ['007', '"007"'], // leading zero is not an int → text
    ['-0', '-0'], // matches the int pattern
    ['1e5', '"1e5"'], // exponent without a dot is not a double → text
    ['1.0e3', '1.0e3'],
    ['1.0', '1.0'],
    ['.5', '".5"'],
    ['5.', '"5."'],
    ['+5', '"+5"'],
    ['1.0.0-rc.1', '1.0.0-rc.1'],
    ['1.0.0+build.7', '1.0.0+build.7'],
    ['v1.0.0', '"v1.0.0"'],
    ['1.2.3.4', '"1.2.3.4"'],
    ['TRUE', '"TRUE"'],
    ['false', 'false'],
  ])('eq %s → %s', (value, literal) => {
    expect(q('x', 'eq', value)).toBe(`x eq ${literal}`)
  })
})

describe('query strings: escaping and unicode', () => {
  it('keeps unicode text as is, quoted', () => {
    expect(q('city', 'eq', 'กรุงเทพฯ')).toBe('city eq "กรุงเทพฯ"')
    expect(q('name', 'co', 'café 🚀')).toBe('name co "café 🚀"')
  })

  it('escapes quotes, backslashes and control characters', () => {
    expect(q('a', 'eq', 'tab\there')).toBe('a eq "tab\\there"')
    expect(q('a', 'eq', '"quoted"')).toBe('a eq "\\"quoted\\""')
    expect(q('a', 'eq', 'C:\\path')).toBe('a eq "C:\\\\path"')
    expect(q('a', 'eq', "it's")).toBe('a eq "it\'s"')
    expect(formatScalar('\u0001')).toBe('"\\u0001"')
  })

  it('cannot inject query syntax through a value', () => {
    const query = q('role', 'eq', 'x" or role pr or a eq "y')
    expect(query).toBe('role eq "x\\" or role pr or a eq \\"y"')
    expect(JSON.parse(query.slice('role eq '.length))).toBe(
      'x" or role pr or a eq "y',
    )
  })

  it('trims the value and the attribute', () => {
    expect(q('  role  ', 'eq', '  admin  ')).toBe('role eq "admin"')
  })

  it('skips whitespace-only values and attributes', () => {
    expect(q('role', 'eq', '   ')).toBe('')
    expect(q('   ', 'pr')).toBe('')
    expect(q('role', 'in', '  ')).toBe('')
  })
})

describe('`in` lists', () => {
  it('drops spaces and empty items', () => {
    expect(formatList(' admin ,, editor , ')).toBe('["admin","editor"]')
    expect(formatList('a b, c')).toBe('["a b","c"]')
  })

  it('writes doubles raw and quotes booleans/versions/leading zeros', () => {
    expect(formatList('0.5, 1.5')).toBe('[0.5,1.5]')
    expect(formatList('true, 2.0.0')).toBe('["true","2.0.0"]')
    expect(formatList('007, 008')).toBe('["007","008"]')
  })

  it('mixed kinds: quoted in preview, rejected by the schema', () => {
    expect(formatList('1, admin')).toBe('["1","admin"]')
    expect(
      issues(validFlag({ rules: [rule('r', and(c('id', 'in', '1, admin')))] })),
    ).toEqual([
      'flags.0.rules.0.tree.children.0.value: Use one kind of value in a list: all numbers or all text.',
    ])
  })

  it('an `in` value with only commas/spaces is an empty condition', () => {
    // compiles to `role in []`, which can never match
    expect(
      issues(validFlag({ rules: [rule('r', and(c('role', 'in', ' , , ')))] })),
    ).toEqual(['flags.0.rules.0.tree.children.0.value: Enter a value.'])
  })
})

describe('groups: NOT and nesting', () => {
  it('NOT on root, nested and doubly nested groups', () => {
    expect(toQuery(not(or(c('a', 'pr'), c('b', 'pr'))))).toBe(
      'not (a pr or b pr)',
    )
    expect(
      toQuery(or(c('a', 'pr'), not(and(c('b', 'pr'), not(and(c('c', 'pr'))))))),
    ).toBe('a pr or not (b pr and not (c pr))')
  })

  it('a NOT group with only incomplete children is skipped', () => {
    expect(toQuery(and(c('a', 'pr'), not(and(c('', 'eq', 'x')))))).toBe('a pr')
    expect(toQuery(not(and()))).toBe('')
  })

  it('compiles 5 levels with balanced parentheses', () => {
    const deep = (levels: number): Group =>
      levels === 1
        ? and(c(`l1`, 'pr'))
        : or(c(`l${levels}`, 'pr'), deep(levels - 1))
    const query = toQuery(deep(5))
    expect(query).toBe('l5 pr or (l4 pr or (l3 pr or (l2 pr or (l1 pr))))')
    expect(query.split('(').length).toBe(query.split(')').length)
  })

  it('depth 6 reached through a later child is still rejected', () => {
    const chain = (levels: number): Group =>
      levels === 1
        ? and(c('a', 'pr'))
        : and(c('a', 'pr'), c('b', 'pr'), chain(levels - 1))
    expect(issues(validFlag({ rules: [rule('r', chain(5))] }))).toEqual([])
    expect(issues(validFlag({ rules: [rule('r', chain(6))] }))).toHaveLength(1)
  })
})

describe('percentages', () => {
  it('accepts decimal splits that add up to 100', () => {
    const three = validFlag({
      variations: [
        { id: 'a', name: 'a', value: 'true' },
        { id: 'b', name: 'b', value: 'false' },
        { id: 'c', name: 'c', value: 'true' },
      ],
      defaultRule: serveSplit({ a: 33.33, b: 33.33, c: 33.34 }),
    })
    expect(issues(three)).toEqual([])
    expect(
      percentTotal(serveSplit({ a: 0.1, b: 0.2, c: 99.7 }), ['a', 'b', 'c']),
    ).toBe(100)
  })

  // Percentages allow at most 2 decimals.
  it('rejects a total that only rounds to 100 (99.999)', () => {
    expect(
      issues(
        validFlag({ defaultRule: serveSplit({ 'v-on': 99.999, 'v-off': 0 }) }),
      ),
    ).toEqual(['flags.0.defaultRule.percentages.v-on: Use at most 2 decimals.'])
  })

  it('rejects values outside 0..100 even if the total is 100', () => {
    expect(
      issues(
        validFlag({ defaultRule: serveSplit({ 'v-on': 150, 'v-off': -50 }) }),
      ),
    ).toEqual([
      'flags.0.defaultRule.percentages.v-on: Use 0 to 100.',
      'flags.0.defaultRule.percentages.v-off: Use 0 to 100.',
    ])
  })

  it('ignores the share of a removed variation', () => {
    const flag = validFlag({
      defaultRule: serveSplit({ 'v-on': 50, gone: 50 }),
    })
    // the stale key is ignored; the real variation with no share is a blank cell
    expect(issues(flag)).toEqual([
      'flags.0.defaultRule.percentages.v-off: Enter a number.',
    ])
    expect(toFlagJson(flag).defaultRule).toEqual({
      percentage: { on: 50, off: 0 },
    })
  })
})

describe('variations: removed, renamed, duplicated, typed', () => {
  it('rename follows into rule splits and rule variations', () => {
    const flag = validFlag({
      rules: [
        rule('r1', and(c('a', 'pr')), serveVar('v-off')),
        rule('r2', and(c('a', 'pr')), serveSplit({ 'v-on': 40, 'v-off': 60 })),
      ],
    })
    flag.variations[1].name = '  disabled  '
    const json = toFlagJson(flag)
    expect(json.targeting?.[0].variation).toBe('disabled')
    expect(json.targeting?.[1].percentage).toEqual({ on: 40, disabled: 60 })
    expect(json.variations).toEqual({ on: true, disabled: false })
  })

  it('removed variation used by both a rule and the default → two errors', () => {
    const flag = validFlag({
      rules: [rule('r1', and(c('a', 'pr')), serveVar('v-off'))],
    })
    flag.variations = [flag.variations[0]]
    expect(issues(flag)).toEqual([
      'flags.0.rules.0.serve.variation: That variation was removed. Pick another one.',
      'flags.0.defaultRule.variation: That variation was removed. Pick another one.',
    ])
    expect(toFlagJson(flag).targeting?.[0]).toEqual({
      name: 'r1',
      query: 'a pr',
    })
  })

  it('a rule cannot serve a variation id from another flag', () => {
    const other = newFlag('other', () => 'x-id')
    other.defaultRule = serveVar('v-on') // id of validFlag, not of this flag
    expect(issues([validFlag(), other])).toContain(
      'flags.1.defaultRule.variation: That variation was removed. Pick another one.',
    )
  })

  it('duplicate names ignore surrounding spaces, but are case-sensitive', () => {
    const flag = validFlag()
    flag.variations[1].name = ' on '
    expect(issues(flag)).toEqual([
      'flags.0.variations.1.name: "on" is already used. Use a different name.',
    ])
    flag.variations[1].name = 'On'
    expect(issues(flag)).toEqual([])
  })

  it('number values: 007, -0, 1e5 are numbers; blanks are errors', () => {
    expect(parseVariationValue('007', 'number')).toEqual({ ok: true, value: 7 })
    expect(parseVariationValue('1e5', 'number')).toEqual({
      ok: true,
      value: 100000,
    })
    expect(parseVariationValue('  ', 'number').ok).toBe(false)
    expect(parseVariationValue('Infinity', 'number').ok).toBe(false)
    expect(parseVariationValue(' True ', 'boolean').ok).toBe(false)
    expect(parseVariationValue('   ', 'string').ok).toBe(false)
    expect(parseVariationValue(' keep spaces ', 'string')).toEqual({
      ok: true,
      value: ' keep spaces ',
    })
  })
})

describe('flags, rules and metadata names', () => {
  it('flag key is trimmed in the output; duplicates after trim are errors', () => {
    expect(
      Object.keys(toFlagFile({ flags: [validFlag({ key: ' a-b ' })] }).flags),
    ).toEqual(['a-b'])
    expect(
      issues([
        validFlag({ key: 'dup' }),
        validFlag({ key: ' dup ' }),
        validFlag({ key: 'dup' }),
      ]),
    ).toEqual([
      'flags.1.key: Another flag already uses "dup". Use a different name.',
      'flags.2.key: Another flag already uses "dup". Use a different name.',
    ])
  })

  it('no flags → error, output is an empty wrapper', () => {
    expect(editorSchema.safeParse({ flags: [] }).success).toBe(false)
    expect(toFlagFile({ flags: [] })).toEqual({ flags: {} })
  })

  it('a flag key like __proto__ is a normal output key (no prototype pollution)', () => {
    const file = toFlagFile({ flags: [validFlag({ key: '__proto__' })] })
    expect(Object.keys(file.flags)).toEqual(['__proto__'])
    expect(JSON.stringify(file)).toContain('"__proto__":{')
    expect(({} as Record<string, unknown>).variations).toBeUndefined()
  })

  it('"description" metadata key: reserved even with spaces; Description field wins in output', () => {
    const flag = validFlag({
      description: 'from field',
      metadata: [{ id: 'm', key: ' description ', value: 'from metadata' }],
    })
    expect(issues(flag)).toEqual([
      'flags.0.metadata.0.key: "description" is set by the Description field. Use another key.',
    ])
    expect(toFlagJson(flag).metadata).toEqual({ description: 'from field' })
    expect(
      issues(
        validFlag({ metadata: [{ id: 'm', key: 'Description', value: 'x' }] }),
      ),
    ).toEqual([])
  })

  it('duplicate metadata keys after trim → error', () => {
    const flag = validFlag({
      metadata: [
        { id: 'm1', key: 'team', value: 'a' },
        { id: 'm2', key: ' team', value: 'b' },
      ],
    })
    expect(issues(flag)).toEqual([
      'flags.0.metadata.1.key: This key is already used. Use a different key.',
    ])
  })

  it('duplicate rule names after trim → error', () => {
    const flag = validFlag({
      rules: [
        { ...rule('r1', and(c('a', 'pr'))), name: 'Beta' },
        { ...rule('r2', and(c('a', 'pr'))), name: ' Beta ' },
      ],
    })
    expect(issues(flag)).toEqual([
      'flags.0.rules.1.name: Another rule is already named "Beta". Rename one of them.',
    ])
  })
})

describe('output JSON: key order and omitted defaults', () => {
  it('full key order: variations, targeting, defaultRule, disable, trackEvents, version, metadata', () => {
    const json = toFlagJson(
      validFlag({
        metadata: [{ id: 'm', key: 'team', value: 'x' }],
        description: 'd',
        version: '2',
        trackEvents: false,
        disable: true,
        rules: [rule('r', and(c('a', 'pr')))],
      }),
    )
    expect(Object.keys(json)).toEqual([
      'variations',
      'targeting',
      'defaultRule',
      'disable',
      'trackEvents',
      'version',
      'metadata',
    ])
    expect(Object.keys(json.metadata ?? {})).toEqual(['team', 'description'])
    expect(Object.keys(json.targeting?.[0] ?? {})).toEqual([
      'name',
      'query',
      'variation',
    ])
  })

  it('omits disable when not disabled, trackEvents when true, version when blank', () => {
    const json = toFlagJson(
      validFlag({
        disable: false,
        trackEvents: true,
        version: '   ',
        description: '  ',
      }),
    )
    expect(json).not.toHaveProperty('disable')
    expect(json).not.toHaveProperty('trackEvents')
    expect(json).not.toHaveProperty('version')
    expect(json).not.toHaveProperty('metadata')
    expect(json).not.toHaveProperty('targeting')
  })

  it('a rule never has both variation and percentage', () => {
    const r = rule('r', and(c('a', 'pr')), {
      mode: 'percentage',
      variation: 'v-on', // left over from the variation mode
      percentages: { 'v-on': 50, 'v-off': 50 },
    })
    const out = toFlagJson(validFlag({ rules: [r] })).targeting?.[0]
    expect(out).toHaveProperty('percentage')
    expect(out).not.toHaveProperty('variation')
  })
})

describe('cross-field errors are not hidden by other field errors', () => {
  it('empty flag key + default rule serving a removed variation → both errors', () => {
    expect(
      issues(validFlag({ key: '', defaultRule: serveVar('gone') })),
    ).toEqual([
      'flags.0.key: Enter a flag name, e.g. my-flag.',
      'flags.0.defaultRule.variation: That variation was removed. Pick another one.',
    ])
  })

  it('a new rule (empty condition) does not hide the default-rule error', () => {
    const flag = validFlag({ rules: [newRule([])], defaultRule: serveVar('') })
    const list = issues(flag)
    expect(list).toContain(
      'flags.0.defaultRule.variation: Pick a variation to serve.',
    )
    expect(list).toContain(
      'flags.0.rules.0.serve.variation: Pick a variation to serve.',
    )
  })

  it('duplicate flag keys are reported even if one flag has an empty attribute', () => {
    const broken = validFlag({ rules: [rule('r', and(c('', 'eq', 'x')))] })
    expect(issues([validFlag(), broken])).toContain(
      'flags.1.key: Another flag already uses "my-flag". Use a different name.',
    )
  })

  it('a too-deep tree is reported even if a condition in it is incomplete', () => {
    const deep = (levels: number): Group =>
      levels === 1 ? and(c('', 'eq', 'x')) : and(c('a', 'pr'), deep(levels - 1))
    expect(issues(validFlag({ rules: [rule('r', deep(6))] }))).toContain(
      'flags.0.rules.0.tree.children.1.children.1.children.1.children.1.children.1: Groups can be nested up to 5 levels. Delete or flatten this group.',
    )
  })
})
