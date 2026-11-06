import { useEditorForm } from '../form/use-editor-form'
import { newFlag, nextFlagKey } from '../model/defaults'
import { FlagCard } from './flag/FlagCard'
import { JsonPreview } from './preview/JsonPreview'
import { DashedAddButton } from './ui/DashedAddButton'

export default function FeatureFlagEditor() {
  const form = useEditorForm()
  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="grid items-start gap-5 lg:grid-cols-2"
    >
      <div className="min-w-0 space-y-4">
        {/* array mode re-renders only when flags are added or removed */}
        <form.Field name="flags" mode="array">
          {(flags) => (
            <>
              {flags.state.value.map((flag, index) => (
                <FlagCard
                  key={flag.id}
                  form={form}
                  index={index}
                  canRemove={flags.state.value.length > 1}
                />
              ))}
              <DashedAddButton
                onClick={() =>
                  flags.pushValue(
                    newFlag(nextFlagKey(flags.state.value.map((f) => f.key))),
                  )
                }
              >
                Add another flag
              </DashedAddButton>
            </>
          )}
        </form.Field>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-4">
        <JsonPreview form={form} />
      </aside>
    </form>
  )
}
