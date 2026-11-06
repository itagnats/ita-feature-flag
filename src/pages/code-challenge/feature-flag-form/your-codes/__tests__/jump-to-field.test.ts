// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jumpToField } from '../components/preview/jump-to-field'
import type { EditorForm } from '../form/use-editor-form'

vi.mock('../form/path-access', () => ({ touchField: vi.fn() }))

const realFocus = HTMLElement.prototype.focus

afterEach(() => {
  HTMLElement.prototype.focus = realFocus
  document.body.innerHTML = ''
})

describe('jumpToField', () => {
  it('waits for a collapsed card to render before focusing', async () => {
    document.body.innerHTML = `
      <button id="toggle" aria-controls="body">toggle</button>
      <div id="body" hidden><input id="field" /></div>`
    const body = document.getElementById('body')!
    // React re-renders on a later frame, not synchronously in the click
    document.getElementById('toggle')!.addEventListener('click', () => {
      requestAnimationFrame(() => {
        body.hidden = false
      })
    })
    // like a real browser: focus() is a no-op inside a hidden ancestor
    HTMLElement.prototype.focus = function (this: HTMLElement, o) {
      if (!this.closest('[hidden]')) realFocus.call(this, o)
    }
    Element.prototype.scrollIntoView = vi.fn()

    await jumpToField({} as EditorForm, 'field')

    expect(document.activeElement).toBe(document.getElementById('field'))
  })
})
