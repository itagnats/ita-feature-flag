import { useEffect, useState, useSyncExternalStore } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount } from '@monaco-editor/react'
import { Skeleton } from '#/components/ui/skeleton'

const OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  wordWrap: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 13,
  ariaLabel: 'Flag JSON preview',
} as const

/** Code colours of the app theme, copied as hex because Monaco cannot read CSS variables: key, string, number, bool, punctuation. */
const CODE = {
  light: {
    bg: '#fbfcfe',
    key: '0b5cad',
    str: '15803d',
    num: 'b45309',
    bool: '7c3aed',
    punc: '5b6b82',
    fg: '0f1b2d',
    faint: '8796ab',
  },
  dark: {
    bg: '#071326',
    key: '7cc4ff',
    str: 'a3e635',
    num: 'fbbf24',
    bool: 'c4b5fd',
    punc: '93a7c2',
    fg: 'e6edf7',
    faint: '6c819e',
  },
} as const

const defineThemes: BeforeMount = (monaco) => {
  for (const [name, base, c] of [
    ['ffe-light', 'vs', CODE.light],
    ['ffe-dark', 'vs-dark', CODE.dark],
  ] as const) {
    monaco.editor.defineTheme(name, {
      base,
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: c.key },
        { token: 'string.value.json', foreground: c.str },
        { token: 'number', foreground: c.num },
        { token: 'keyword.json', foreground: c.bool },
        { token: 'delimiter', foreground: c.punc },
        { token: 'delimiter.bracket.json', foreground: c.punc },
        { token: 'delimiter.array.json', foreground: c.punc },
        { token: 'delimiter.colon.json', foreground: c.punc },
        { token: 'delimiter.comma.json', foreground: c.punc },
      ],
      colors: {
        'editor.background': c.bg,
        'editor.foreground': `#${c.fg}`,
        'editorLineNumber.foreground': `#${c.faint}`,
        'editorLineNumber.activeForeground': `#${c.punc}`,
      },
    })
  }
}

/** Monaco comes from a CDN; after this long without a mounted editor the plain JSON is shown. */
export const MONACO_TIMEOUT_MS = 8000

const root = () => document.documentElement

/** True while <html class="dark"> is set; follows the app's theme toggle. */
function useIsDark() {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify)
      observer.observe(root(), { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    },
    () => root().classList.contains('dark'),
    () => false,
  )
}

/** false on the server and during hydration, true afterwards (Monaco needs the browser). */
const useIsClient = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

/** Read-only plain JSON for when the code viewer cannot load (offline, blocked CDN). */
function PlainJson({ json }: { json: string }) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-muted-foreground border-b px-3 py-1.5 text-xs">
        Code viewer unavailable (offline?) — showing plain JSON.
      </p>
      <pre
        tabIndex={0}
        aria-label="Flag JSON preview"
        className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[13px] leading-[19px]"
      >
        {json}
      </pre>
    </div>
  )
}

export function JsonViewer({ json }: { json: string }) {
  const isDark = useIsDark()
  const isClient = useIsClient()
  const [mounted, setMounted] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!isClient || mounted) return
    const timer = setTimeout(() => setTimedOut(true), MONACO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isClient, mounted])

  const fallback = <Skeleton className="h-full w-full" />
  return (
    <div className="h-80 w-full max-w-full min-w-0 overflow-hidden rounded-lg border lg:h-[60vh]">
      {timedOut && !mounted ? (
        <PlainJson json={json} />
      ) : isClient ? (
        <Editor
          language="json"
          value={json}
          theme={isDark ? 'ffe-dark' : 'ffe-light'}
          beforeMount={defineThemes}
          options={OPTIONS}
          loading={fallback}
          onMount={() => setMounted(true)}
        />
      ) : (
        fallback
      )}
    </div>
  )
}
