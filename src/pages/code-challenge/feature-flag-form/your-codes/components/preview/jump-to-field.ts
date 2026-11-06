import { touchField } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'

const FOCUSABLE = 'input, select, textarea, button, [tabindex]'
const MAX_FRAMES = 10

/**
 * The toggle clicks re-render on a later frame, and browsers ignore focus() on an element that
 * is still inside a `hidden` ancestor, so wait (bounded) until nothing hides it any more.
 */
async function untilRendered(el: HTMLElement) {
  for (let i = 0; i < MAX_FRAMES && el.closest('[hidden]'); i++)
    await new Promise(requestAnimationFrame)
}

/**
 * Brings the field named `fieldName` (its DOM id) into view: opens every collapsed card around
 * it, marks it touched so its inline error shows, scrolls to it and focuses it.
 * Collapsed bodies are `hidden` and their toggle button points at them with `aria-controls`,
 * so a click on that button is all it takes, with no shared state between the cards.
 */
export async function jumpToField(form: EditorForm, fieldName: string) {
  const el = document.getElementById(fieldName)
  if (!el) return
  for (let box = el.parentElement; box; box = box.parentElement) {
    if (box.hidden && box.id)
      document
        .querySelector<HTMLElement>(`[aria-controls="${box.id}"]`)
        ?.click()
  }
  touchField(form, fieldName)
  await untilRendered(el)
  // groups and radio lists are not focusable themselves: use their first control
  const target = el.matches(FOCUSABLE)
    ? el
    : el.querySelector<HTMLElement>(FOCUSABLE)
  ;(target ?? el).scrollIntoView({ block: 'center' })
  target?.focus({ preventScroll: true })
}
