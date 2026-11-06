# Notes: Feature Flag Editor

A form editor for [GO Feature Flag](https://gofeatureflag.org/editor) flags with a live JSON preview.
Code lives in `src/pages/code-challenge/feature-flag-form/your-codes/`. For the folder layout and data
flow see its [README](src/pages/code-challenge/feature-flag-form/your-codes/README.md).

## Run

```
pnpm dev                # http://localhost:3000/code-challenge/feature-flag-form
pnpm test               # Vitest
pnpm exec tsc --noEmit  # type check
pnpm lint
```

## Key technical decisions

**Model and output**

- **Editor model is not the GOFF file.** Every list item has a stable `id`, and rules point to variations by id. Why: renaming a variation never breaks a rule, and ids give stable React keys and drag & drop handles.
- **`toFlagJson` omits default values** (`disable` only when true, `trackEvents` only when false, `version` only when filled), like the GOFF editor. Why: output matches what real GOFF files look like.
- **Output is always wrapped in `{ "flags": { "<key>": … } }`**, JSON only, and several flags are supported (one card each, unique names). Why: the brief's expected output uses this wrapper. Inside each flag we keep real GOFF fields (percentage map, `defaultRule`, etc.) rather than the brief's simplified sample.

**Validation**

- **One recursive Zod 4 schema** validates every level. Cross-field checks (unique names, variation references, percentages total 100, max depth) report issues with a `path`. Why: each message lands under the field it belongs to.
- **Percentages:** at most 2 decimals, must total 100, and the error names the actual total. A new variation seeds 0% in existing splits so a valid split stays valid.
- **Group depth max 5; NOT only on groups.** Why: keeps the tree readable, and `not (…)` is the form the GOFF query grammar supports for groups.
- **Percentage option only with 2+ variations**, like GOFF.

**Query compiler**

- **`toQuery` is a pure function** (no React). Values are auto-typed: integers, decimals, booleans and semver are written raw, everything else is a quoted, escaped string. `co`, `sw` and `ew` are always quoted. `in` takes comma-separated values.
- **Grammar checked against nikunjy/rules** (the parser GOFF uses): `not (…)` is valid, string escapes match JSON escapes, and semver and number lexing match our rules.

**Form wiring**

- **Standard Schema wrapper instead of passing `editorSchema` to TanStack Form.** Why: the recursive type is too deep for TanStack's inference (TS2589), and TanStack devtools JSON-serialise form options, which crashed on the circular schema object.
- **Single-cast path helper (`form/path-access.ts`).** Typed field paths cannot follow the recursive tree, so rule-tree fields are addressed by string path and the cast that turns the form into string-path access lives in one place (`loose()` in `path-access.ts`); field values read through it are typed at the use site.
- **Re-render strategy:** components subscribe to narrow slices, and `RuleCard`, `ConditionGroup` and `ConditionRow` are memoised. Typing in the flag key does not re-render rules (covered by a React Profiler test).

**UI**

- **dnd-kit for rule reorder.** Why: keyboard accessible with announcements. Move up/down buttons are also available.
- **Monaco loads from a CDN** (the `@monaco-editor/react` default). If it has not loaded after 8 s the preview falls back to plain JSON, so the output is always readable.
- **Preview stays visible while the form is invalid**, with a Valid / N errors badge and an error summary with jump links.
- **Colour hierarchy:** variation identity colours (never red, green, blue or violet) mark variations and rules; logic structure is neutral (AND blue, OR violet on the active pill only); red is only for errors and delete, green only for Valid.

## Dependency notes

- **TanStack packages are pinned to the starter versions.** Letting the "latest" specifiers re-resolve broke `pnpm build`.
- **`pnpm-workspace.yaml` overrides `@tanstack/router-core` to 1.168.9.** Without it a second router-core version gave the devtools a `path.endsWith is not a function` crash.
- **`vitest.config.ts` uses a plain React plugin.** The TanStack Start and devtools plugins load a second React copy under Vitest ("Invalid hook call").
- **Added packages:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (rule reordering) and shadcn `badge`, `label`, `select`, `switch`, `textarea`.
- **Starter fixes:** unused import and type-only import errors in `app-sidebar.tsx`, `lib/utils.ts` and `ui/badge.tsx`; light-theme tokens in `styles.css`.
- **Starter page changes:** the brief in `assignment.tsx` (header, goal, features, sample JSON) is commented out so the page shows only the editor; remove the `{/* … */}` and uncomment the imports to restore it. The side menu starts collapsed (`<SidebarProvider defaultOpen={false}>` in `pages/layout.tsx`); its toggle still opens it.
- **Theme:** `styles.css` uses my own design (an HTML mock made before coding): blue-tinted light and navy dark tokens mapped onto the shadcn variables, 14px radius, system font stacks, card shadow. The unused Google Fonts import (Fraunces, Manrope) and the Geist font import were removed. The sidebar logo sits on a white tile so it stays visible on the blue primary colour (`app-sidebar.tsx`).

## Known limitations

- A field that already shows an error re-renders on keystrokes elsewhere, because TanStack's form-level validation gives it a new errors array. Rule bodies, query previews and other rules do not re-render.
- Monaco needs network access to its CDN; offline, the plain-JSON fallback is used.
- Not built: `progressiveRollout`, `scheduledRollouts`, experimentation, YAML/TOML export.

## Testing

Vitest, 14 test files. Last run: `Tests  200 passed (200)`.

- **Logic:** query compiler, value typing, JSON builder, schema and cross-field rules, edge cases, error list.
- **Acceptance checks A1–A13:** `acceptance.test.ts` covers the logic checks, including comparing output to a stored expected fixture. The UI parts (error under field, add/remove, reorder, deleted variation, re-render counts) are tested through render tests.
- **UI:** render tests for the editor, rules, error summary, Monaco fallback, jump-to-field and variation seeding.

## How this was built

AI-assisted: I used Claude Code as a pair programmer. I wrote the requirements and the HTML design
mock, made the design and scope decisions, and reviewed every change; Claude wrote most of the code
and tests under that direction. Each change was checked with `pnpm test`, `tsc`, `pnpm lint` and
`pnpm build` before it was accepted.
