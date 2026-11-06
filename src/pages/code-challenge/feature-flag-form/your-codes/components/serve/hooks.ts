import type { EditorForm } from '../../form/use-editor-form'
import { useItems, useValueAt } from '../../form/path-access'
import type { Serve } from '../../model/schema'

const ID_NAME = ['id', 'name'] as const

/** Id + name of the flag's variations. Re-renders on a rename or add/remove, not on a value edit. */
export const useVariations = (form: EditorForm, flagIndex: number) =>
  useItems(form, `flags[${flagIndex}].variations`, ID_NAME)

/** What a serve badge needs: the serve at `path` and the variations it points to. */
export function useServeView(
  form: EditorForm,
  flagIndex: number,
  path: string,
) {
  return {
    serve: useValueAt<Serve>(form, path),
    variations: useVariations(form, flagIndex),
  }
}
