import type { AnyFieldApi } from '@tanstack/react-form'
import type { ChangeEvent } from 'react'

const messageOf = (e: unknown): string =>
  typeof e === 'string'
    ? e
    : ((e as { message?: string } | null)?.message ?? '')

/** Messages to show under a field: only once the user has touched it. */
export function fieldErrors(field: AnyFieldApi, always = false): Array<string> {
  const { isTouched, errors } = field.state.meta
  if (!isTouched && !always) return []
  return [...new Set(errors.map(messageOf).filter(Boolean))]
}

/** The one required-field marker. Decorative: never put it inside an aria-label. */
export function Required() {
  return (
    <span aria-hidden className="text-destructive">
      {' '}
      *
    </span>
  )
}

/** Extra classes for a shadcn SelectTrigger so it matches Input exactly: full width, same text
 * size (16px on phones to stop iOS zoom, 14px from md), and the same dark hover background.
 */
export const SELECT_LIKE_INPUT =
  'w-full min-w-0 text-base md:text-sm dark:hover:bg-input/30'

const errorId = (field: AnyFieldApi) => `${field.name}-error`

/** Props that bind an Input/Textarea to a field, with the aria wiring for its error. */
export function inputProps(field: AnyFieldApi, ariaLabel?: string) {
  const invalid = fieldErrors(field).length > 0
  return {
    id: field.name,
    name: field.name,
    value: field.state.value as string,
    onBlur: field.handleBlur,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      field.handleChange(e.target.value),
    'aria-label': ariaLabel,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? errorId(field) : undefined,
  }
}

/** `always`: show without waiting for a touch (for messages about a whole group or split). */
export function FieldError({
  field,
  always,
}: {
  field: AnyFieldApi
  always?: boolean
}) {
  const messages = fieldErrors(field, always)
  if (!messages.length) return null
  return (
    <p id={errorId(field)} className="text-destructive text-xs">
      {messages.join(' ')}
    </p>
  )
}
