import { describe, expect, it } from 'vitest'
import { toFlagFile, toFlagJson } from '../logic/flag-json'
import { initialValues, newFlag } from '../model/defaults'
import { and, c, serveSplit, serveVar, validFlag } from './helpers'

describe('toFlagJson', () => {
  it('writes the GOFF defaults compactly (no disable/trackEvents/version/metadata)', () => {
    expect(toFlagJson(validFlag())).toEqual({
      variations: { on: true, off: false },
      defaultRule: { variation: 'off' },
    })
  })

  it('writes optional fields only when they differ from GOFF defaults', () => {
    const json = toFlagJson(
      validFlag({
        disable: true,
        trackEvents: false,
        version: ' 1.2.0 ',
        description: 'New dashboard',
        metadata: [
          { id: 'm1', key: 'jira', value: 'FF-1' },
          { id: 'm2', key: ' ', value: 'ignored' },
        ],
      }),
    )
    expect(json).toMatchObject({
      disable: true,
      trackEvents: false,
      version: '1.2.0',
      metadata: { jira: 'FF-1', description: 'New dashboard' },
    })
  })

  it('builds targeting rules with query + variation or percentage, in GOFF key order', () => {
    const json = toFlagJson(
      validFlag({
        rules: [
          {
            id: 'r1',
            name: 'Beta',
            tree: and(c('group', 'in', 'beta')),
            serve: serveVar('v-on'),
          },
          {
            id: 'r2',
            name: 'TH split',
            tree: and(c('country', 'eq', 'TH')),
            serve: serveSplit({ 'v-on': 30, 'v-off': 70 }),
          },
        ],
      }),
    )
    expect(Object.keys(json)).toEqual([
      'variations',
      'targeting',
      'defaultRule',
    ])
    expect(json.targeting).toEqual([
      { name: 'Beta', query: 'group in ["beta"]', variation: 'on' },
      {
        name: 'TH split',
        query: 'country eq "TH"',
        percentage: { on: 30, off: 70 },
      },
    ])
  })

  it('follows renames: rules point to variations by id', () => {
    const flag = validFlag({ defaultRule: serveVar('v-on') })
    flag.variations[0].name = 'enabled'
    expect(toFlagJson(flag).defaultRule).toEqual({ variation: 'enabled' })
  })

  it('types variation values by flag type', () => {
    const vs = (a: string, b: string) => [
      { id: 'v-on', name: 'a', value: a },
      { id: 'v-off', name: 'b', value: b },
    ]
    expect(
      toFlagJson(validFlag({ type: 'number', variations: vs('1', '0.5') }))
        .variations,
    ).toEqual({ a: 1, b: 0.5 })
    expect(
      toFlagJson(validFlag({ type: 'string', variations: vs('x', 'y') }))
        .variations,
    ).toEqual({
      a: 'x',
      b: 'y',
    })
    expect(
      toFlagJson(
        validFlag({ type: 'json', variations: vs('{"k":[1]}', '{oops') }),
      ).variations,
    ).toEqual({ a: { k: [1] }, b: '{oops' }) // invalid JSON stays raw in the preview
  })

  it('leaves an unchosen default rule empty, split includes every variation', () => {
    expect(
      toFlagJson(validFlag({ defaultRule: serveVar('') })).defaultRule,
    ).toEqual({})
    expect(
      toFlagJson(validFlag({ defaultRule: serveSplit({ 'v-on': 100 }) }))
        .defaultRule,
    ).toEqual({ percentage: { on: 100, off: 0 } })
  })
})

describe('toFlagFile', () => {
  it('always wraps flags in { flags: { … } } and supports several flags', () => {
    const file = toFlagFile({ flags: [validFlag(), newFlag('new-flag-1')] })
    expect(Object.keys(file)).toEqual(['flags'])
    expect(Object.keys(file.flags)).toEqual(['my-flag', 'new-flag-1'])
  })

  it('starts with the GOFF editor defaults', () => {
    expect(toFlagFile(initialValues())).toEqual({
      flags: {
        'my-first-flag': {
          variations: { Variation_1: true, Variation_2: false },
          defaultRule: {},
        },
      },
    })
  })
})
