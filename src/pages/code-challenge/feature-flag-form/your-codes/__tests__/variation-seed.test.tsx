// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
afterEach(cleanup)

const flag = () =>
  (
    JSON.parse(screen.getByTestId('preview').textContent) as {
      flags: Record<string, { defaultRule: { percentage?: object } }>
    }
  ).flags['my-first-flag']

describe('adding a variation to a split', () => {
  it('gives it 0% so the split stays at 100%', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Percentage' }))
    fireEvent.click(screen.getByText('Add Variation'))
    expect(flag().defaultRule.percentage).toEqual({
      Variation_1: 50,
      Variation_2: 50,
      Variation_3: 0,
    })
    expect(
      screen.getByLabelText('Default rule: Variation_3 percentage'),
    ).toHaveProperty('value', '0')
    expect(screen.queryByText('Enter a number.')).toBeNull()
  })

  it('leaves a serve in variation mode alone', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Variation'))
    expect(flag().defaultRule.percentage).toBeUndefined()
  })
})
