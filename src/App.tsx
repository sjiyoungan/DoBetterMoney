import { useMemo, useState } from "react"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mockWorkspace } from "@/data/mock"
import { formatMoney, formatPayDate } from "@/lib/format"
import type { BudgetWorkspace, UserRole } from "@/types/budget"

export default function App() {
  const [user, setUser] = useState<UserRole>("liz")
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(mockWorkspace)
  const [selectedPaycheckId, setSelectedPaycheckId] = useState(
    () => mockWorkspace.paychecks.find((p) => !p.completed)?.id ?? "p6",
  )
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [mainTab, setMainTab] = useState("paycheck")

  const upcoming = useMemo(
    () => workspace.paychecks.filter((p) => !p.completed),
    [workspace.paychecks],
  )

  function toggleDone(key: string) {
    setDoneKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function onAmountChange(categoryId: string, date: string, value: string) {
    setWorkspace((prev) => ({
      ...prev,
      buckets: prev.buckets.map((bucket) => ({
        ...bucket,
        categories: bucket.categories.map((cat) => {
          if (cat.id !== categoryId) return cat
          const parsed =
            value.trim() === "" ? ("" as const) : Number(value.replace(/,/g, ""))
          return {
            ...cat,
            allocations: {
              ...cat.allocations,
              [date]: Number.isFinite(parsed as number) ? parsed : "",
            },
          }
        }),
      })),
    }))
  }

  function onToggleHolderFlag(
    paycheckId: string,
    field: "received" | "boaMoved" | "sofiMoved",
  ) {
    setWorkspace((prev) => ({
      ...prev,
      holderSplits: prev.holderSplits.map((split) =>
        split.paycheckId === paycheckId
          ? { ...split, [field]: !split[field] }
          : split,
      ),
    }))
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader user={user} onUserChange={setUser} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {user === "liz" ? (
          <>
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Budget dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  $0 / envelope style · flexible buckets · paycheck columns
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedPaycheckId}
                  onValueChange={setSelectedPaycheckId}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Paycheck" />
                  </SelectTrigger>
                  <SelectContent>
                    {upcoming.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPayDate(p.date)} · {formatMoney(p.income)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setUser("ji")}
                >
                  Preview Ji view
                </Button>
              </div>
            </section>

            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList>
                <TabsTrigger value="paycheck">This paycheck</TabsTrigger>
                <TabsTrigger value="planning">Planning grid</TabsTrigger>
                <TabsTrigger value="saved">Saved by bucket</TabsTrigger>
              </TabsList>

              <TabsContent value="paycheck" className="mt-4">
                <BudgetGrid
                  buckets={workspace.buckets}
                  paychecks={workspace.paychecks}
                  mode="paycheck"
                  selectedPaycheckId={selectedPaycheckId}
                  doneKeys={doneKeys}
                  onToggleDone={toggleDone}
                  onAmountChange={onAmountChange}
                />
              </TabsContent>

              <TabsContent value="planning" className="mt-4">
                <BudgetGrid
                  buckets={workspace.buckets}
                  paychecks={workspace.paychecks}
                  mode="planning"
                  selectedPaycheckId={selectedPaycheckId}
                  doneKeys={doneKeys}
                  onToggleDone={toggleDone}
                  onAmountChange={onAmountChange}
                />
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {workspace.buckets
                    .filter((b) => b.kind === "savings")
                    .flatMap((b) => b.categories)
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="rounded-xl border p-4"
                      >
                        <p className="font-medium">{cat.name}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Goal {formatMoney(cat.goal)}
                        </p>
                        <p className="text-sm">
                          Saved {formatMoney(cat.totalSaved)} · Left{" "}
                          {formatMoney(cat.balance)}
                        </p>
                      </div>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            <section>
              <h1 className="text-2xl font-semibold tracking-tight">
                Holder dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Receive → split to BoA / SoFi → track held bucket totals
              </p>
            </section>
            <HolderPanel
              workspace={workspace}
              selectedPaycheckId={selectedPaycheckId}
              onSelectedPaycheckChange={setSelectedPaycheckId}
              onToggleHolderFlag={onToggleHolderFlag}
            />
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Later: full money-in / money-out ledger, withdrawal picker by
              bucket, and Supabase auth on one shared account with role switch.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
