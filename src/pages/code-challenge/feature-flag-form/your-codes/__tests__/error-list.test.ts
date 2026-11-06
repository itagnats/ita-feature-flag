import { describe, expect, it } from 'vitest'
import { buildErrorList } from '../form/error-list'
import { editorSchema } from '../model/schema'
import type { EditorValues, Flag } from '../model/schema'
import { and, c, or, serveSplit, serveVar, validFlag } from './helpers'

/** The form-level error map TanStack builds from schema issues: `{ 'a[0].b': [issue] }`. */
function errorMap(values: EditorValues) {
  const result = editorSchema.safeParse(values)
  const map: Record<string, Array<{ message: string }>> = {}
  if (!result.success)
    for (const issue of result.error.issues) {
      const name = issue.path.reduce<string>(
        (acc, seg, i) =>
          typeof seg === 'number'
            ? `${acc}[${seg}]`
            : `${acc}${i ? '.' : ''}${String(seg)}`,
        '',
      )
      ;(map[name] ??= []).push(issue)
    }
  return map
}

const listFor = (...flags: Array<Flag>) => {
  const values = { flags }
  return buildErrorList(errorMap(values), values)
}
const rule = (name: string, tree: Flag['rules'][number]['tree']) => ({
  id: `r-${name}`,
  name,
  tree,
  serve: serveVar('v-on'),
})

describe('buildErrorList', () => {
  it('is empty for a valid config and for a missing error map', () => {
    expect(listFor(validFlag())).toEqual([])
    expect(buildErrorList(undefined, { flags: [validFlag()] })).toEqual([])
  })

  it('labels a flag name issue, falling back to "Flag N" while the key is empty', () => {
    const [item] = listFor(validFlag({ key: '' }))
    expect(item).toMatchObject({
      path: 'flags.0.key',
      fieldName: 'flags[0].key',
      label: 'Flag 1 › Settings › Flag name',
      message: 'Enter a flag name, e.g. my-flag.',
    })
  })

  it('labels variations, metadata and the flag it belongs to', () => {
    const items = listFor(
      validFlag({ key: 'first' }),
      validFlag({
        key: 'second',
        variations: [
          { id: 'v-on', name: 'on', value: 'true' },
          { id: 'v-off', name: '', value: 'false' },
        ],
        metadata: [{ id: 'm1', key: '', value: 'x' }],
        defaultRule: serveVar('v-on'),
      }),
    )
    expect(items.map((i) => [i.fieldName, i.label])).toEqual([
      ['flags[1].variations[1].name', 'second › Variations › #2 › Name'],
      ['flags[1].metadata[0].key', 'second › Metadata › #1 › Key'],
    ])
  })

  it('labels a nested condition with the rule name, group depth and condition number', () => {
    const tree = and(
      c('role', 'eq', 'x'),
      or(c('a', 'eq', 'y'), c('b', 'eq', '')),
    )
    const [item] = listFor(validFlag({ rules: [rule('Beta', tree)] }))
    expect(item.fieldName).toBe(
      'flags[0].rules[0].tree.children[1].children[1].value',
    )
    expect(item.path).toBe('flags.0.rules.0.tree.children.1.children.1.value')
    expect(item.label).toBe(
      'my-flag › Rule 1 "Beta" › Group 1 › Group 2 › Condition 2 › Value',
    )
  })

  it('labels an empty group, an attribute and a rule name', () => {
    const items = listFor(
      validFlag({
        rules: [rule('', and(c('', 'eq', 'x'), or()))],
      }),
    )
    expect(items.map((i) => [i.fieldName, i.label])).toEqual([
      ['flags[0].rules[0].name', 'my-flag › Rule 1 › Name'],
      [
        'flags[0].rules[0].tree.children[0].field',
        'my-flag › Rule 1 › Group 1 › Condition 1 › Attribute',
      ],
      [
        'flags[0].rules[0].tree.children[1].children',
        'my-flag › Rule 1 › Group 1 › Group 2 › Conditions',
      ],
    ])
  })

  it('labels serve problems for rules and the default rule', () => {
    const items = listFor(
      validFlag({
        rules: [
          { ...rule('A', and(c('a', 'eq', '1'))), serve: serveVar('') },
          {
            ...rule('B', and(c('a', 'eq', '1'))),
            serve: serveSplit({ 'v-on': 30, 'v-off': 30 }),
          },
        ],
        defaultRule: serveSplit({ 'v-on': 10, 'v-off': 10 }),
      }),
    )
    expect(items.map((i) => [i.fieldName, i.label])).toEqual([
      ['flags[0].rules[0].serve.variation', 'my-flag › Rule 1 "A" › Variation'],
      ['flags[0].rules[1].serve.percentages', 'my-flag › Rule 2 "B" › Split'],
      ['flags[0].defaultRule.percentages', 'my-flag › Default rule › Split'],
    ])
  })

  it('lists issues in reading order, whatever order they arrive in', () => {
    const values = {
      flags: [
        validFlag({
          key: '',
          rules: [rule('A', and(c('', 'eq', 'x')))],
          metadata: [{ id: 'm', key: '', value: '' }],
        }),
      ],
    }
    const map = errorMap(values)
    const reversed = Object.fromEntries(Object.entries(map).reverse())
    const names = buildErrorList(reversed, values).map((i) => i.fieldName)
    expect(names).toEqual([
      'flags[0].key',
      'flags[0].rules[0].tree.children[0].field',
      'flags[0].metadata[0].key',
    ])
  })
})
