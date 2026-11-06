# Feature Flag Editor: code structure

A form editor for [GO Feature Flag](https://gofeatureflag.org/editor) flags with a live JSON
preview. Entry point: `index.tsx` renders `components/FeatureFlagEditor.tsx`.

## Data flow

```
model/defaults ──► form/use-editor-form (TanStack Form, validated by model/schema)
                         │
          components/* read and write fields by path
                         │
                         ▼
     logic/flag-json (toFlagFile) ──► components/preview (JSON + error summary)
```

1. The form holds an **editor model** (`model/schema.ts`), not the GOFF file. Every list item has a
   stable `id`, used for React keys and drag & drop. Rules point to variations **by id**, so
   renaming a variation never breaks a rule.
2. Zod validates the whole model on every change. Each issue carries a `path`, so its message is
   shown under the field it belongs to.
3. `logic/` turns the model into the GOFF output: pure functions with no React.

## How a targeting rule works

**In short:** a rule is _"if these conditions match, serve this variation"_. The editor does not
store the condition as a text query. It stores a **tree** of conditions and groups, and builds the
GOFF query string from that tree whenever it changes. A tree is easy to edit, validate field by
field and render as a form; the string is only an output.

### Example: screen → tree → query

What the user builds in the form:

```
Rule "Thai power users"
  AND
  ├─ country  eq  TH
  └─ OR (nested group)
     ├─ role  eq  admin
     └─ plan  in  pro, team
  Then serve: Variation_1
```

The query string the editor writes into the JSON:

```
country eq "TH" and (role eq "admin" or plan in ["pro","team"])
```

Text values are quoted, numbers / booleans / versions are written as-is, a nested group gets
`( … )`, and a group with **NOT** on becomes `not ( … )`.
### The hierarchy

```
flags[]                                   FlagCard
├─ variations[]   { id, name, value }     VariationsPanel
├─ rules[]                                RulesPanel (drag & drop to reorder)
│  └─ rule        { id, name, tree, serve }        RuleCard
│     ├─ tree = Group (root)                       ConditionGroup (depth 1)
│     │  ├─ combinator: and | or
│     │  ├─ not: true | false
│     │  └─ children[]: Condition | Group  ◄─ recursive, up to 5 levels
│     │     ├─ Condition { field, operator, value }   ConditionRow
│     │     └─ Group { …same shape… }                 ConditionGroup (depth + 1)
│     └─ serve { mode, variation, percentages }    ServeSelector
└─ defaultRule = serve                             DefaultRulePanel
```

### The schema behind it (`model/schema.ts`)

| Part      | Stores                                                  | Validation                                                                                                 |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Condition | `field`, `operator` (one of 11), `value`                | attribute required and well-formed; value required except for `pr`; an `in` list uses one kind of value    |
| Group     | `combinator` (and/or), `not`, `children`                | at least one child; nesting up to 5 levels (`checks.ts`)                                                   |
| Rule      | `name`, `tree` (the root group), `serve`                | name required                                                                                              |
| Serve     | one variation **or** a percentage split (variation ids) | the variation must exist; a split needs 2+ variations, 0–100 each, max 2 decimals, total 100 (`checks.ts`) |

`Group.children` is a list of _either_ a Condition _or_ another Group (a Zod discriminated union on
`kind`), declared with a Zod 4 getter so the schema can refer to itself. Every node has an `id`,
and variations are referenced by `id`, so renaming a variation never breaks a rule.

### From tree to output (`logic/`)

- `toQuery(tree)` walks the tree: a group joins its children with `and` / `or`, wraps nested groups
  in `( … )` and adds `not ( … )`; a condition becomes `field operator value`. Unfinished parts are
  skipped, so the preview always shows something while the user is still typing.
- `toFlagJson(flag)` puts it together: variation ids become names, and each rule becomes
  `{ name, query, variation | percentage }`.

Both are plain functions with no React, so they are unit tested on their own.

### Why it is built this way

1. **Tree, not text.** Users edit fields instead of writing query syntax, every field gets its own
   error message, and the output always matches the GOFF grammar.
2. **One component per level.** `ConditionGroup` renders itself for nested groups, so any depth
   works with the same code. The add-group button hides at level 5.
3. **Small re-renders.** A group only listens to its list of children (ids and kinds), and a
   condition row only to its own fields, so typing in one condition does not re-render the rest of
   the rule or the other rules.

## Folders

Dependencies: `components → form → model + logic`. `model` and `logic` share the value helpers in `logic/values.ts` (`logic` only imports types and constants from `model`). Neither contains React.

### `model/`: what the editor edits

| File           | Purpose                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schema.ts`    | Zod 4 schemas and inferred types (`Condition`, `Group`, `Rule`, `Flag`, `EditorValues`). Condition groups are recursive. |
| `checks.ts`    | Cross-field checks used by the schema: unique names, variation references, percentages summing to 100, max group depth.  |
| `constants.ts` | Flag types, the 11 query operators, AND/OR, max depth (5), name patterns.                                                |
| `defaults.ts`  | Factories for new items (`newFlag`, `newRule`, `newCondition`, …) and the start state.                                   |
| `colors.ts`    | Variation colour palette (no red/green/blue/violet; those mean error, valid and AND/OR).                                 |

### `logic/`: pure transforms (fully unit tested)

| File           | Purpose                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query.ts`     | `toQuery(group)` compiles a condition tree into a GOFF query string (nikunjy/rules grammar): `and`/`or`, nested `( … )`, `not ( … )`.                                           |
| `values.ts`    | Value typing and formatting: numbers, booleans and semver are written raw, text is quoted and escaped, `in` lists become `[ … ]`. Also percent totals.                          |
| `flag-json.ts` | `toFlagJson(flag)` / `toFlagFile(values)` build the output `{ "flags": { "<key>": … } }`. Optional keys are left out when they hold their default value, as in the GOFF editor. |

### `form/`: TanStack Form wiring

| File                 | Purpose                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-editor-form.ts` | Creates the form with initial values and the schema validator.                                                                                                                                                                                                                                                               |
| `path-access.ts`     | String-path access for the recursive rule tree (`PathField`, `useValueAt`, `useItems`, `listOps`). TanStack's typed paths are too deep for TypeScript (TS2589) on this tree, so the cast that turns the form into string-path access lives in one place (`loose()`); field values read through it are typed at the use site. |
| `error-list.ts`      | Turns schema issues into a readable list (`my-flag › Rule 2 › Group 1 › Condition 3 › Value`) with the field name to jump to.                                                                                                                                                                                                |

### `components/`: UI

| Folder                  | Contents                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeatureFlagEditor.tsx` | Page layout: flag cards with "Add another flag", and a sticky preview beside them on large screens (stacked below on small ones).                   |
| `flag/`                 | One card per flag: `FlagCard` (header) with `SettingsPanel`, `VariationsPanel`, `RulesPanel`, `DefaultRulePanel` and `MetadataPanel` inside it.     |
| `rules/`                | `RulesPanel` (sortable list, dnd-kit), `RuleCard`, the recursive `ConditionGroup`, `ConditionRow` and the per-rule `QueryPreview`.                  |
| `serve/`                | `ServeSelector` (one variation or a percentage split), shared by rules and the default rule, plus colour badges and the rule edge bar.              |
| `preview/`              | `JsonPreview` (Valid / N errors badge), `JsonViewer` (Monaco from a CDN, with a plain-text fallback after 8 s), `ErrorSummary` and `jump-to-field`. |
| `ui/`                   | Small shared pieces: `Panel`, `DashedAddButton`, `VariationSwatch` and field error helpers.                                                         |

## Re-renders

Components subscribe only to the slice they show. `RuleCard`, `ConditionGroup` and `ConditionRow`
are memoised, so typing in a condition re-renders that row and its rule's query preview, not
the other rules. Known limitation: a field that already shows an error re-renders when you type
elsewhere, because form-level validation gives it a new errors array.

## Tests

`__tests__/` (Vitest, config at repo root `vitest.config.ts`):

- `query`, `flag-json`, `schema`, `validation-rules`, `edge-cases` cover the pure logic.
- `acceptance.test.ts` maps the acceptance checks (logic part) and compares against the expected output in `fixtures/reference-flags.json`.
- `*-render.test.tsx`, `editor-acceptance.test.tsx`, `json-viewer`, `variation-seed` cover the UI.

```
pnpm test               # run all tests
pnpm exec tsc --noEmit  # type check
pnpm lint
```
