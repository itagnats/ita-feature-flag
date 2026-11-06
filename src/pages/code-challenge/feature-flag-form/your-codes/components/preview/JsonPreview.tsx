import { useEffect, useId, useState } from 'react'
import { Braces, Check, Copy, Download } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { countErrors, toEditorValues } from '../../form/use-editor-form'
import type { EditorForm } from '../../form/use-editor-form'
import { toFlagFile } from '../../logic/flag-json'
import { ErrorSummary } from './ErrorSummary'
import { JsonViewer } from './JsonViewer'

/** "Valid", or "N errors" that opens the summary and scrolls to it. */
function ErrorBadge({
  form,
  onShow,
}: {
  form: EditorForm
  onShow: () => void
}) {
  return (
    <form.Subscribe selector={countErrors}>
      {(count) =>
        count ? (
          <Badge asChild variant="destructive">
            <button type="button" onClick={onShow}>
              {count} {count === 1 ? 'error' : 'errors'}
            </button>
          </Badge>
        ) : (
          <Badge
            role="status"
            variant="secondary"
            className="bg-ok-soft text-ok"
          >
            <Check aria-hidden />
            Valid
          </Badge>
        )
      }
    </form.Subscribe>
  )
}

function Actions({ json, invalid }: { json: string; invalid: boolean }) {
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(''), 2500)
    return () => clearTimeout(timer)
  }, [note])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setNote('Copied.')
    } catch {
      setNote(
        'Copy is not available here. Select the JSON and copy it by hand.',
      )
    }
  }

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'flags.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="JSON actions"
    >
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy /> Copy JSON
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={download}>
        <Download /> Download
      </Button>
      <span role="status" className="text-muted-foreground min-w-0 text-xs">
        {note}
      </span>
      {invalid && (
        <span className="text-muted-foreground min-w-0 text-xs">
          This JSON has errors; fix them before using it.
        </span>
      )}
    </div>
  )
}

export function JsonPreview({ form }: { form: EditorForm }) {
  const summaryId = useId()
  const [summaryOpen, setSummaryOpen] = useState(true)
  const showSummary = () => {
    setSummaryOpen(true)
    document.getElementById(summaryId)?.scrollIntoView({ block: 'nearest' })
  }
  return (
    <section
      aria-labelledby="preview-title"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-card"
    >
      <header className="flex items-start gap-3">
        <Braces className="text-muted-foreground mt-0.5 size-4" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="preview-title" className="text-sm leading-none font-semibold">
            JSON Preview
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Real-time Feature Flag configuration.
          </p>
        </div>
        <ErrorBadge form={form} onShow={showSummary} />
      </header>
      <ErrorSummary
        form={form}
        id={summaryId}
        open={summaryOpen}
        onToggle={() => setSummaryOpen((o) => !o)}
      />
      <form.Subscribe selector={(s) => s.values}>
        {(values) => {
          const json = JSON.stringify(
            toFlagFile(toEditorValues(values)),
            null,
            2,
          )
          return (
            <div className="space-y-2">
              <form.Subscribe selector={countErrors}>
                {(count) => <Actions json={json} invalid={count > 0} />}
              </form.Subscribe>
              <JsonViewer json={json} />
            </div>
          )
        }}
      </form.Subscribe>
    </section>
  )
}
