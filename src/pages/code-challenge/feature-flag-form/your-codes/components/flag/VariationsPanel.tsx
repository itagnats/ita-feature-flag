import { Layers, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import { listOps, omitKey, seedSplit } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { newVariation } from '../../model/defaults'
import { DashedAddButton } from '../ui/DashedAddButton'
import { FieldError, Required, inputProps } from '../ui/field'
import { Panel } from '../ui/Panel'
import { VariationSwatch } from '../ui/VariationSwatch'

interface RowProps {
  form: EditorForm
  index: number
  row: number
}

/** The value input depends on the flag type, so only this cell subscribes to it. */
function ValueCell({ form, index, row }: RowProps) {
  const label = `Variation ${row + 1} value`
  return (
    <form.Subscribe selector={(s) => s.values.flags[index]?.type}>
      {(type) => (
        <form.Field name={`flags[${index}].variations[${row}].value`}>
          {(field) => (
            <div className="space-y-1">
              <span
                aria-hidden
                className="text-muted-foreground block text-xs font-medium sm:hidden"
              >
                Value <Required />
              </span>
              {type === 'boolean' ? (
                <div className="flex h-8 items-center gap-2 text-sm">
                  <Switch
                    id={field.name}
                    aria-label={label}
                    checked={field.state.value === 'true'}
                    onCheckedChange={(on) =>
                      field.handleChange(on ? 'true' : 'false')
                    }
                  />
                  {field.state.value}
                </div>
              ) : type === 'json' ? (
                <Textarea
                  {...inputProps(field, label)}
                  className="min-h-16 font-mono"
                  placeholder='{"key": "value"}'
                />
              ) : (
                <Input
                  {...inputProps(field, label)}
                  inputMode={type === 'number' ? 'decimal' : undefined}
                  placeholder={type === 'number' ? '42' : 'value'}
                />
              )}
              <FieldError field={field} />
            </div>
          )}
        </form.Field>
      )}
    </form.Subscribe>
  )
}

function VariationRow({
  form,
  index,
  row,
  onRemove,
}: RowProps & { onRemove?: () => void }) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_2rem] items-start gap-x-2.5 gap-y-1.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem]">
      <span className="text-muted-foreground flex h-8 items-center text-xs">
        {row + 1}
      </span>
      <form.Field name={`flags[${index}].variations[${row}].name`}>
        {(field) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <VariationSwatch index={row} />
              <Input
                {...inputProps(field, `Variation ${row + 1} name`)}
                placeholder="Variation name"
              />
            </div>
            <FieldError field={field} />
          </div>
        )}
      </form.Field>
      <div className="col-span-2 col-start-2 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <ValueCell form={form} index={index} row={row} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive col-start-3 row-start-1 sm:col-start-4"
        aria-label={`Delete variation ${row + 1}`}
        disabled={!onRemove}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

export function VariationsPanel({
  form,
  index,
}: {
  form: EditorForm
  index: number
}) {
  return (
    <Panel
      icon={Layers}
      title="Variations"
      subtitle="The values this flag can return. Each one gets a colour used across the rules."
    >
      <form.Field name={`flags[${index}].variations`} mode="array">
        {(list) => {
          const rows = list.state.value
          const flagPath = `flags[${index}]`
          /** Paths of every serve of this flag: each rule's and the default rule's. */
          const servePaths = () => [
            ...listOps(form, `${flagPath}.rules`)
              .values()
              .map((_, r) => `${flagPath}.rules[${r}].serve`),
            `${flagPath}.defaultRule`,
          ]
          /** Removes the variation and its share from every split of this flag. */
          const remove = (row: number, variationId: string) => {
            list.removeValue(row)
            for (const p of servePaths())
              omitKey(form, `${p}.percentages`, variationId)
          }
          /** Adds a variation; every split gets 0% for it, so a valid 100% split stays valid. */
          const add = () => {
            const variation = newVariation(
              rows.map((v) => v.name),
              form.getFieldValue(`flags[${index}].type`),
            )
            list.pushValue(variation)
            for (const p of servePaths()) seedSplit(form, p, variation.id)
          }
          return (
            <>
              <div
                aria-hidden
                className="text-muted-foreground text-xs font-medium grid grid-cols-[1.25rem_minmax(0,1fr)_2rem] gap-x-2.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem]"
              >
                <span />
                <span>
                  Name <Required />
                </span>
                <span className="hidden sm:block">
                  Value <Required />
                </span>
              </div>
              <ul className="divide-y *:py-2.5 first:*:pt-0">
                {rows.map((v, row) => (
                  <VariationRow
                    key={v.id}
                    form={form}
                    index={index}
                    row={row}
                    onRemove={
                      rows.length > 1 ? () => remove(row, v.id) : undefined
                    }
                  />
                ))}
              </ul>
              <DashedAddButton onClick={add}>Add Variation</DashedAddButton>
            </>
          )
        }}
      </form.Field>
    </Panel>
  )
}
