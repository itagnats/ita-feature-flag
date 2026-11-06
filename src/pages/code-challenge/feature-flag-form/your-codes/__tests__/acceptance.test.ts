/**
 * Acceptance checks A1-A13, logic part only.
 * A1 badge, A2, A8 UI wiring, A12 and A13 are covered in editor-acceptance.test.tsx.
 */
import { describe, expect, it } from 'vitest'
import { toFlagFile, toFlagJson } from '../logic/flag-json'
import { toQuery } from '../logic/query'
import { newFlag } from '../model/defaults'
import { editorSchema } from '../model/schema'
import type { EditorValues, Flag, Group, Rule } from '../model/schema'
import expectedText from './fixtures/reference-flags.json?raw'
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

describe('acceptance checks (logic)', () => {
  it('A1 empty flag key → error on flags.0.key', () => {
    expect(issues(validFlag({ key: '' }))).toEqual([
      'flags.0.key: Enter a flag name, e.g. my-flag.',
    ])
  })

  it('A2 (logic) adding/removing a variation changes the output', () => {
    const flag = validFlag()
    flag.variations.push({ id: 'v3', name: 'maybe', value: 'true' })
    expect(Object.keys(toFlagJson(flag).variations)).toEqual([
      'on',
      'off',
      'maybe',
    ])
    flag.variations = flag.variations.filter((v) => v.id !== 'v-on')
    expect(Object.keys(toFlagJson(flag).variations)).toEqual(['off', 'maybe'])
  })

  it('A3 duplicate variation name → error on the second one', () => {
    const flag = validFlag()
    flag.variations[1].name = 'on'
    expect(issues(flag)).toEqual([
      'flags.0.variations.1.name: "on" is already used. Use a different name.',
    ])
  })

  it('A4 AND inside OR inside AND → parenthesised query', () => {
    const tree = and(
      c('a', 'eq', 'x'),
      or(c('b', 'eq', 'y'), and(c('c', 'gt', '1'), c('d', 'lt', '2'))),
    )
    expect(toQuery(tree)).toBe('a eq "x" and (b eq "y" or (c gt 1 and d lt 2))')
  })

  it('A5 role in [...] and group eq (free-text field)', () => {
    expect(
      toQuery(and(c('role', 'in', 'admin, editor'), c('group', 'eq', 'beta'))),
    ).toBe('role in ["admin","editor"] and group eq "beta"')
    expect(
      issues(
        validFlag({
          rules: [
            rule(
              'r1',
              and(c('role', 'in', 'admin, editor'), c('group', 'eq', 'beta')),
            ),
          ],
        }),
      ),
    ).toEqual([])
  })

  it('A6 split ≠ 100 → error naming the actual total (rule and default)', () => {
    const flag = validFlag({
      rules: [
        rule(
          'r1',
          and(c('a', 'pr')),
          serveSplit({ 'v-on': 33.3, 'v-off': 66.6 }),
        ),
      ],
      defaultRule: serveSplit({ 'v-on': 60, 'v-off': 60 }),
    })
    expect(issues(flag)).toEqual([
      'flags.0.rules.0.serve.percentages: Percentages must add up to 100% (now 99.9%). Adjust them or press Split evenly.',
      'flags.0.defaultRule.percentages: Percentages must add up to 100% (now 120%). Adjust them or press Split evenly.',
    ])
  })

  it('A7 rule referencing a deleted variation → error on that rule', () => {
    const flag = validFlag({
      rules: [rule('r1', and(c('a', 'pr')), serveVar('v-on'))],
    })
    flag.variations = flag.variations.filter((v) => v.id !== 'v-on')
    expect(issues(flag)).toEqual([
      'flags.0.rules.0.serve.variation: That variation was removed. Pick another one.',
    ])
  })

  it('A8 (logic) rule order in the model = targeting order in the output', () => {
    const r1 = rule('first', and(c('a', 'pr')))
    const r2 = rule('second', and(c('b', 'pr')))
    const names = (rules: Array<Rule>) =>
      toFlagJson(validFlag({ rules })).targeting?.map((r) => r.name)
    expect(names([r1, r2])).toEqual(['first', 'second'])
    expect(names([r2, r1])).toEqual(['second', 'first'])
  })

  it('A9 disabled → "disable": true; enabled → no disable key', () => {
    expect(toFlagJson(validFlag({ disable: true })).disable).toBe(true)
    expect(toFlagJson(validFlag({ disable: false }))).not.toHaveProperty(
      'disable',
    )
  })

  it('A10 description → metadata.description (trimmed)', () => {
    expect(
      toFlagJson(validFlag({ description: '  New checkout  ' })).metadata,
    ).toEqual({ description: 'New checkout' })
  })

  it('A11 reference flags equal the stored fixture (values, key order, formatting)', () => {
    let n = 0
    const ids = () => `ref-${++n}`
    const main: Flag = {
      ...newFlag('my-new-feature', ids),
      variations: [
        { id: 'on', name: 'on', value: 'true' },
        { id: 'off', name: 'off', value: 'false' },
      ],
      rules: [
        {
          id: 'r1',
          name: 'Beta users',
          tree: and(c('group', 'eq', 'beta')),
          serve: serveSplit({ on: 50, off: 50 }),
        },
        {
          id: 'r2',
          name: 'Editors in TH',
          tree: and(
            c('role', 'in', 'admin, editor'),
            or(
              c('country', 'eq', 'TH'),
              not(and(c('app_version', 'lt', '2.0.0'))),
            ),
          ),
          serve: serveVar('on'),
        },
      ],
      defaultRule: serveVar('off'),
      disable: true,
      trackEvents: false,
      version: '1.0.0',
      description: 'New checkout page',
      metadata: [{ id: 'm1', key: 'jira', value: 'FF-12' }],
    }
    const simple = newFlag('simple-flag', ids)
    simple.defaultRule = serveVar(simple.variations[0].id)

    const values: EditorValues = { flags: [main, simple] }
    expect(editorSchema.safeParse(values).success).toBe(true)
    const file = toFlagFile(values)
    expect(file).toEqual(JSON.parse(expectedText))
    // CRLF-safe: git may check the fixture out with Windows line endings
    expect(JSON.stringify(file, null, 2)).toBe(
      expectedText.replace(/\r\n/g, '\n').trim(),
    )
  })
})
