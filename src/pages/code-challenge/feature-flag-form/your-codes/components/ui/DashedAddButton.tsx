import type { ComponentProps } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** The one "add" pattern: dashed, full width, at the bottom of the list it adds to. */
export function DashedAddButton({
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-dashed"
      {...props}
    >
      <Plus aria-hidden />
      {children}
    </Button>
  )
}
