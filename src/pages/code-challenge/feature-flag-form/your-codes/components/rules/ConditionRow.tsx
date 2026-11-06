import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils'
import { PathField, listOps, useValueAt } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { OPERATORS, OPERATOR_KEYS } from '../../model/constants'
import type { Operator } from '../../model/constants'
import { FieldError, SELECT_LIKE_INPUT, inputProps } from '../ui/field'

interface Props {
  form: EditorForm
  /** path of this condition, e.g. `flags[0].rules[1].tree.children[2]` */
  path: string
  /** path of the array holding it (`…children`) and its position in it */
  listPath: string
  row: number
}

/** One condition: field, operator, value. Only this row re-renders while you type in it. */
function ConditionRowView({ form, path, listPath, row }: Props) {
  const operator = useValueAt<Operator>(form, `${path}.operator`)
  const n = row + 1
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_10.5rem_minmax(0,1fr)_2rem]">
      <PathField form={form} name={`${path}.field`}>
        {(field) => (
          <div className="col-start-1 row-start-1 space-y-1 sm:col-start-1">
            <Input
              {...inputProps(field, `Condition ${n} field`)}
              className="font-mono"
              placeholder="field, e.g. role *"
            />
            <FieldError field={field} />
          </div>
        )}
      </PathField>

      <PathField form={form} name={`${path}.operator`}>
        {(field) => (
          <Select
            value={field.state.value as string}
            onValueChange={(v) => field.handleChange(v)}
          >
            <SelectTrigger
              id={field.name}
              aria-label={`Condition ${n} operator`}
              className={cn(
                SELECT_LIKE_INPUT,
                'col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {key} ({OPERATORS[key]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PathField>

      {operator !== 'pr' && (
        <PathField form={form} name={`${path}.value`}>
          {(field) => (
            <div className="col-span-2 space-y-1 sm:col-span-1 sm:col-start-3 sm:row-start-1">
              <Input
                {...inputProps(
                  field,
                  operator === 'in'
                    ? `Condition ${n} values, comma-separated`
                    : `Condition ${n} value`,
                )}
                className="font-mono"
                placeholder={operator === 'in' ? 'a, b, c *' : 'value *'}
              />
              <FieldError field={field} />
            </div>
          )}
        </PathField>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive col-start-2 row-start-1 sm:col-start-4"
        aria-label={`Delete condition ${n}`}
        onClick={() => listOps(form, listPath).remove(row)}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

export const ConditionRow = memo(ConditionRowView)
