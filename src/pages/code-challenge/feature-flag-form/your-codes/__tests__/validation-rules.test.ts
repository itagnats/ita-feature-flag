/** Validation rules, typed values, default names, ids. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toQuery } from '../logic/query'
import { parseVariationValue, scalarKind } from '../logic/values'
import { createId, newRule, newVariation, nextFlagKey } from '../model/defaults'
import type { FlagType } from '../model/constants'
import type { Group } from '../model/schema'
import { and, c, issues, serveSplit, serveVar, validFlag } from './helpers'

const rule = (tree: Group) => ({
  id: 'r',
  name: 'r',
  tree,
  serve: serveVar('v-on'),
})
/** Issues of a valid flag with one rule using this tree. */
const ruleIssues = (tree: Group) => issues(validFlag({ rules: [rule(tree)] }))

const PATH = 'flags.0.rules.0.tree.children.0'
const NUMBER_STYLE =
  'Use one number style: all whole numbers or all decimals (e.g. 1.0, 2.5).'

describe('string operators co / sw / ew always quote the value', () => {
  it.each(['co', 'sw', 'ew'] as const)(
    '%s writes numbers, booleans and versions as text',
    (op) => {
      expect(toQuery(and(c('email', op, '123')))).toBe(`email ${op} "123"`)
      expect(toQuery(and(c('a', op, 'true')))).toBe(`a ${op} "true"`)
      expect(toQuery(and(c('a', op, '1.2.3')))).toBe(`a ${op} "1.2.3"`)
      expect(toQuery(and(c('a', op, 'x"y')))).toBe(`a ${op} "x\\"y"`)
    },
  )

  it('other operators still auto-type', () => {
    expect(toQuery(and(c('age', 'gt', '18')))).toBe('age gt 18')
    expect(toQuery(and(c('v', 'eq', '1.2.3')))).toBe('v eq 1.2.3')
  })
})

describe('attribute names that are query keywords', () => {
  it.each([
    'and',
    'or',
    'not',
    'NOT',
    'true',
    'null',
    'in',
    'IN',
    'eq',
    'GE',
    'co',
    'EW',
    'pr',
  ])('rejects "%s"', (name) => {
    expect(ruleIssues(and(c(name, 'eq', 'x')))).toEqual([
      `${PATH}.field: "${name}" is a query keyword. Use another attribute name.`,
    ])
  })

  it.each(['inside', 'role', 'android', 'In', 'Not', 'nullable', 'user.in'])(
    'accepts "%s"',
    (name) => {
      expect(ruleIssues(and(c(name, 'eq', 'x')))).toEqual([])
    },
  )
})

describe('semver literals have no leading zeros', () => {
  it.each(['1.2.3', '0.0.0', '10.20.30', '1.0.0-rc.1', '1.0.0+build.7'])(
    '%s is a version',
    (v) => {
      expect(scalarKind(v)).toBe('version')
    },
  )

  it.each(['01.2.3', '1.02.3', '1.2.03'])('%s is text', (v) => {
    expect(scalarKind(v)).toBe('string')
    expect(toQuery(and(c('v', 'eq', v)))).toBe(`v eq "${v}"`)
  })
})

describe('typed variation values', () => {
  it('json accepts objects and arrays only', () => {
    expect(parseVariationValue('{"a":1}', 'json')).toEqual({
      ok: true,
      value: { a: 1 },
    })
    expect(parseVariationValue('[1, 2]', 'json')).toEqual({
      ok: true,
      value: [1, 2],
    })
    for (const raw of ['42', '"text"', 'true', 'null'])
      expect(parseVariationValue(raw, 'json')).toEqual({
        ok: false,
        error: 'Enter a JSON object or array, e.g. {"key": "value"}.',
      })
    expect(parseVariationValue('{oops', 'json')).toEqual({
      ok: false,
      error: 'Invalid JSON. Check quotes, commas and brackets.',
    })
  })

  it.each([
    ['42', 42],
    ['-0.5', -0.5],
    ['+3', 3],
    ['1e3', 1000],
    ['2.5E-1', 0.25],
  ])('number accepts %s', (raw, value) => {
    expect(parseVariationValue(raw, 'number')).toEqual({ ok: true, value })
  })

  it.each(['0x10', '', '  ', '.5', '5.', '1e', 'Infinity', '1e999', '0b11'])(
    'number rejects "%s"',
    (raw) => {
      expect(parseVariationValue(raw, 'number').ok).toBe(false)
    },
  )
})

describe('`in` lists', () => {
  it('whole numbers mixed with decimals get their own message', () => {
    expect(ruleIssues(and(c('id', 'in', '1, 2.5')))).toEqual([
      `${PATH}.value: ${NUMBER_STYLE}`,
    ])
  })

  it('text mixed with numbers keeps the text/number message', () => {
    expect(ruleIssues(and(c('id', 'in', '1, admin')))).toEqual([
      `${PATH}.value: Use one kind of value in a list: all numbers or all text.`,
    ])
  })

  it('only commas and spaces is empty and never compiles to `in []`', () => {
    expect(ruleIssues(and(c('role', 'in', ' , , ')))).toEqual([
      `${PATH}.value: Enter a value.`,
    ])
    expect(toQuery(and(c('role', 'in', ' , , ')))).toBe('')
  })
})

describe('percentages: at most 2 decimals per input', () => {
  it('accepts 2 decimals and rejects 3', () => {
    const split = (a: number, b: number) =>
      issues(validFlag({ defaultRule: serveSplit({ 'v-on': a, 'v-off': b }) }))
    expect(split(33.33, 66.67)).toEqual([])
    expect(split(33.333, 66.667)).toEqual([
      'flags.0.defaultRule.percentages.v-on: Use at most 2 decimals.',
      'flags.0.defaultRule.percentages.v-off: Use at most 2 decimals.',
    ])
  })
})

describe('one message per empty field, cross-field checks still run', () => {
  it('empty attribute and flag key give exactly one message each', () => {
    const flag = validFlag({
      key: '',
      rules: [rule(and(c('', 'eq', 'x')))],
      defaultRule: serveVar('gone'),
    })
    expect(issues(flag)).toEqual([
      'flags.0.key: Enter a flag name, e.g. my-flag.',
      `${PATH}.field: Enter an attribute, e.g. role.`,
      'flags.0.defaultRule.variation: That variation was removed. Pick another one.',
    ])
  })

  it('bad shapes keep their pattern messages', () => {
    expect(issues(validFlag({ key: 'a b' }))).toEqual([
      'flags.0.key: Use letters, numbers, "-" or "_" only.',
    ])
    expect(ruleIssues(and(c('1x', 'eq', 'x')))).toEqual([
      `${PATH}.field: Start with an English letter (a–z); then letters, digits, _ - : and dots for nested keys.`,
    ])
  })
})

describe('a new variation starts valid for the flag type', () => {
  it('boolean false, number 0, json {}, string empty', () => {
    const v = (t: FlagType) => newVariation([], t).value
    expect([v('boolean'), v('number'), v('json'), v('string')]).toEqual([
      'false',
      '0',
      '{}',
      '',
    ])
  })
})

describe('default names never collide', () => {
  it('picks the first unused number, ignoring surrounding spaces', () => {
    expect(newVariation([], 'string').name).toBe('Variation_1')
    expect(newVariation(['Variation_1', 'Variation_3'], 'string').name).toBe(
      'Variation_2',
    )
    expect(newVariation(['Variation_1', ' Variation_2 '], 'string').name).toBe(
      'Variation_3',
    )
    expect(newRule(['Rule 2']).name).toBe('Rule 1')
    expect(newRule(['Rule 1', 'Rule 2']).name).toBe('Rule 3')
    expect(nextFlagKey(['my-first-flag'])).toBe('new-flag-1')
    expect(nextFlagKey(['new-flag-1', 'new-flag-3'])).toBe('new-flag-2')
  })
})

describe('createId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses randomUUID when available', () => {
    expect(createId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('falls back to getRandomValues without randomUUID (http on a LAN IP)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(10) })
    expect(createId()).toBe('0a'.repeat(16))
  })

  it('falls back to Date + Math.random without crypto', () => {
    vi.stubGlobal('crypto', undefined)
    const [a, b] = [createId(), createId()]
    expect(a).toMatch(/^[0-9a-z]+-[0-9a-z]+$/)
    expect(a).not.toBe(b)
  })
})
