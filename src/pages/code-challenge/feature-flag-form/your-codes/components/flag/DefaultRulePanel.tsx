import { Flag } from 'lucide-react'
import type { EditorForm } from '../../form/use-editor-form'
import { ServeChip } from '../serve/ServeBadge'
import { ServeSelector } from '../serve/ServeSelector'
import { Required } from '../ui/field'
import { Panel } from '../ui/Panel'

export function DefaultRulePanel({
  form,
  index,
}: {
  form: EditorForm
  index: number
}) {
  const path = `flags[${index}].defaultRule`
  return (
    <Panel
      icon={Flag}
      title={
        <>
          Default Rule <Required />
        </>
      }
      subtitle="Served when no targeting rule matches. Required."
      actions={<ServeChip form={form} flagIndex={index} path={path} />}
    >
      <ServeSelector
        form={form}
        flagIndex={index}
        path={path}
        label="Default rule"
      />
    </Panel>
  )
}
