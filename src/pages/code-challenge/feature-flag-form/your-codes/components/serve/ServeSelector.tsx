import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { PathField } from '../../form/path-access'
import type { EditorForm } from '../../form/use-editor-form'
import { splitEvenly } from '../../model/defaults'
import { percentTotal } from '../../logic/values'
import type { Serve } from '../../model/schema'
import { FieldError, inputProps } from '../ui/field'
import { VariationSwatch } from '../ui/VariationSwatch'
import { SplitBar } from './ServeBadge'
import { useVariations } from './hooks'

interface Props {
  form: EditorForm
  flagIndex: number
  /** path of the serve object: `flags[0].rules[1].serve` or `flags[0].defaultRule` */
  path: string
  /** accessible name of the owner, e.g. "Rule 2" or "Default rule" */
  label: string
}

interface PartProps extends Omit<Props, 'flagIndex'> {
  variations: ReturnType<typeof useVariations>
}

/** Radio pills, one per variation. Native radios give arrow-key navigation for free. */
function VariationPicker({ form, path, label, variations }: PartProps) {
  return (
    <PathField form={form} name={`${path}.variation`}>
      {(field) => (
        <div className="space-y-1">
          <div
            id={field.name}
            role="radiogroup"
            aria-label={`${label}: variation to serve`}
            className="flex flex-wrap gap-2"
            onBlur={field.handleBlur}
          >
            {variations.map((v, i) => (
              <label
                key={v.id}
                title={v.name}
                className={cn(
                  'border-input dark:bg-input/30 flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border bg-transparent px-3 py-1 text-sm transition-colors',
                  'has-[:checked]:border-foreground has-[:checked]:font-medium',
                  'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3',
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`${path}.variation`}
                  checked={field.state.value === v.id}
                  onChange={() => field.handleChange(v.id)}
                />
                <VariationSwatch index={i} />
                <span className="min-w-0 truncate">{v.name || 'Unnamed'}</span>
              </label>
            ))}
          </div>
          <FieldError field={field} />
        </div>
      )}
    </PathField>
  )
}

function PercentageEditor({
  form,
  path,
  label,
  variations,
  serve,
  onEven,
}: PartProps & { serve: Serve; onEven: () => void }) {
  const total = percentTotal(
    serve,
    variations.map((v) => v.id),
  )
  return (
    <div id={`${path}.percentages`} className="space-y-2">
      {variations.map((v, i) => (
        <PathField key={v.id} form={form} name={`${path}.percentages.${v.id}`}>
          {(field) => (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <VariationSwatch index={i} />
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={v.name}
                >
                  {v.name}
                </span>
                <Input
                  {...inputProps(field, `${label}: ${v.name} percentage`)}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="w-24 text-right font-mono"
                  value={(field.state.value as number | undefined) ?? ''}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
                <span className="text-muted-foreground text-sm">%</span>
              </div>
              <FieldError field={field} />
            </div>
          )}
        </PathField>
      ))}
      <SplitBar variations={variations} serve={serve} className="h-2 w-full" />
      <div className="flex items-center justify-between gap-2 text-sm">
        <Button type="button" variant="ghost" size="sm" onClick={onEven}>
          Split evenly
        </Button>
        <span>
          Total{' '}
          <b className={total === 100 ? 'text-ok' : 'text-destructive'}>
            {total}%
          </b>
        </span>
      </div>
      <PathField form={form} name={`${path}.percentages`}>
        {(field) => <FieldError field={field} always />}
      </PathField>
    </div>
  )
}

/** Variation / Percentage switch. A split needs 2 or more variations. */
function ModeToggle({
  id,
  label,
  mode,
  canSplit,
  onChange,
}: {
  id: string
  label: string
  mode: Serve['mode']
  canSplit: boolean
  onChange: (mode: Serve['mode']) => void
}) {
  const button = (value: Serve['mode'], text: string) => {
    const blocked = value === 'percentage' && !canSplit
    return (
      <Button
        type="button"
        size="sm"
        variant={mode === value ? 'default' : 'ghost'}
        aria-pressed={mode === value}
        disabled={blocked}
        title={
          blocked
            ? 'Add a second variation to serve a percentage split.'
            : undefined
        }
        onClick={() => onChange(value)}
      >
        {text}
      </Button>
    )
  }
  return (
    <div
      id={id}
      role="group"
      aria-label={`${label}: serve type`}
      className="bg-muted inline-flex rounded-lg p-0.5"
    >
      {button('variation', 'Variation')}
      {button('percentage', 'Percentage')}
    </div>
  )
}

/** Serve one variation or a percentage split. Used by every rule and by the Default Rule. */
export function ServeSelector({ form, flagIndex, path, label }: Props) {
  const variations = useVariations(form, flagIndex)
  const ids = variations.map((v) => v.id)
  const canSplit = variations.length >= 2
  return (
    <PathField form={form} name={path}>
      {(field) => {
        const serve = field.state.value as Serve
        const setMode = (mode: Serve['mode']) =>
          field.handleChange({
            ...serve,
            mode,
            // the first switch to a split starts from an even one
            percentages:
              mode === 'percentage' && !Object.keys(serve.percentages).length
                ? splitEvenly(ids)
                : serve.percentages,
          })
        return (
          <div className="space-y-2">
            <ModeToggle
              id={`${path}.mode`}
              label={label}
              mode={serve.mode}
              canSplit={canSplit}
              onChange={setMode}
            />
            <PathField form={form} name={`${path}.mode`}>
              {(modeField) => <FieldError field={modeField} always />}
            </PathField>
            {serve.mode === 'variation' ? (
              <VariationPicker
                form={form}
                path={path}
                label={label}
                variations={variations}
              />
            ) : (
              <PercentageEditor
                form={form}
                path={path}
                label={label}
                variations={variations}
                serve={serve}
                onEven={() =>
                  field.handleChange({
                    ...serve,
                    percentages: splitEvenly(ids),
                  })
                }
              />
            )}
          </div>
        )
      }}
    </PathField>
  )
}
