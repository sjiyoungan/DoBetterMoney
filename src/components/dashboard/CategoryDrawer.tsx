import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatMoney, formatPayDate, savingsBalanceLeft } from "@/lib/format"
import type { Bucket, Category, Paycheck } from "@/types/budget"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  bucket: Bucket | null
  paychecks: Paycheck[]
  doneKeys: Set<string>
}

export function CategoryDrawer({
  open,
  onOpenChange,
  category,
  bucket,
  paychecks,
  doneKeys,
}: Props) {
  if (!category || !bucket) return null

  const history = paychecks
    .map((p) => {
      const amount = category.allocations[p.date]
      const key = `${category.id}::${p.id}`
      return {
        paycheck: p,
        amount,
        done: p.completed || doneKeys.has(key),
      }
    })
    .filter((row) => row.amount !== "" && row.amount !== undefined)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{category.name}</SheetTitle>
          <SheetDescription>{bucket.name}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {category.isRecurring ? "Recurring" : "Variable"}
            </Badge>
            {bucket.kind === "savings" ? (
              <Badge variant="outline">Savings</Badge>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="font-medium">{category.dueDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Min / payment</dt>
              <dd className="font-medium">
                {formatMoney(category.minPayment ?? category.recurringAmount)}
              </dd>
            </div>
            {bucket.kind === "savings" ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Goal</dt>
                  <dd className="font-medium">{formatMoney(category.goal)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Balance left</dt>
                  <dd className="font-medium">
                    {formatMoney(
                      savingsBalanceLeft(
                        category.goal,
                        category.allocations,
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total saved</dt>
                  <dd className="font-medium">
                    {formatMoney(category.totalSaved)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold">Allocation history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amounts yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map(({ paycheck, amount, done }) => (
                  <li
                    key={paycheck.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      done
                        ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                        : "bg-muted/60"
                    }`}
                  >
                    <span>{formatPayDate(paycheck.date)}</span>
                    <span className="font-medium">
                      {formatMoney(amount as number)}
                      {done ? " · moved" : " · planned"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Money-in / money-out detail will live here later.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
