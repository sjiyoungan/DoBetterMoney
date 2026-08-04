import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { formatMoney, formatPayDate } from "@/lib/format"
import type { BudgetWorkspace, Paycheck } from "@/types/budget"

type Props = {
  workspace: BudgetWorkspace
  selectedPaycheckId: string
  onSelectedPaycheckChange: (id: string) => void
  onToggleHolderFlag: (
    paycheckId: string,
    field: "received" | "boaMoved" | "sofiMoved",
  ) => void
}

export function HolderPanel({
  workspace,
  selectedPaycheckId,
  onSelectedPaycheckChange,
  onToggleHolderFlag,
}: Props) {
  const split = workspace.holderSplits.find(
    (s) => s.paycheckId === selectedPaycheckId,
  )
  const paycheck = workspace.paychecks.find((p) => p.id === selectedPaycheckId)
  const upcoming = workspace.paychecks.filter((p) => !p.completed)

  const heldTotal = Object.values(workspace.holderBalances).reduce(
    (a, b) => a + b,
    0,
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>This transfer</CardTitle>
          <CardDescription>
            How much Liz sends, where it lands, checklist for Ji
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Paycheck</label>
            <Select
              value={selectedPaycheckId}
              onValueChange={onSelectedPaycheckChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {upcoming.map((p: Paycheck) => (
                  <SelectItem key={p.id} value={p.id}>
                    {formatPayDate(p.date)} · income {formatMoney(p.income)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {paycheck && split ? (
            <div className="space-y-3 rounded-lg border p-3">
              <Row
                label="Total to Ji"
                value={formatMoney(split.totalToJi)}
                checked={split.received}
                onCheckedChange={() =>
                  onToggleHolderFlag(split.paycheckId, "received")
                }
                checkLabel="Received"
              />
              <Separator />
              <Row
                label="Keep in Bank of America"
                value={formatMoney(split.keepInBoa)}
                hint="Gym split autopay"
                checked={split.boaMoved}
                onCheckedChange={() =>
                  onToggleHolderFlag(split.paycheckId, "boaMoved")
                }
                checkLabel="Moved"
              />
              <Row
                label="Transfer to SoFi"
                value={formatMoney(split.transferToSofi)}
                hint="Savings held for Liz"
                checked={split.sofiMoved}
                onCheckedChange={() =>
                  onToggleHolderFlag(split.paycheckId, "sofiMoved")
                }
                checkLabel="Moved"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No holder split drafted for this paycheck yet.
            </p>
          )}

          <Button variant="outline" disabled>
            Log transfer back to Liz
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Held balances</CardTitle>
          <CardDescription>
            What the SoFi / held account should add up to by bucket
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-sm">Expected total on hand</span>
            <span className="font-semibold">{formatMoney(heldTotal)}</span>
          </div>
          <ul className="space-y-2">
            {Object.entries(workspace.holderBalances).map(([id, amount]) => {
              const cat = workspace.buckets
                .flatMap((b) => b.categories)
                .find((c) => c.id === id)
              return (
                <li
                  key={id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{cat?.name ?? id}</span>
                  <Badge variant="secondary">{formatMoney(amount)}</Badge>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Money-in / money-out ledger UI comes next. This is just the frame.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  checked,
  onCheckedChange,
  checkLabel,
}: {
  label: string
  value: string
  hint?: string
  checked: boolean
  onCheckedChange: () => void
  checkLabel: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        {checkLabel}
      </label>
    </div>
  )
}
