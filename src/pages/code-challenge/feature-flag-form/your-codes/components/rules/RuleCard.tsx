import { memo, useId } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { PathField, listOps } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { ServeChip, ServeEdge } from '../serve/ServeBadge'
import { ServeSelector } from '../serve/ServeSelector'
import { FieldError, Required, inputProps } from '../ui/field'
import { ConditionGroup } from './ConditionGroup'
import { QueryPreview } from './QueryPreview'

interface Props {
  form: EditorForm
  flagIndex: number
  id: string
  row: number
  count: number
  open: boolean
  onToggle: (id: string) => void
}

/** One targeting rule. Memoised: it re-renders only when its own position or open state changes. */
function RuleCardView({
  form,
  flagIndex,
  id,
  row,
  count,
  open,
  onToggle,
}: Props) {
  const rulesPath = `flags[${flagIndex}].rules`
  const path = `${rulesPath}[${row}]`
  const n = row + 1
  const bodyId = useId()
  const sortable = useSortable({ id })
  const ops = listOps(form, rulesPath)

  return (
    <li
      ref={sortable.setNodeRef}
      aria-label={`Rule ${n}`}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        'bg-card relative overflow-hidden rounded-xl border shadow-xs',
        sortable.isDragging && 'z-10 opacity-80 shadow-lg',
      )}
    >
      <ServeEdge form={form} flagIndex={flagIndex} path={`${path}.serve`} />
      <header className="flex flex-wrap items-center gap-2 p-2.5 pl-3.5 sm:flex-nowrap">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={sortable.setActivatorNodeRef}
          aria-label={`Drag to reorder rule ${n}`}
          className="shrink-0 cursor-grab touch-none"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`${open ? 'Collapse' : 'Expand'} rule ${n}`}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(id)}
        >
          <ChevronDown
            className={cn('transition-transform', !open && '-rotate-90')}
          />
        </Button>
        <Badge variant="secondary" className="shrink-0">
          Rule {n}
        </Badge>
        <div className="order-last flex min-w-0 basis-full items-start gap-2 sm:order-none sm:basis-0 sm:flex-1">
          <PathField form={form} name={`${path}.name`}>
            {(field) => (
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  {...inputProps(field, `Rule ${n} name`)}
                  placeholder="Rule name *"
                />
                <FieldError field={field} />
              </div>
            )}
          </PathField>
          <div className="flex h-8 max-w-40 min-w-0 shrink items-center">
            <ServeChip
              form={form}
              flagIndex={flagIndex}
              path={`${path}.serve`}
            />
          </div>
        </div>
        <div className="ml-auto flex shrink-0 sm:ml-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move rule ${n} up`}
            disabled={row === 0}
            onClick={() => ops.move(row, row - 1)}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move rule ${n} down`}
            disabled={row === count - 1}
            onClick={() => ops.move(row, row + 1)}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label={`Delete rule ${n}`}
            onClick={() => ops.remove(row)}
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div id={bodyId} hidden={!open} className="space-y-3 border-t p-3 pl-4">
        <div className="space-y-1.5">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            If
          </h4>
          <ConditionGroup form={form} path={`${path}.tree`} depth={1} />
          <QueryPreview form={form} treePath={`${path}.tree`} />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Then serve <Required />
          </h4>
          <ServeSelector
            form={form}
            flagIndex={flagIndex}
            path={`${path}.serve`}
            label={`Rule ${n}`}
          />
        </div>
      </div>
    </li>
  )
}

export const RuleCard = memo(RuleCardView)
