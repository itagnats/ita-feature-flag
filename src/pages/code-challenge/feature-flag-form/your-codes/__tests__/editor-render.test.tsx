// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FeatureFlagEditor from '../components/FeatureFlagEditor'

// Monaco needs a real browser; the preview text is what matters here.
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="preview">{value}</pre>
  ),
}))

// jsdom has no ResizeObserver (Radix Switch uses it inside a <form>)
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

afterEach(cleanup)

const preview = () => screen.getByTestId('preview').textContent
const json = () => JSON.parse(preview()) as { flags: Record<string, unknown> }

describe('FeatureFlagEditor render smoke', () => {
  it('shows the GOFF defaults in the preview', () => {
    render(<FeatureFlagEditor />)
    expect(Object.keys(json().flags)).toEqual(['my-first-flag'])
    expect(screen.getByLabelText('Flag Name *')).toHaveProperty(
      'value',
      'my-first-flag',
    )
  })

  it('updates the preview when the flag name changes', () => {
    render(<FeatureFlagEditor />)
    fireEvent.change(screen.getByLabelText('Flag Name *'), {
      target: { value: 'checkout-v2' },
    })
    expect(Object.keys(json().flags)).toEqual(['checkout-v2'])
  })

  it('adds and removes variations', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add Variation'))
    expect(preview()).toContain('"Variation_3"')
    fireEvent.click(screen.getByLabelText('Delete variation 3'))
    expect(preview()).not.toContain('"Variation_3"')
  })

  it('keeps the last variation (delete disabled)', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByLabelText('Delete variation 2'))
    expect(screen.getByLabelText('Delete variation 1')).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows the error under an empty flag name and in the badge', () => {
    render(<FeatureFlagEditor />)
    fireEvent.change(screen.getByLabelText('Flag Name *'), {
      target: { value: '' },
    })
    // once under the field, once in the summary
    expect(
      screen.getAllByText('Enter a flag name, e.g. my-flag.'),
    ).toHaveLength(2)
    expect(
      screen.getByLabelText('Flag Name *').getAttribute('aria-invalid'),
    ).toBe('true')
    expect(screen.getByText(/\d+ errors?/)).toBeTruthy()
  })

  it('adds another flag as new-flag-1 and keeps one flag removable', () => {
    render(<FeatureFlagEditor />)
    fireEvent.click(screen.getByText('Add another flag'))
    expect(Object.keys(json().flags)).toEqual(['my-first-flag', 'new-flag-1'])
    expect(screen.getByLabelText('Remove flag 1')).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('writes a description to metadata', () => {
    render(<FeatureFlagEditor />)
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'hello' },
    })
    expect(preview()).toContain('"description": "hello"')
  })
})
