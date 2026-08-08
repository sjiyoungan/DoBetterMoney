import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatMoney } from "@/lib/format"
import type { SavingsBucketTotal } from "@/lib/budget-summary"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: SavingsBucketTotal[]
  total: number
}

export function SavingsDetailDrawer({
  open,
  onOpenChange,
  rows,
  total,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Total savings</SheetTitle>
          <SheetDescription>
            Allocated to each savings group this year
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-4 px-4 pb-4">
          <p className="text-3xl font-light tracking-tight tabular-nums text-foreground">
            {formatMoney(total)}
          </p>

          <Separator />

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No savings groups yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li
                  key={row.bucketId}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-neutral-700">
                    {row.bucketName}
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
