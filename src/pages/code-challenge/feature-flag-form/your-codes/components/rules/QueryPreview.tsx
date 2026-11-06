import { useMemo } from 'react'
import { useValueAt } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { toQuery } from '../../logic/query'
import type { Group } from '../../model/schema'

/** The GOFF query of one rule. Subscribes to this rule's tree only. */
export function QueryPreview({
  form,
  treePath,
}: {
  form: EditorForm
  treePath: string
}) {
  const tree = useValueAt<Group>(form, treePath)
  const query = useMemo(() => toQuery(tree), [tree])
  return (
    <p className="text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 font-mono text-xs break-words">
      <span className="mr-2 font-sans text-[11px] font-bold tracking-wide uppercase">
        Query
      </span>
      {query || 'Add a condition…'}
    </p>
  )
}
