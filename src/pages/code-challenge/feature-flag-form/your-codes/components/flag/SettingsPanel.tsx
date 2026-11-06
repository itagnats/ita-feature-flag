import type { AnyFieldApi } from '@tanstack/react-form'
import { Info } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import type { EditorForm } from '../../form/use-editor-form'
import { FLAG_TYPES, FLAG_TYPE_LABELS } from '../../model/constants'
import type { FlagType } from '../../model/constants'
import { coerceRawValue } from '../../logic/values'
import {
  FieldError,
  Required,
  SELECT_LIKE_INPUT,
  inputProps,
} from '../ui/field'
import { Panel } from '../ui/Panel'

function Toggle({ field, label }: { field: AnyFieldApi; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={field.name}
        checked={field.state.value as boolean}
        onCheckedChange={field.handleChange}
      />
      <Label htmlFor={field.name}>{label}</Label>
    </div>
  )
}

export function SettingsPanel({
  form,
  index,
}: {
  form: EditorForm
  index: number
}) {
  const path = `flags[${index}]` as const

  /** Changing the type keeps every variation value valid for the new type. */
  const changeType = (type: FlagType) => {
    form.setFieldValue(`${path}.type`, type)
    form.setFieldValue(
      `${path}.variations`,
      form
        .getFieldValue(`${path}.variations`)
        .map((v) => ({ ...v, value: coerceRawValue(v.value, type) })),
    )
  }

  return (
    <Panel
      icon={Info}
      title="Settings"
      subtitle="Name, status and type of this flag."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name={`${path}.key`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>
                Flag Name <Required />
              </Label>
              <Input {...inputProps(field)} placeholder="my-first-flag" />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>

        {/* sm:pt-5 skips the Flag Name label so the switches sit level with its input */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:h-13 sm:pt-5">
          <form.Field name={`${path}.disable`}>
            {(field) => <Toggle field={field} label="Disabled" />}
          </form.Field>
          <form.Field name={`${path}.trackEvents`}>
            {(field) => <Toggle field={field} label="Track events" />}
          </form.Field>
        </div>

        <form.Field name={`${path}.type`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Flag type</Label>
              <Select
                value={field.state.value}
                onValueChange={(t) => changeType(t as FlagType)}
              >
                <SelectTrigger id={field.name} className={SELECT_LIKE_INPUT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLAG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {FLAG_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name={`${path}.version`}>
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Version</Label>
              <Input
                {...inputProps(field)}
                placeholder="optional, e.g. 1.0.0"
              />
            </div>
          )}
        </form.Field>

        <form.Field name={`${path}.description`}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={field.name}>Description</Label>
              <Textarea
                {...inputProps(field)}
                placeholder="What is this flag for? Saved as metadata.description"
              />
            </div>
          )}
        </form.Field>
      </div>
    </Panel>
  )
}
