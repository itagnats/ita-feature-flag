import { useCallback, useId, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, Modifier } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronsUpDown, Target } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { listOps, useItems } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { newRule } from '../../model/defaults'
import { DashedAddButton } from '../ui/DashedAddButton'
import { Panel } from '../ui/Panel'
import { RuleCard } from './RuleCard'

const ID_ONLY = ['id'] as const

/** Keeps a drag on the vertical axis (the list is one column). */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** The rules of one flag: sortable list (drag, keyboard or move buttons), add, expand all. */
export function RulesPanel({
  form,
  index,
}: {
  form: EditorForm
  index: number
}) {
  const path = `flags[${index}].rules`
  const rules = useItems(form, path, ID_ONLY)
  const ops = listOps(form, path)
  const dndId = useId()
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const toggle = useCallback(
    (id: string) =>
      setClosed((prev) => {
        const next = new Set(prev)
        if (!next.delete(id)) next.add(id)
        return next
      }),
    [],
  )
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Screen-reader text names rules by position and name, not by id. Positions come from the
  // order at drag start: the form state is already reordered when the drop is announced.
  const startOrder = useRef<Array<string>>([])
  const nameOf = (id: unknown) =>
    String(ops.values().find((r) => r.id === id)?.name ?? '').trim()
  const describe = (id: unknown) => {
    const at = startOrder.current.indexOf(String(id)) + 1
    const name = nameOf(id)
    return { at, text: `Rule ${at}${name ? ` (${name})` : ''}` }
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      startOrder.current = rules.map((r) => r.id)
      return `Picked up ${describe(active.id).text}.`
    },
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? `${describe(active.id).text} moved over position ${describe(over.id).at}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      `${describe(active.id).text} dropped at position ${describe(over?.id ?? active.id).at}.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${describe(active.id).text} stays at position ${describe(active.id).at}.`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const from = rules.findIndex((r) => r.id === active.id)
    const to = rules.findIndex((r) => r.id === over?.id)
    if (from >= 0 && to >= 0 && from !== to) ops.move(from, to)
  }

  return (
    <Panel
      icon={Target}
      title="Targeting Rules"
      subtitle="Rules run top to bottom; the first match wins. Drag to reorder."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={closed.size === 0}
          onClick={() => setClosed(new Set())}
        >
          <ChevronsUpDown aria-hidden />
          Expand all
        </Button>
      }
    >
      <DndContext
        id={dndId}
        sensors={sensors}
        accessibility={{ announcements }}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={rules.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-3">
            {rules.map((rule, row) => (
              <RuleCard
                key={rule.id}
                form={form}
                flagIndex={index}
                id={rule.id}
                row={row}
                count={rules.length}
                open={!closed.has(rule.id)}
                onToggle={toggle}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {rules.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No rules yet: every request gets the Default Rule.
        </p>
      )}
      <DashedAddButton
        onClick={() =>
          ops.push(newRule(ops.values().map((r) => String(r.name))))
        }
      >
        Add Rule
      </DashedAddButton>
    </Panel>
  )
}
