import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { allocationKey, formatMoney, formatPayDate } from "@/lib/format"
import type { Bucket, Paycheck } from "@/types/budget"

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  mode: "paycheck" | "planning"
  selectedPaycheckId: string
  doneKeys: Set<string>
  onToggleDone: (key: string) => void
  onAmountChange: (
    categoryId: string,
    date: string,
    value: string,
  ) => void
}

export function BudgetGrid({
  buckets,
  paychecks,
  mode,
  selectedPaycheckId,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const visiblePaychecks =
    mode === "paycheck"
      ? paychecks.filter((p) => p.id === selectedPaycheckId)
      : paychecks.filter((p) => !p.completed || p.date >= "2026-08-01")

  const selected = paychecks.find((p) => p.id === selectedPaycheckId)

  return (
    <div className="space-y-4">
      {mode === "paycheck" && selected && (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <div>
            <p className="text-sm text-muted-foreground">This paycheck</p>
            <p className="text-xl font-semibold">
              {formatPayDate(selected.date)} · {formatMoney(selected.income)}
            </p>
          </div>
          <ZeroBudgetMeter
            income={selected.income}
            buckets={buckets}
            date={selected.date}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-44 bg-background">
                Category
              </TableHead>
              <TableHead className="min-w-20">Due</TableHead>
              {mode === "planning" && (
                <>
                  <TableHead className="min-w-20">Goal</TableHead>
                  <TableHead className="min-w-20">Balance</TableHead>
                </>
              )}
              {visiblePaychecks.map((p) => (
                <TableHead key={p.id} className="min-w-28 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span>{formatPayDate(p.date)}</span>
                    {p.completed ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        Done
                      </Badge>
                    ) : (
                      <Badge variant="outline">Plan</Badge>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <BucketRows
                key={bucket.id}
                bucket={bucket}
                paychecks={visiblePaychecks}
                mode={mode}
                doneKeys={doneKeys}
                onToggleDone={onToggleDone}
                onAmountChange={onAmountChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled>
          Add bucket
        </Button>
        <Button variant="outline" size="sm" disabled>
          Add category
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          Buttons are placeholders for the next pass
        </p>
      </div>
    </div>
  )
}

function BucketRows({
  bucket,
  paychecks,
  mode,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: {
  bucket: Bucket
  paychecks: Paycheck[]
  mode: "paycheck" | "planning"
  doneKeys: Set<string>
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
}) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell
          colSpan={mode === "planning" ? 4 + paychecks.length : 2 + paychecks.length}
          className="sticky left-0 font-medium"
        >
          {bucket.name}
          {bucket.note ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {bucket.note}
            </span>
          ) : null}
        </TableCell>
      </TableRow>
      {bucket.categories.map((cat) => (
        <TableRow key={cat.id}>
          <TableCell className="sticky left-0 bg-background font-medium">
            {cat.name}
            {cat.isRecurring ? (
              <Badge variant="secondary" className="ml-2">
                recurring
              </Badge>
            ) : null}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {cat.dueDate ?? "—"}
          </TableCell>
          {mode === "planning" && (
            <>
              <TableCell>{formatMoney(cat.goal)}</TableCell>
              <TableCell>{formatMoney(cat.balance)}</TableCell>
            </>
          )}
          {paychecks.map((p) => {
            const raw = cat.allocations[p.date]
            const key = allocationKey(cat.id, p.id)
            const done = doneKeys.has(key) || p.completed
            const showCheck = mode === "paycheck" && !p.completed

            return (
              <TableCell key={p.id} className="text-right">
                <div
                  className={`inline-flex items-center gap-2 rounded-md px-1 py-0.5 ${
                    done ? "bg-emerald-100 dark:bg-emerald-950" : ""
                  }`}
                >
                  {showCheck ? (
                    <Checkbox
                      checked={doneKeys.has(key)}
                      onCheckedChange={() => onToggleDone(key)}
                      aria-label={`Mark ${cat.name} moved`}
                    />
                  ) : null}
                  <Input
                    className="h-8 w-20 text-right"
                    value={raw === "" || raw === undefined ? "" : String(raw)}
                    onChange={(e) =>
                      onAmountChange(cat.id, p.date, e.target.value)
                    }
                    inputMode="numeric"
                  />
                </div>
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}

function ZeroBudgetMeter({
  income,
  buckets,
  date,
}: {
  income: number
  buckets: Bucket[]
  date: string
}) {
  const allocated = buckets
    .flatMap((b) => b.categories)
    .reduce((sum, cat) => {
      const v = cat.allocations[date]
      return sum + (typeof v === "number" ? v : 0)
    }, 0)
  const left = income - allocated

  return (
    <div className="text-right">
      <p className="text-sm text-muted-foreground">$0 check</p>
      <p className="text-sm">
        Allocated {formatMoney(allocated)} · Left{" "}
        <span className={left === 0 ? "text-emerald-600" : "text-amber-600"}>
          {formatMoney(left)}
        </span>
      </p>
    </div>
  )
}
