import { useId, useState } from 'react'
import { ChevronDown, Flag, Trash2 } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { EditorForm } from '../../form/use-editor-form'
import { DefaultRulePanel } from './DefaultRulePanel'
import { MetadataPanel } from './MetadataPanel'
import { RulesPanel } from '../rules/RulesPanel'
import { SettingsPanel } from './SettingsPanel'
import { VariationsPanel } from './VariationsPanel'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Name, status and counts. Only this header follows the flag as you type. */
function FlagSummary({ form, index }: { form: EditorForm; index: number }) {
  return (
    <form.Subscribe selector={(s) => s.values.flags.at(index)}>
      {(flag) =>
        flag && (
          <>
            <span
              className="min-w-0 truncate text-[19px] font-extrabold"
              title={flag.key}
            >
              {flag.key || 'untitled'}
            </span>
            <span className="hidden min-w-0 flex-wrap gap-1.5 sm:flex">
              <Badge variant={flag.disable ? 'outline' : 'default'}>
                {flag.disable ? 'Disabled' : 'Enabled'}
              </Badge>
              <Badge variant="outline">
                {plural(flag.variations.length, 'variation')} ·{' '}
                {plural(flag.rules.length, 'rule')}
              </Badge>
            </span>
          </>
        )
      }
    </form.Subscribe>
  )
}

export function FlagCard({
  form,
  index,
  canRemove,
}: {
  form: EditorForm
  index: number
  canRemove: boolean
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()

  return (
    <article className="bg-card rounded-xl border shadow-card">
      {/* header tint: primary-soft fading out at 70% */}
      <header
        className={cn(
          'flex items-center gap-2 rounded-t-xl bg-[linear-gradient(90deg,var(--primary-soft),transparent_70%)] p-3',
          !open && 'rounded-b-xl',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={open ? 'Collapse flag' : 'Expand flag'}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown
            className={cn('transition-transform', !open && '-rotate-90')}
          />
        </Button>
        <Flag className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <FlagSummary form={form} index={index} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive ml-auto"
          aria-label={`Remove flag ${index + 1}`}
          disabled={!canRemove}
          onClick={() => form.removeFieldValue('flags', index)}
        >
          <Trash2 />
        </Button>
      </header>

      <div id={bodyId} hidden={!open} className="space-y-4 border-t p-3 sm:p-4">
        <SettingsPanel form={form} index={index} />
        <VariationsPanel form={form} index={index} />
        <RulesPanel form={form} index={index} />
        <DefaultRulePanel form={form} index={index} />
        <MetadataPanel form={form} index={index} />
      </div>
    </article>
  )
}
