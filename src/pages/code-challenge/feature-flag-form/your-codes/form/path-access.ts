import { createElement, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useStore } from '@tanstack/react-form'
import type { AnyFieldApi } from '@tanstack/react-form'
import type { EditorForm } from './use-editor-form'

/*
 * String-path access for the recursive rule tree. TanStack's typed paths hit TS2589 on it
 * (see FormValues), so every untyped access goes through this file: the cast to string-path access is `loose()`.
 * Paths look like `flags[0].rules[1].tree.children[2].field`.
 */

interface LooseForm {
  store: Parameters<typeof useStore>[0]
  Field: ComponentType<{
    name: string
    children: (field: AnyFieldApi) => ReactNode
  }>
  getFieldValue: (name: string) => unknown
  setFieldValue: (name: string, value: unknown) => void
  pushFieldValue: (name: string, value: unknown) => void
  removeFieldValue: (name: string, index: number) => void
  moveFieldValues: (name: string, from: number, to: number) => void
  setFieldMeta: (
    name: string,
    update: (meta: Record<string, unknown>) => Record<string, unknown>,
  ) => void
}

const loose = (form: EditorForm) => form as unknown as LooseForm

/** `a.b[2].c` -> `['a', 'b', '2', 'c']` */
export const segmentsOf = (path: string): Array<string> =>
  path.split(/[.[\]]+/).filter(Boolean)

/** Reads `a.b[2].c` from any object. */
export const getIn = (root: unknown, path: string): unknown =>
  segmentsOf(path).reduce<unknown>(
    (o, k) => (o as Record<string, unknown> | undefined)?.[k],
    root,
  )

/** `form.Field` for any string path; `field.state.value` is untyped. */
export function PathField({
  form,
  name,
  children,
}: {
  form: EditorForm
  name: string
  children: (field: AnyFieldApi) => ReactNode
}) {
  return createElement(loose(form).Field, { name, children })
}

/** Value at `path`; the component re-renders only when that value changes. */
export function useValueAt<T>(form: EditorForm, path: string): T {
  return useStore(loose(form).store, (s) =>
    getIn((s as { values: unknown }).values, path),
  ) as T
}

/**
 * The listed keys of every item in an array, e.g. `['id', 'kind']`. Re-renders only when one of
 * those keys changes (typing in an item's other fields does not). `keys` must be a constant.
 */
export function useItems<TKey extends string>(
  form: EditorForm,
  path: string,
  keys: ReadonlyArray<TKey>,
): Array<Record<TKey, string>> {
  const json = useStore(loose(form).store, (s) => {
    const items = getIn((s as { values: unknown }).values, path) as
      | Array<Record<string, unknown>>
      | undefined
    return JSON.stringify((items ?? []).map((item) => keys.map((k) => item[k])))
  })
  return useMemo(
    () =>
      (JSON.parse(json) as Array<Array<string>>).map(
        (vals) =>
          Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as Record<
            TKey,
            string
          >,
      ),
    [json, keys],
  )
}

/** Add / remove / move items of the array at `path` (no subscription). */
export function listOps(form: EditorForm, path: string) {
  const f = loose(form)
  return {
    values: () => f.getFieldValue(path) as Array<Record<string, unknown>>,
    push: (item: unknown) => f.pushFieldValue(path, item),
    remove: (row: number) => void f.removeFieldValue(path, row),
    move: (from: number, to: number) => f.moveFieldValues(path, from, to),
  }
}

/**
 * Marks one field as touched and re-runs the form validation, so its inline error shows now.
 * Touching alone is not enough: a field that mounted after the last validation (a new rule) has
 * no error on it yet, and the schema only hands its errors out when it runs again.
 */
export function touchField(form: EditorForm, name: string) {
  loose(form).setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
  void form.validate('change')
}

/** Drops `key` from the object at `path` (e.g. a removed variation from a serve's percentages). */
export function omitKey(form: EditorForm, path: string, key: string) {
  const f = loose(form)
  const obj = f.getFieldValue(path) as Record<string, unknown> | undefined
  if (obj && key in obj)
    f.setFieldValue(
      path,
      Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)),
    )
}

/** Gives `key` a 0% share in the serve at `path`, if that serve is a percentage split. */
export function seedSplit(form: EditorForm, path: string, key: string) {
  const f = loose(form)
  if (f.getFieldValue(`${path}.mode`) !== 'percentage') return
  const shares = f.getFieldValue(`${path}.percentages`) as Record<
    string,
    number
  >
  f.setFieldValue(`${path}.percentages`, { ...shares, [key]: 0 })
}
