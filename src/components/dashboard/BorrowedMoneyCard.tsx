import { CircleCheck, MessageSquareText } from "lucide-react"
import { formatMoney, formatPayDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Bucket, Withdrawal } from "@/types/budget"

export type BorrowedRow = {
  withdrawal: Withdrawal
  categoryName: string
}

type Props = {
  rows: BorrowedRow[]
  onRepay: (withdrawalId: string) => void
  /** `card` matches Liz summary cards; `section` matches Ji panel blocks. */
  variant?: "card" | "section"
  className?: string
}

export function openBorrowedRows(
  withdrawals: readonly Withdrawal[],
  buckets: readonly Bucket[],
): BorrowedRow[] {
  const nameById = new Map<string, string>()
  for (const bucket of buckets) {
    for (const category of bucket.categories) {
      nameById.set(category.id, category.name)
    }
  }
  return withdrawals
    .filter((w) => w.kind === "borrow" && !w.repaidAt)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((withdrawal) => ({
      withdrawal,
      categoryName: nameById.get(withdrawal.categoryId) ?? "Savings",
    }))
}

export function BorrowedMoneyCard({
  rows,
  onRepay,
  variant = "card",
  className,
}: Props) {
  const total = rows.reduce((sum, row) => sum + row.withdrawal.amount, 0)

  if (variant === "section") {
    return (
      <section
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white",
          className,
        )}
      >
        <div className="border-b border-neutral-200 px-6 py-3">
          <div className="flex h-8 items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Borrowed
            </h2>
            {rows.length > 0 ? (
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatMoney(total)}
              </p>
            ) : null}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">
            No open borrows.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <BorrowedRowItem
                key={row.withdrawal.id}
                row={row}
                onRepay={onRepay}
                dense
              />
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <div
      className={cn(
        "flex h-auto min-h-full w-[min(100%,22rem)] min-w-[16rem] shrink-0 flex-col rounded-[8px] border border-neutral-500 bg-white p-4",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-600">Borrowed</p>
        {rows.length > 0 ? (
          <p className="text-sm tabular-nums text-foreground">
            {formatMoney(total)}
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-auto text-sm text-muted-foreground">No open borrows.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <BorrowedRowItem
              key={row.withdrawal.id}
              row={row}
              onRepay={onRepay}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function BorrowedRowItem({
  row,
  onRepay,
  dense = false,
}: {
  row: BorrowedRow
  onRepay: (withdrawalId: string) => void
  dense?: boolean
}) {
  const { withdrawal, categoryName } = row
  const note = withdrawal.note?.trim()

  return (
    <li
      className={cn(
        "flex items-center gap-3 text-sm",
        dense ? "px-6 py-3" : null,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <time
            dateTime={withdrawal.date}
            className="shrink-0 tabular-nums text-muted-foreground"
          >
            {formatPayDate(withdrawal.date)}
          </time>
          <span className="min-w-0 truncate text-foreground">
            {formatMoney(withdrawal.amount)}
            <span className="text-muted-foreground"> from </span>
            {categoryName}
          </span>
          {note ? (
            <span
              title={note}
              className="inline-flex shrink-0 text-muted-foreground"
            >
              <MessageSquareText className="size-3.5" aria-label={note} />
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        title="Mark paid back"
        aria-label={`Mark ${formatMoney(withdrawal.amount)} from ${categoryName} as paid back`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => onRepay(withdrawal.id)}
      >
        <CircleCheck className="size-[18px]" strokeWidth={1.75} />
      </button>
    </li>
  )
}
