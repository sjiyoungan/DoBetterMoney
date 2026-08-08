import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { SavingsBucketTotal } from "@/lib/budget-summary"
import { COMPOSITION_COLORS } from "@/lib/budget-summary"
import { formatMoney } from "@/lib/format"

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
  const groups = rows.filter((row) => row.categories.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Total savings</SheetTitle>
        </SheetHeader>

        <div className="mt-2 space-y-5">
          <p className="text-3xl font-light tracking-tight tabular-nums text-foreground">
            {formatMoney(total)}
          </p>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No savings categories yet.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <section
                  key={group.bucketId}
                  className="rounded-xl border border-neutral-200 bg-white px-4"
                >
                  <div className="flex items-center justify-between gap-3 py-4">
                    <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                      {group.bucketName}
                    </h3>
                    <span className="shrink-0 text-base tabular-nums text-foreground">
                      {formatMoney(group.amount)}
                    </span>
                  </div>
                  <div className="border-t border-neutral-200" />
                  <ul className="space-y-4 py-4">
                    {group.categories.map((cat) => {
                      const goal =
                        typeof cat.goal === "number" &&
                        Number.isFinite(cat.goal) &&
                        cat.goal > 0
                          ? cat.goal
                          : 0
                      const progress = goal > 0 ? (cat.amount / goal) * 100 : 0
                      const pct = goal > 0 ? Math.round(progress) : 0
                      return (
                        <li
                          key={cat.categoryId}
                          className="flex items-center text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate font-normal text-foreground">
                            {cat.categoryName}
                          </span>
                          <div className="ml-auto flex shrink-0 items-center gap-2">
                            <span className="tabular-nums text-foreground">
                              {formatMoney(cat.amount)}
                            </span>
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-neutral-200 sm:w-20">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(progress, 100)}%`,
                                  backgroundColor: COMPOSITION_COLORS.savings,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right tabular-nums text-neutral-600">
                              {pct}%
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
