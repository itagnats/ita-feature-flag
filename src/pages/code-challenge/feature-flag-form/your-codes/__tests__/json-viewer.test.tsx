// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { JsonViewer, MONACO_TIMEOUT_MS } from '../components/preview/JsonViewer'

const editor = vi.hoisted(() => ({ mounts: true }))

// a stand-in editor: it mounts at once, or never (CDN blocked)
vi.mock('@monaco-editor/react', async () => {
  const { useEffect } = await import('react')
  return {
    default: ({ value, onMount }: { value: string; onMount?: () => void }) => {
      useEffect(() => {
        if (editor.mounts) onMount?.()
      }, [onMount])
      return editor.mounts ? <pre data-testid="monaco">{value}</pre> : null
    },
  }
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  editor.mounts = true
})

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('JsonViewer fallback', () => {
  it('shows plain JSON with a note when the editor never mounts', () => {
    editor.mounts = false
    render(<JsonViewer json={'{\n  "a": 1\n}'} />)
    wait(MONACO_TIMEOUT_MS - 1)
    expect(screen.queryByText(/Code viewer unavailable/)).toBeNull()
    wait(1)
    expect(
      screen.getByText(
        'Code viewer unavailable (offline?) — showing plain JSON.',
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText('Flag JSON preview').textContent).toBe(
      '{\n  "a": 1\n}',
    )
  })

  it('keeps the editor when it mounted in time', () => {
    render(<JsonViewer json="{}" />)
    wait(MONACO_TIMEOUT_MS * 2)
    expect(screen.getByTestId('monaco')).toBeTruthy()
    expect(screen.queryByText(/Code viewer unavailable/)).toBeNull()
  })
})
