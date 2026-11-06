// @vitest-environment jsdom
/*
 * Acceptance checks through the real components (jsdom, Monaco mocked).
 * A12 uses React <Profiler>: RuleCard / ConditionRow / VariationsPanel are wrapped (module mock)
 * in memo(props => <Profiler><Original {...props} /></Profiler>). memo keeps the same props
 * check as the original, and a Profiler reports every commit inside its subtree (also renders
 * caused by the original's own store subscriptions). Positive controls prove the counter fires.
 */
import { Profiler, memo } from 'react'
import type {
  ComponentProps,
  ComponentType,
  ProfilerOnRenderCallback,
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import FeatureFlagEditor from '../components/FeatureFlagEditor'
import type * as ServeBadgeModule from '../components/serve/ServeBadge'
import type * as RuleCardModule from '../components/rules/RuleCard'
import type * as ConditionRowModule from '../components/rules/ConditionRow'
import type * as QueryPreviewModule from '../components/rules/QueryPreview'
import type * as VariationsPanelModule from '../components/flag/VariationsPanel'

const renders = vi.hoisted(() => new Map<string, number>())
/** ServeChip is a plain (non-memo) child of RuleCard: it runs exactly when a RuleCard body runs. */
const chip = vi.hoisted(() => new Map<string, number>())

vi.mock('../components/serve/ServeBadge', async (importOriginal) => {
  const mod = await importOriginal<typeof ServeBadgeModule>()
  return {
    ...mod,
    ServeChip: (p: ComponentProps<typeof mod.ServeChip>) => {
      if (p.path.includes('rules'))
        chip.set(p.path, (chip.get(p.path) ?? 0) + 1)
      return mod.ServeChip(p)
    },
  }
})

/** memo + Profiler around the original component; counts commits per `key(props)`. */
function counted<TProps extends object>(
  Original: ComponentType<TProps>,
  key: (p: TProps) => string,
) {
  const onRender: ProfilerOnRenderCallback = (id) =>
    renders.set(id, (renders.get(id) ?? 0) + 1)
  return memo((props: TProps) => (
    <Profiler id={key(props)} onRender={onRender}>
      <Original {...props} />
    </Profiler>
  ))
}

vi.mock('../components/rules/RuleCard', async (importOriginal) => {
  const mod = await importOriginal<typeof RuleCardModule>()
  return {
    RuleCard: counted(
      mod.RuleCard,
      (p: ComponentProps<typeof mod.RuleCard>) => `rule:${p.id}`,
    ),
  }
})
vi.mock('../components/rules/ConditionRow', async (importOriginal) => {
  const mod = await importOriginal<typeof ConditionRowModule>()
  return {
    ConditionRow: counted(
      mod.ConditionRow,
      (p: ComponentProps<typeof mod.ConditionRow>) => `cond:${p.path}`,
    ),
  }
})
vi.mock('../components/rules/QueryPreview', async (importOriginal) => {
  const mod = await importOriginal<typeof QueryPreviewModule>()
  return {
    QueryPreview: (p: ComponentProps<typeof mod.QueryPreview>) => {
      chip.set('query', (chip.get('query') ?? 0) + 1)
      return mod.QueryPreview(p)
    },
  }
})
vi.mock('../components/flag/VariationsPanel', async (importOriginal) => {
  const mod = await importOriginal<typeof VariationsPanelModule>()
  return {
    VariationsPanel: counted(
      mod.VariationsPanel,
      (p: ComponentProps<typeof mod.VariationsPanel>) =>
        `variations:${p.index}`,
    ),
  }
})
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="preview">{value}</pre>
  ),
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

afterEach(cleanup)
beforeEach(() => renders.clear())

interface OutFlag {
  variations: Record<string, unknown>
  targeting?: Array<{ name: string; query?: string; variation?: string }>
  defaultRule: { variation?: string; percentage?: Record<string, number> }
  disable?: boolean
  metadata?: Record<string, string>
}
const out = () =>
  JSON.parse(screen.getByTestId('preview').textContent) as {
    flags: Record<string, OutFlag>
  }
const flag = (key = 'my-first-flag') => out().flags[key]
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } })
const addRule = () => fireEvent.click(screen.getAllByText('Add Rule')[0])
const rule = (n: number) => screen.getByRole('listitem', { name: `Rule ${n}` })
const count = (prefix: string) =>
  [...renders.entries()]
    .filter(([k]) => k.startsWith(prefix))
    .reduce((s, [, v]) => s + v, 0)
const badge = () => screen.getByText(/^\d+ errors?$|^Valid$/).textContent

describe('A2 preview follows variations instantly', () => {
  it('add → new key in the same render pass; remove → gone', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Variation'))
    expect(Object.keys(flag().variations)).toEqual([
      'Variation_1',
      'Variation_2',
      'Variation_3',
    ])
    fireEvent.click(screen.getByLabelText('Delete variation 1'))
    expect(Object.keys(flag().variations)).toEqual([
      'Variation_2',
      'Variation_3',
    ])
  })

  it('rename a variation → rule and default rule follow the new name', () => {
    render(<FeatureFlagEditor />)
    addRule()
    fireEvent.click(within(rule(1)).getByLabelText('Variation_2'))
    const def = screen.getByRole('radiogroup', {
      name: 'Default rule: variation to serve',
    })
    fireEvent.click(within(def).getByLabelText('Variation_1'))
    type(screen.getByLabelText('Variation 2 name'), 'beta')
    expect(flag().targeting?.[0].variation).toBe('beta')
    type(screen.getByLabelText('Variation 1 name'), 'stable')
    expect(flag().defaultRule).toEqual({ variation: 'stable' })
  })
})

describe('A3 duplicate variation name', () => {
  it('error under the second name field, aria-invalid, badge counts it', () => {
    render(<FeatureFlagEditor />)
    const second = screen.getByLabelText('Variation 2 name')
    type(second, 'Variation_1')
    expect(second.getAttribute('aria-invalid')).toBe('true')
    const msg = '"Variation_1" is already used. Use a different name.'
    expect(
      document.getElementById(second.getAttribute('aria-describedby')!)
        ?.textContent,
    ).toBe(msg)
    expect(screen.getAllByText(msg)).toHaveLength(2) // inline + summary
  })
})

describe('A7 delete a variation that rules use', () => {
  it('rule and default rule both get an error; badge shows it', () => {
    render(<FeatureFlagEditor />)
    addRule()
    fireEvent.click(within(rule(1)).getByLabelText('Variation_2'))
    const def = screen.getByRole('radiogroup', {
      name: 'Default rule: variation to serve',
    })
    fireEvent.click(within(def).getByLabelText('Variation_2'))
    type(within(rule(1)).getByLabelText('Condition 1 field'), 'role')
    type(within(rule(1)).getByLabelText('Condition 1 value'), 'admin')
    expect(badge()).toBe('Valid')

    fireEvent.click(screen.getByLabelText('Delete variation 2'))
    expect(
      screen.getAllByText('That variation was removed. Pick another one.')
        .length,
    ).toBeGreaterThanOrEqual(2) // summary has 2 entries (rule + default)
    expect(badge()).toBe('2 errors')
    expect(within(rule(1)).getByText('not set')).toBeTruthy()
    // output never points at the removed name
    expect(screen.getByTestId('preview').textContent).not.toContain(
      'Variation_2',
    )
  })
})

describe('A9 / A10 settings reach the JSON', () => {
  it('Disabled switch on → "disable": true; off again → key removed', () => {
    render(<FeatureFlagEditor />)
    const sw = screen.getByRole('switch', { name: 'Disabled' })
    expect(flag().disable).toBeUndefined()
    fireEvent.click(sw)
    expect(flag().disable).toBe(true)
    fireEvent.click(sw)
    expect(flag().disable).toBeUndefined()
  })

  it('Track events off → "trackEvents": false; version written trimmed', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByRole('switch', { name: 'Track events' }))
    type(screen.getByLabelText('Version'), ' 1.2.0 ')
    expect(screen.getByTestId('preview').textContent).toContain(
      '"trackEvents": false',
    )
    expect(screen.getByTestId('preview').textContent).toContain(
      '"version": "1.2.0"',
    )
  })

  it('Thai + emoji description → metadata.description unchanged', () => {
    render(<FeatureFlagEditor />)
    type(screen.getByLabelText('Description'), 'ทดสอบ 🚀 "quoted"')
    expect(flag().metadata).toEqual({ description: 'ทดสอบ 🚀 "quoted"' })
  })

  it('metadata key "description" is rejected under the field', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Metadata'))
    type(screen.getByLabelText('Metadata 1 key'), 'description')
    expect(
      screen.getAllByText(
        '"description" is set by the Description field. Use another key.',
      ).length,
    ).toBeGreaterThanOrEqual(1)
  })
})

describe('A8 reorder (UI)', () => {
  it('move up/down buttons change targeting order; ends are disabled', () => {
    render(<FeatureFlagEditor />)
    addRule()
    addRule()
    addRule()
    expect(screen.getByLabelText('Move rule 1 up')).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByLabelText('Move rule 3 down')).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.click(screen.getByLabelText('Move rule 3 up'))
    fireEvent.click(screen.getByLabelText('Move rule 2 up'))
    expect(flag().targeting?.map((t) => t.name)).toEqual([
      'Rule 3',
      'Rule 1',
      'Rule 2',
    ])
  })
})

describe('multi-flag', () => {
  it('second flag in JSON; duplicate key → error under its name field', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add another flag'))
    expect(Object.keys(out().flags)).toEqual(['my-first-flag', 'new-flag-1'])
    const names = screen.getAllByLabelText('Flag Name *')
    type(names[1], 'my-first-flag')
    expect(
      screen.getAllByText(
        'Another flag already uses "my-first-flag". Use a different name.',
      ).length,
    ).toBe(2)
  })
})

describe('exploratory', () => {
  it('a new variation on a boolean flag starts with a valid value (switch shows a state)', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Variation'))
    // Expected: a boolean variation is created as true/false, like the switch suggests.
    const preview = flag().variations
    expect(typeof preview.Variation_3).toBe('boolean')
  })

  it('a blank percentage, then switching the rule back to Variation, leaves no hidden error', () => {
    render(<FeatureFlagEditor />)
    addRule()
    const r = within(rule(1))
    type(r.getByLabelText('Condition 1 field'), 'role')
    type(r.getByLabelText('Condition 1 value'), 'admin')
    const def = screen.getByRole('radiogroup', {
      name: 'Default rule: variation to serve',
    })
    fireEvent.click(within(def).getByLabelText('Variation_1'))
    fireEvent.click(r.getByRole('button', { name: 'Percentage' }))
    type(r.getByLabelText('Rule 1: Variation_2 percentage'), '')
    fireEvent.click(r.getByRole('button', { name: 'Variation' }))
    fireEvent.click(r.getByLabelText('Variation_1'))
    // the output serves Variation_1 only: the old split is not written
    expect(flag().targeting?.[0]).toEqual({
      name: 'Rule 1',
      query: 'role eq "admin"',
      variation: 'Variation_1',
    })
    expect(badge()).toBe('Valid')
  })

  it('a blank percentage on a variation that is then deleted leaves no hidden error', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Variation'))
    fireEvent.click(screen.getByRole('switch', { name: 'Variation 3 value' }))
    // the last Percentage button belongs to the Default Rule (no rules yet)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Percentage' }).at(-1)!,
    )
    type(screen.getByLabelText('Default rule: Variation_3 percentage'), '')
    type(screen.getByLabelText('Default rule: Variation_1 percentage'), '50')
    type(screen.getByLabelText('Default rule: Variation_2 percentage'), '50')
    fireEvent.click(screen.getByLabelText('Delete variation 3'))
    expect(flag().defaultRule).toEqual({
      percentage: { Variation_1: 50, Variation_2: 50 },
    })
    expect(badge()).toBe('Valid')
  })
})

describe('A12 re-renders (React Profiler)', () => {
  /** Two rules; with `valid`, every condition and serve is filled so no field has an error. */
  const setupTwoRules = (valid: boolean) => {
    render(<FeatureFlagEditor />)
    addRule()
    addRule()
    if (valid) {
      for (const n of [1, 2]) {
        const r = within(rule(n))
        type(r.getByLabelText('Condition 1 field'), `attr${n}`)
        type(r.getByLabelText('Condition 1 value'), 'x')
        fireEvent.click(r.getByLabelText('Variation_1'))
      }
      const def = screen.getByRole('radiogroup', {
        name: 'Default rule: variation to serve',
      })
      fireEvent.click(within(def).getByLabelText('Variation_2'))
      expect(badge()).toBe('Valid')
    }
    renders.clear()
    chip.clear()
  }
  const ruleIds = () => [...renders.keys()].filter((k) => k.startsWith('rule:'))

  it('positive control: typing in rule 1 condition commits rule 1 and its row', () => {
    setupTwoRules(true)
    type(within(rule(1)).getByLabelText('Condition 1 field'), 'role')
    expect(count('rule:')).toBeGreaterThan(0)
    expect(count('cond:flags[0].rules[0]')).toBeGreaterThan(0)
  })

  it('positive control: moving a rule re-runs RuleCard bodies, so the ServeChip counter is live', () => {
    setupTwoRules(false)
    fireEvent.click(screen.getByLabelText('Move rule 2 up'))
    const rulePaths = [...chip.keys()].filter((k) => k.includes('rules'))
    expect(rulePaths.length).toBeGreaterThan(0)
  })

  it('positive control: typing in rule 1 condition re-runs QueryPreview', () => {
    setupTwoRules(false)
    type(within(rule(1)).getByLabelText('Condition 1 field'), 'role')
    expect(chip.get('query') ?? 0).toBeGreaterThan(0)
  })

  it('typing in the flag key never re-renders a RuleCard body (ServeChip render count)', () => {
    setupTwoRules(false)
    const key = screen.getByLabelText('Flag Name *')
    for (const v of ['a', 'ab', 'abc', 'abcd']) type(key, v)
    expect(flag('abcd')).toBeTruthy()
    expect(Object.fromEntries(chip)).toEqual({})
  })

  it('valid form: typing in the flag key commits nothing under any rule or the variations panel', () => {
    setupTwoRules(true)
    const key = screen.getByLabelText('Flag Name *')
    for (const v of ['a', 'ab', 'abc', 'abcd']) type(key, v)
    expect(flag('abcd')).toBeTruthy()
    expect(Object.fromEntries(renders)).toEqual({})
  })

  it('valid form: typing in rule 1 condition never commits rule 2', () => {
    setupTwoRules(true)
    const field = within(rule(1)).getByLabelText('Condition 1 field')
    for (const v of ['r', 'ro', 'rol', 'role']) type(field, v)
    expect(ruleIds()).toHaveLength(1) // only rule 1
    expect(count('cond:flags[0].rules[1]')).toBe(0)
    expect(count('variations:')).toBe(0)
  })

  // Accepted limitation: while a field has a validation error, its form.Field render-prop re-runs
  // on every keystroke anywhere in the form (form-level onChange validation hands it a fresh
  // errors array; TanStack behaviour), so Profiler commits under a RuleCard are expected. What holds
  // for an invalid form: no RuleCard body (ServeChip runs only with it) or QueryPreview re-renders.
  it('invalid form: typing in the flag key does not re-render RuleCard bodies, QueryPreview or ServeChip', () => {
    setupTwoRules(false)
    const key = screen.getByLabelText('Flag Name *')
    for (const v of ['a', 'ab', 'abc', 'abcd']) type(key, v)
    expect(Object.fromEntries(chip)).toEqual({}) // no ServeChip, no QueryPreview
  })
})
