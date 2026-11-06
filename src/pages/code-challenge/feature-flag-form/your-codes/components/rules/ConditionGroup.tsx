import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { PathField, listOps, useItems } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { COMBINATORS, MAX_GROUP_DEPTH } from '../../model/constants'
import { newCondition, newGroup } from '../../model/defaults'
import { DashedAddButton } from '../ui/DashedAddButton'
import { FieldError } from '../ui/field'
import { ConditionRow } from './ConditionRow'

const ID_KIND = ['id', 'kind'] as const

/** Colours of the selected AND / OR pill (the hover classes keep them from changing on hover). */
const COMBINATOR_ACTIVE: Record<(typeof COMBINATORS)[number], string> = {
  and: 'bg-and-soft text-and hover:bg-and-soft hover:text-and',
  or: 'bg-or-soft text-or hover:bg-or-soft hover:text-or',
}

interface Props {
  form: EditorForm
  /** path of this group, e.g. `flags[0].rules[1].tree` */
  path: string
  /** 1 for the rule's root group */
  depth: number
  /** where this group sits in its parent (absent for the root, which cannot be deleted) */
  parentList?: string
  parentRow?: number
}

/** AND/OR + NOT toggles, children and the add buttons. Renders itself again for nested groups. */
function ConditionGroupView({
  form,
  path,
  depth,
  parentList,
  parentRow,
}: Props) {
  const listPath = `${path}.children`
  // structure only: typing inside a child does not re-render the group
  const children = useItems(form, listPath, ID_KIND)
  const ops = listOps(form, listPath)

  return (
    <div
      id={path}
      role="group"
      aria-label={`Group ${depth}`}
      className={cn(
        'space-y-2 rounded-lg border border-l-4 border-l-border p-2.5',
        depth % 2 ? 'bg-background/60' : 'bg-muted/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PathField form={form} name={`${path}.combinator`}>
          {(field) => (
            <div
              role="group"
              aria-label={`Group ${depth} combinator`}
              className="bg-muted inline-flex rounded-full p-0.5"
            >
              {COMBINATORS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="xs"
                  variant="ghost"
                  className={cn(
                    'rounded-full px-3 font-bold',
                    field.state.value === c && COMBINATOR_ACTIVE[c],
                  )}
                  aria-pressed={field.state.value === c}
                  onClick={() => field.handleChange(c)}
                >
                  {c.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
        </PathField>
        <PathField form={form} name={`${path}.not`}>
          {(field) => (
            <Button
              type="button"
              size="xs"
              variant={field.state.value ? 'destructive' : 'outline'}
              className="rounded-full px-3 font-bold"
              aria-pressed={field.state.value as boolean}
              onClick={() => field.handleChange(!field.state.value)}
            >
              NOT
            </Button>
          )}
        </PathField>
        <span className="text-muted-foreground text-xs font-medium">
          Group {depth}
        </span>
        {parentList !== undefined && parentRow !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive ml-auto"
            aria-label={`Delete group ${depth}`}
            onClick={() => listOps(form, parentList).remove(parentRow)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <PathField form={form} name={path}>
        {(field) => <FieldError field={field} always />}
      </PathField>
      <PathField form={form} name={listPath}>
        {(field) => <FieldError field={field} always />}
      </PathField>

      <ul className="space-y-2">
        {children.map((child, row) => {
          const childPath = `${listPath}[${row}]`
          return (
            <li key={child.id}>
              {child.kind === 'group' ? (
                <ConditionGroup
                  form={form}
                  path={childPath}
                  depth={depth + 1}
                  parentList={listPath}
                  parentRow={row}
                />
              ) : (
                <ConditionRow
                  form={form}
                  path={childPath}
                  listPath={listPath}
                  row={row}
                />
              )}
            </li>
          )
        })}
      </ul>

      <div id={listPath} className="grid auto-cols-fr grid-flow-col gap-2">
        <DashedAddButton onClick={() => ops.push(newCondition())}>
          Condition
        </DashedAddButton>
        {depth < MAX_GROUP_DEPTH && (
          <DashedAddButton onClick={() => ops.push(newGroup())}>
            Group
          </DashedAddButton>
        )}
      </div>
    </div>
  )
}

export const ConditionGroup = memo(ConditionGroupView)
