import { Tag, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import type { EditorForm } from '../../form/use-editor-form'
import { newMetadata } from '../../model/defaults'
import { DashedAddButton } from '../ui/DashedAddButton'
import { FieldError, Required, inputProps } from '../ui/field'
import { Panel } from '../ui/Panel'

export function MetadataPanel({
  form,
  index,
}: {
  form: EditorForm
  index: number
}) {
  return (
    <Panel
      icon={Tag}
      title="Metadata"
      subtitle="Extra key/value info, e.g. a Jira issue or config URL."
    >
      <form.Field name={`flags[${index}].metadata`} mode="array">
        {(list) => (
          <>
            {list.state.value.length > 0 && (
              <div
                aria-hidden
                className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_2rem] gap-2 text-xs font-medium sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
              >
                <span>
                  Key <Required />
                </span>
                <span className="hidden sm:block">Value</span>
              </div>
            )}
            {list.state.value.map((m, row) => (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
              >
                <form.Field name={`flags[${index}].metadata[${row}].key`}>
                  {(field) => (
                    <div className="space-y-1">
                      <Input
                        {...inputProps(field, `Metadata ${row + 1} key`)}
                        placeholder="key"
                      />
                      <FieldError field={field} />
                    </div>
                  )}
                </form.Field>
                <form.Field name={`flags[${index}].metadata[${row}].value`}>
                  {(field) => (
                    <Input
                      {...inputProps(field, `Metadata ${row + 1} value`)}
                      className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                      placeholder="value"
                    />
                  )}
                </form.Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive col-start-2 row-start-1 sm:col-start-3"
                  aria-label={`Delete metadata ${row + 1}`}
                  onClick={() => list.removeValue(row)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <DashedAddButton onClick={() => list.pushValue(newMetadata())}>
              Add Metadata
            </DashedAddButton>
          </>
        )}
      </form.Field>
    </Panel>
  )
}
