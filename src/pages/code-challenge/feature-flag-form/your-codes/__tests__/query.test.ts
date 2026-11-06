import { describe, expect, it } from 'vitest'
import { toQuery } from '../logic/query'
import { formatScalar, listKind, scalarKind, splitList } from '../logic/values'
import { and, c, not, or } from './helpers'

describe('toQuery', () => {
  it('compiles every operator', () => {
    const cases: Array<[ReturnType<typeof c>, string]> = [
      [c('key', 'eq', 'example@example.com'), 'key eq "example@example.com"'],
      [c('anonymous', 'ne', 'true'), 'anonymous ne true'],
      [c('age', 'lt', '18'), 'age lt 18'],
      [c('age', 'gt', '-3'), 'age gt -3'],
      [c('score', 'le', '0.5'), 'score le 0.5'],
      [c('app_version', 'ge', '2.0.0'), 'app_version ge 2.0.0'],
      [c('email', 'co', 'gofeatureflag'), 'email co "gofeatureflag"'],
      [c('email', 'sw', 'admin'), 'email sw "admin"'],
      [c('email', 'ew', '@test.com'), 'email ew "@test.com"'],
      [c('role', 'in', 'admin, editor'), 'role in ["admin","editor"]'],
      [c('beta', 'pr'), 'beta pr'],
    ]
    for (const [cond, expected] of cases)
      expect(toQuery(and(cond))).toBe(expected)
  })

  it('joins a group with its combinator and wraps nested groups (3 levels)', () => {
    const tree = and(
      c('group', 'in', 'beta'),
      c('role', 'in', 'admin, editor'),
      or(
        c('country', 'eq', 'TH'),
        and(c('app_version', 'ge', '2.0.0'), c('plan', 'eq', 'pro')),
      ),
    )
    expect(toQuery(tree)).toBe(
      'group in ["beta"] and role in ["admin","editor"] and ' +
        '(country eq "TH" or (app_version ge 2.0.0 and plan eq "pro"))',
    )
  })

  it('writes NOT as not ( … ) on root and nested groups', () => {
    expect(toQuery(not(and(c('role', 'eq', 'guest'))))).toBe(
      'not (role eq "guest")',
    )
    expect(
      toQuery(
        and(c('a', 'eq', '1'), not(or(c('b', 'eq', '2'), c('c', 'eq', '3')))),
      ),
    ).toBe('a eq 1 and not (b eq 2 or c eq 3)')
  })

  it('quotes and escapes text so the query cannot break', () => {
    expect(toQuery(and(c('name', 'eq', 'say "hi" \\ ok')))).toBe(
      'name eq "say \\"hi\\" \\\\ ok"',
    )
    expect(toQuery(and(c('name', 'eq', 'line1\nline2')))).toBe(
      'name eq "line1\\nline2"',
    )
  })

  it('skips incomplete parts and empty groups (validation reports them)', () => {
    expect(toQuery(and())).toBe('')
    expect(toQuery(and(c('', 'eq', 'x'), c('role', 'eq', '')))).toBe('')
    expect(toQuery(and(c('a', 'eq', '1'), or(), c('b', 'pr')))).toBe(
      'a eq 1 and b pr',
    )
  })

  it('uses single spaces only (the grammar requires it)', () => {
    const q = toQuery(
      and(c('  role ', 'in', ' admin ,  editor '), or(c('x', 'pr'))),
    )
    expect(q).toBe('role in ["admin","editor"] and (x pr)')
    expect(q).not.toMatch(/ {2}/)
  })
})

describe('query values', () => {
  it('auto-detects literal kinds', () => {
    expect(['42', '-7', '0'].map(scalarKind)).toEqual(['int', 'int', 'int'])
    expect(['0.5', '-1.25', '1.0e3'].map(scalarKind)).toEqual([
      'double',
      'double',
      'double',
    ])
    expect(['true', 'false'].map(scalarKind)).toEqual(['boolean', 'boolean'])
    expect(['2.0.0', '0.4.0-beta.1'].map(scalarKind)).toEqual([
      'version',
      'version',
    ])
    expect(['007', 'TH', '1.2.', 'True', ''].map(scalarKind)).toEqual(
      Array(5).fill('string'),
    )
    expect(formatScalar('007')).toBe('"007"')
  })

  it('types `in` lists: ints, doubles or strings, never mixed', () => {
    expect(listKind(splitList('1, 2, 3'))).toBe('int')
    expect(listKind(splitList('0.5, 1.5'))).toBe('double')
    expect(listKind(splitList('beta, true, 2.0.0'))).toBe('string')
    expect(listKind(splitList('1, a'))).toBe('mixed')
    expect(listKind(splitList('1, -2'))).toBe('negative-int')
    expect(toQuery(and(c('id', 'in', '1,2,3')))).toBe('id in [1,2,3]')
    expect(splitList(' a, , b ,')).toEqual(['a', 'b'])
  })
})
