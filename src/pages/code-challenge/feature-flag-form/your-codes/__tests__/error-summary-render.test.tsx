// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import FeatureFlagEditor from '../components/FeatureFlagEditor'

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
const scrollIntoView = vi.fn()
Element.prototype.scrollIntoView = scrollIntoView

afterEach(() => {
  cleanup()
  scrollIntoView.mockClear()
})

const summary = () => screen.queryByRole('region', { name: 'Error summary' })
const rule = (n: number) => screen.getByRole('listitem', { name: `Rule ${n}` })
const ATTRIBUTE = 'Enter an attribute, e.g. role.'

/** A new rule starts with an empty condition: invalid, but not touched yet. */
function withEmptyRule() {
  render(<FeatureFlagEditor />)
  fireEvent.click(screen.getByText('Add Rule'))
}
const jumpTo = (label: string) =>
  fireEvent.click(within(summary()!).getByText(label).closest('button')!)

describe('error summary', () => {
  it('lists each issue (where + how to fix) and disappears once all are fixed', async () => {
    render(<FeatureFlagEditor />)
    // the starting flag has no default variation chosen yet
    const box = within(summary()!)
    expect(box.getByText('Fix 1 issue to get a valid config')).toBeTruthy()
    expect(
      box.getByText('my-first-flag › Default rule › Variation'),
    ).toBeTruthy()
    expect(box.getByText('Pick a variation to serve.')).toBeTruthy()

    jumpTo('my-first-flag › Default rule › Variation')
    const radios = screen.getAllByRole('radio', { name: /Variation_1/ })
    await waitFor(() =>
      expect(document.activeElement).toBe(radios[radios.length - 1]),
    )
    fireEvent.click(document.activeElement!)
    expect(summary()).toBeNull()
    expect(screen.getByText('Valid')).toBeTruthy()
  })

  it('counts every issue and matches the badge', () => {
    withEmptyRule()
    // empty attribute, empty value, no variation on the rule, none on the default rule
    expect(screen.getByText('Fix 4 issues to get a valid config')).toBeTruthy()
    expect(screen.getByText('4 errors')).toBeTruthy()
  })

  it('focuses the field and shows its inline error when an item is clicked', async () => {
    withEmptyRule()
    const field = within(rule(1)).getByLabelText('Condition 1 field')
    expect(within(rule(1)).queryByText(ATTRIBUTE)).toBeNull() // untouched
    jumpTo(
      'my-first-flag › Rule 1 "Rule 1" › Group 1 › Condition 1 › Attribute',
    )
    await waitFor(() => expect(document.activeElement).toBe(field))
    expect(within(rule(1)).getByText(ATTRIBUTE)).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('shows the inline error right after a jump, as in the dev app (StrictMode)', async () => {
    render(
      <StrictMode>
        <FeatureFlagEditor />
      </StrictMode>,
    )
    fireEvent.click(screen.getByText('Add Rule'))
    const field = within(rule(1)).getByLabelText('Condition 1 field')
    jumpTo(
      'my-first-flag › Rule 1 "Rule 1" › Group 1 › Condition 1 › Attribute',
    )
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(field.getAttribute('aria-describedby')).toBe(`${field.id}-error`)
    expect(document.getElementById(`${field.id}-error`)?.textContent).toBe(
      ATTRIBUTE,
    )
  })

  it('opens a collapsed rule before focusing a field inside it', async () => {
    withEmptyRule()
    fireEvent.click(screen.getByLabelText('Collapse rule 1'))
    expect(
      screen.getByLabelText('Expand rule 1').getAttribute('aria-expanded'),
    ).toBe('false')
    jumpTo('my-first-flag › Rule 1 "Rule 1" › Group 1 › Condition 1 › Value')
    expect(screen.getByLabelText('Collapse rule 1')).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(rule(1)).getByLabelText('Condition 1 value'),
      ),
    )
  })

  it('opens a collapsed flag card (and the rule inside it)', async () => {
    withEmptyRule()
    fireEvent.click(screen.getByLabelText('Collapse rule 1'))
    fireEvent.click(screen.getByLabelText('Collapse flag'))
    jumpTo(
      'my-first-flag › Rule 1 "Rule 1" › Group 1 › Condition 1 › Attribute',
    )
    expect(screen.getByLabelText('Collapse flag')).toBeTruthy()
    expect(screen.getByLabelText('Collapse rule 1')).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(rule(1)).getByLabelText('Condition 1 field'),
      ),
    )
  })

  it('"Show all" reveals every inline error at once', async () => {
    withEmptyRule()
    expect(within(rule(1)).queryByText(ATTRIBUTE)).toBeNull()
    fireEvent.click(screen.getByText('Show all'))
    expect(await within(rule(1)).findByText(ATTRIBUTE)).toBeTruthy()
    expect(within(rule(1)).getByText('Enter a value.')).toBeTruthy()
  })

  it('collapses from its header, and the badge reopens it and scrolls to it', () => {
    withEmptyRule()
    const toggle = screen.getByText(/Fix 4 issues/).closest('button')!
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByText('4 errors'))
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalled()
  })
})
