import { useState } from "react"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { Button } from "@/components/ui/button"
import { mockWorkspace } from "@/data/mock"
import type { BudgetWorkspace, UserRole } from "@/types/budget"

export default function App() {
  const [user, setUser] = useState<UserRole>("liz")
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(mockWorkspace)
  const [selectedPaycheckId, setSelectedPaycheckId] = useState(
    () => mockWorkspace.paychecks.find((p) => !p.completed)?.id ?? "p6",
  )
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())

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

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {user === "liz" ? (
          <>
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Planning grid
                </h1>
                <p className="text-sm text-muted-foreground">
                  Excel-style paycheck columns · click a category for details
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setUser("ji")}
              >
                Preview Ji view
              </Button>
            </section>

            <BudgetGrid
              buckets={workspace.buckets}
              paychecks={workspace.paychecks}
              doneKeys={doneKeys}
              onToggleDone={toggleDone}
              onAmountChange={onAmountChange}
            />
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
          </>
        )}
      </main>
    </div>
  )
}
