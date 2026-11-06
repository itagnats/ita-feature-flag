import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import type { StandardSchemaV1 } from '@tanstack/react-form'
import { editorSchema } from '../model/schema'
import type { EditorValues, Flag, Rule } from '../model/schema'
import { initialValues } from '../model/defaults'

// Two reasons not to pass `editorSchema` itself:
// 1. its recursive type is too deep for TanStack Form to infer, so it is typed by what it checks;
// 2. TanStack devtools JSON-serialises the form options, and the recursive schema object is
//    circular (it crashed the dev server). This plain wrapper only holds a function.
const validator: StandardSchemaV1<EditorValues> = {
  '~standard': {
    version: 1,
    vendor: 'zod',
    validate: (value) => editorSchema['~standard'].validate(value),
  },
}

/**
 * Form values as TanStack Form sees them. The condition tree is recursive, and TanStack's
 * typed field paths cannot follow an endless type, so `tree` is opaque here; rule-tree fields
 * are addressed by string path (see path-access.ts). At runtime the values are exactly EditorValues.
 */
type FormRule = Omit<Rule, 'tree'> & { tree: unknown }
export interface FormValues {
  flags: Array<Omit<Flag, 'rules'> & { rules: Array<FormRule> }>
}

/** The one place the opaque `tree` is put back (same data, see FormValues). */
export const toEditorValues = (values: FormValues) => values as EditorValues

// Module constant: same object on every render, same ids on server and client.
const DEFAULT_VALUES = initialValues()

/** One form for the whole file (all flags). The Zod schema validates on every change. */
export function useEditorForm() {
  const form = useForm({
    defaultValues: DEFAULT_VALUES as FormValues,
    validators: { onChange: validator },
  })
  // validate once on mount so the badge is honest before the first edit
  useEffect(() => {
    void form.validate('change')
  }, [form])
  return form
}

export type EditorForm = ReturnType<typeof useEditorForm>

/** Number of schema issues, from the form-level validation result (`{ path: issues[] }`). */
export function countErrors(state: { errorMap: { onChange?: unknown } }) {
  const byPath = state.errorMap.onChange
  if (!byPath || typeof byPath !== 'object') return 0
  return Object.values(byPath).reduce<number>(
    (sum, issues) => sum + (Array.isArray(issues) ? issues.length : 1),
    0,
  )
}
