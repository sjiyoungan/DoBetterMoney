import { useState } from "react"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { mockWorkspace } from "@/data/mock"
import type { BudgetWorkspace, UserRole } from "@/types/budget"

export default function App() {
  const [user, setUser] = useState<UserRole>("liz")
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(mockWorkspace)
  const [selectedPaycheckId, setSelectedPaycheckId] = useState(
    () => mockWorkspace.paychecks.find((p) => !p.completed)?.id ?? "p15",
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

      <main className="px-[60px] py-4">
        {user === "liz" ? (
          <BudgetGrid
            buckets={workspace.buckets}
            paychecks={workspace.paychecks}
            doneKeys={doneKeys}
            onToggleDone={toggleDone}
            onAmountChange={onAmountChange}
          />
        ) : (
          <div className="mx-auto max-w-7xl space-y-4">
            <HolderPanel
              workspace={workspace}
              selectedPaycheckId={selectedPaycheckId}
              onSelectedPaycheckChange={setSelectedPaycheckId}
              onToggleHolderFlag={onToggleHolderFlag}
            />
          </div>
        )}
      </main>
    </div>
  )
}
