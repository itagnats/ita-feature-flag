import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { buildErrorList } from '../../form/error-list'
import type { ErrorItem } from '../../form/error-list'
import { toEditorValues } from '../../form/use-editor-form'
import type { EditorForm } from '../../form/use-editor-form'
import { jumpToField } from './jump-to-field'

/** A string, so `Subscribe` re-renders only when the list itself changes (not on every keystroke). */
const selectItems = (s: {
  values: Parameters<typeof toEditorValues>[0]
  errorMap: { onChange?: unknown }
}) =>
  JSON.stringify(buildErrorList(s.errorMap.onChange, toEditorValues(s.values)))

interface Props {
  form: EditorForm
  /** DOM id, so the badge can scroll here */
  id: string
  open: boolean
  onToggle: () => void
}

/** Collapsible list of every issue: where it is and how to fix it. Click one to jump to its field. */
export function ErrorSummary({ form, id, open, onToggle }: Props) {
  const listId = useId()
  return (
    <form.Subscribe selector={selectItems}>
      {(json) => {
        const items = JSON.parse(json) as Array<ErrorItem>
        if (!items.length) return null
        const count = `${items.length} ${items.length === 1 ? 'issue' : 'issues'}`
        return (
          <section
            id={id}
            aria-label="Error summary"
            className="border-destructive/30 bg-destructive/5 dark:bg-danger-soft rounded-lg border"
          >
            <header className="flex items-center gap-2 p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive min-w-0 flex-1 justify-start"
                aria-expanded={open}
                aria-controls={listId}
                onClick={onToggle}
              >
                <ChevronDown
                  className={cn('transition-transform', !open && '-rotate-90')}
                  aria-hidden
                />
                <span className="truncate">
                  Fix {count} to get a valid config
                </span>
              </Button>
              {/* handleSubmit marks every field touched, so all inline errors show at once */}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void form.handleSubmit()}
              >
                Show all
              </Button>
            </header>
            <ul
              id={listId}
              hidden={!open}
              className="divide-border/60 max-h-60 divide-y overflow-auto border-t"
            >
              {items.map((item, i) => (
                <li key={`${item.fieldName}:${i}`}>
                  <button
                    type="button"
                    className="hover:bg-destructive/10 focus-visible:ring-ring/50 block w-full px-3 py-2 text-left text-xs outline-none focus-visible:ring-2"
                    onClick={() => jumpToField(form, item.fieldName)}
                  >
                    <span className="text-muted-foreground block text-[11px] leading-snug [overflow-wrap:anywhere]">
                      {item.label}
                    </span>
                    <span className="sr-only">: </span>
                    <span className="text-foreground mt-0.5 block text-xs leading-snug font-medium [overflow-wrap:anywhere]">
                      {item.message}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      }}
    </form.Subscribe>
  )
}
