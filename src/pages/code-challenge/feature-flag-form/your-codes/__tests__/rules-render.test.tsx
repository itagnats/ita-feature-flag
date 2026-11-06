// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import FeatureFlagEditor from '../components/FeatureFlagEditor'
import { splitEvenly } from '../model/defaults'

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

interface Targeting {
  name: string
  query?: string
}
const targeting = () =>
  (
    JSON.parse(screen.getByTestId('preview').textContent) as {
      flags: Record<string, { targeting?: Array<Targeting> }>
    }
  ).flags['my-first-flag'].targeting ?? []

const addRule = () => fireEvent.click(screen.getByText('Add Rule'))
const rule = (n: number) => screen.getByRole('listitem', { name: `Rule ${n}` })
// Radix Select needs a few DOM APIs that jsdom lacks.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {},
})

/** Open the operator select with the keyboard and pick the option whose text starts with `key`. */
const pickOperator = (trigger: HTMLElement, key: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(
    screen.getByRole('option', {
      name: (name) => name.startsWith(`${key} (`),
    }),
  )
}
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } })

describe('targeting rules', () => {
  it('adds a rule named "Rule 1" that reaches the preview', () => {
    render(<FeatureFlagEditor />)
    expect(targeting()).toEqual([])
    addRule()
    expect(targeting().map((t) => t.name)).toEqual(['Rule 1'])
    addRule()
    expect(targeting().map((t) => t.name)).toEqual(['Rule 1', 'Rule 2'])
  })

  it('compiles a nested NOT group in the query preview', () => {
    render(<FeatureFlagEditor />)
    addRule()
    const root = within(rule(1)).getByRole('group', { name: 'Group 1' })
    type(within(root).getAllByLabelText('Condition 1 field')[0], 'plan')
    type(within(root).getAllByLabelText('Condition 1 value')[0], 'pro')
    fireEvent.click(within(root).getByText('Group'))

    const nested = within(rule(1)).getByRole('group', { name: 'Group 2' })
    fireEvent.click(within(nested).getByText('NOT'))
    type(within(nested).getByLabelText('Condition 1 field'), 'country')
    type(within(nested).getByLabelText('Condition 1 value'), 'TH')

    expect(within(rule(1)).getByText(/plan eq/).textContent).toContain(
      'plan eq "pro" and not (country eq "TH")',
    )
    expect(targeting()[0].query).toBe('plan eq "pro" and not (country eq "TH")')
  })

  it('hides the value input for the pr operator', () => {
    render(<FeatureFlagEditor />)
    addRule()
    expect(within(rule(1)).getByLabelText('Condition 1 value')).toBeTruthy()
    pickOperator(within(rule(1)).getByLabelText('Condition 1 operator'), 'pr')
    expect(within(rule(1)).queryByLabelText('Condition 1 value')).toBeNull()
  })

  it('shows the "in" placeholder and hides "+ Group" at depth 5', () => {
    render(<FeatureFlagEditor />)
    addRule()
    pickOperator(within(rule(1)).getByLabelText('Condition 1 operator'), 'in')
    expect(
      within(rule(1)).getByLabelText('Condition 1 values, comma-separated'),
    ).toHaveProperty('placeholder', 'a, b, c *')
    for (let depth = 1; depth < 5; depth++) {
      const g = within(rule(1)).getByRole('group', { name: `Group ${depth}` })
      fireEvent.click(within(g).getAllByText('Group').at(-1)!)
    }
    const deepest = within(rule(1)).getByRole('group', { name: 'Group 5' })
    expect(within(deepest).queryByText('Group')).toBeNull()
  })

  it("reorders rules with the move buttons and keeps each rule's inputs", () => {
    render(<FeatureFlagEditor />)
    addRule()
    addRule()
    type(within(rule(1)).getByLabelText('Condition 1 field'), 'first')
    type(within(rule(1)).getByLabelText('Condition 1 value'), '1')
    fireEvent.click(screen.getByLabelText('Move rule 1 down'))
    expect(targeting().map((t) => t.name)).toEqual(['Rule 2', 'Rule 1'])
    // the rule with the "first" condition is now second, and shows its own values
    expect(within(rule(2)).getByLabelText('Condition 1 field')).toHaveProperty(
      'value',
      'first',
    )
    expect(within(rule(2)).getByLabelText('Rule 2 name')).toHaveProperty(
      'value',
      'Rule 1',
    )
  })

  it('disables Percentage with one variation', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByLabelText('Delete variation 2'))
    expect(screen.getByRole('button', { name: 'Percentage' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows the split total and its error until it adds up to 100', () => {
    render(<FeatureFlagEditor />)
    addRule()
    const r = within(rule(1))
    fireEvent.click(r.getByRole('button', { name: 'Percentage' }))
    expect(r.getByText('100%')).toBeTruthy()
    type(r.getByLabelText('Rule 1: Variation_1 percentage'), '30')
    expect(r.getByText('80%')).toBeTruthy()
    expect(
      r.getByText(
        'Percentages must add up to 100% (now 80%). Adjust them or press Split evenly.',
      ),
    ).toBeTruthy()
  })

  it('serves a picked variation (radio pills)', () => {
    render(<FeatureFlagEditor />)
    addRule()
    fireEvent.click(within(rule(1)).getByLabelText('Variation_2'))
    expect(
      within(rule(1)).getByText('Variation_2', { selector: 'span.max-w-32' }),
    ).toBeTruthy()
  })
})

describe('splitEvenly', () => {
  it('adds up to 100 and gives the remainder to the first', () => {
    expect(splitEvenly(['a', 'b'])).toEqual({ a: 50, b: 50 })
    expect(splitEvenly(['a', 'b', 'c'])).toEqual({
      a: 33.34,
      b: 33.33,
      c: 33.33,
    })
  })
})
