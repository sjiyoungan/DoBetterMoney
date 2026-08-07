import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/auth/AuthProvider"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { createEmptyWorkspace, emptyWorkspace } from "@/data/empty"
import {
  applyIncomeAllocations,
  buildIncomeBucket,
  generatePaychecksFromIncome,
  generatePaychecksFromIncomeBucket,
  type IncomeSourceInput,
} from "@/lib/income-schedule"
import {
  loadOrCreateWorkspace,
  saveWorkspace,
} from "@/lib/workspace-api"
import {
  createNextYear,
  getActiveYearBudget,
  listYears,
  nextYearToCreate,
  setActiveYear,
  updateActiveYearBudget,
} from "@/lib/year-workspace"
import type { Bucket, BudgetWorkspace, UserRole } from "@/types/budget"

export default function App() {
  const { user, profile, setPreferredRole, signOut } = useAuth()
  const freshPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("fresh")
  const [role, setRole] = useState<UserRole>("liz")
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(emptyWorkspace)
  const [selectedPaycheckId, setSelectedPaycheckId] = useState("")
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [loadingWorkspace, setLoadingWorkspace] = useState(!freshPreview)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyToSave = useRef(false)

  const yearBudget = useMemo(() => getActiveYearBudget(workspace), [workspace])
  const years = useMemo(() => listYears(workspace), [workspace])
  const nextYearLabel = nextYearToCreate(workspace)
  const canCreateYear = !workspace.years[String(nextYearLabel)]

  useEffect(() => {
    if (profile?.preferred_role) setRole(profile.preferred_role)
  }, [profile?.preferred_role])

  useEffect(() => {
    if (freshPreview) {
      setWorkspace(createEmptyWorkspace())
      setWorkspaceId(null)
      setDoneKeys(new Set())
      setSelectedPaycheckId("")
      setLoadingWorkspace(false)
      readyToSave.current = false
      return
    }
    if (!user?.id) return
    let cancelled = false
    setLoadingWorkspace(true)
    readyToSave.current = false

    loadOrCreateWorkspace(user.id)
      .then((state) => {
        if (cancelled) return
        setWorkspaceId(state.id)
        setWorkspace(state.workspace)
        setDoneKeys(new Set(state.doneKeys))
        const active = getActiveYearBudget(state.workspace)
        setSelectedPaycheckId(
          active.paychecks.find((p) => !p.completed)?.id ??
            active.paychecks[0]?.id ??
            "",
        )
        setLoadingWorkspace(false)
        queueMicrotask(() => {
          readyToSave.current = true
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        const msg = err.message ?? String(err)
        const missingSchema =
          /budget_workspace|schema cache|get_email_for_username/i.test(msg)
        setSaveError(
          missingSchema
            ? "Database tables aren’t set up yet. In Supabase → SQL Editor, paste and Run supabase/schema.sql, then refresh this page."
            : msg,
        )
        setWorkspace(createEmptyWorkspace())
        setWorkspaceId(null)
        readyToSave.current = false
        setLoadingWorkspace(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, freshPreview])

  useEffect(() => {
    if (freshPreview) return
    if (!user?.id || !workspaceId || !readyToSave.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      saveWorkspace(workspaceId, workspace, [...doneKeys], user.id)
        .then(() => setSaveError(null))
        .catch((err: Error) => setSaveError(err.message))
    }, 600)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [workspace, doneKeys, workspaceId, user?.id, freshPreview])

  async function onUserChange(next: UserRole) {
    setRole(next)
    try {
      await setPreferredRole(next)
    } catch {
      // Keep local toggle even if profile update fails
    }
  }

  function switchYear(year: number) {
    setWorkspace((prev) => {
      // Persist current doneKeys into the year we're leaving
      const leaving = updateActiveYearBudget(prev, (y) => ({
        ...y,
        doneKeys: [...doneKeys],
      }))
      const next = setActiveYear(leaving, year)
      const slice = getActiveYearBudget(next)
      setDoneKeys(new Set(slice.doneKeys))
      setSelectedPaycheckId(
        slice.paychecks.find((p) => !p.completed)?.id ??
          slice.paychecks[0]?.id ??
          "",
      )
      return next
    })
  }

  function onCreateYear() {
    setWorkspace((prev) => {
      const withDone = updateActiveYearBudget(prev, (y) => ({
        ...y,
        doneKeys: [...doneKeys],
      }))
      const next = createNextYear(withDone)
      const slice = getActiveYearBudget(next)
      setDoneKeys(new Set(slice.doneKeys))
      setSelectedPaycheckId(
        slice.paychecks.find((p) => !p.completed)?.id ??
          slice.paychecks[0]?.id ??
          "",
      )
      return next
    })
  }

  function toggleDone(key: string) {
    setDoneKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function onAmountChange(categoryId: string, date: string, value: string) {
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            const parsed =
              value.trim() === ""
                ? ("" as const)
                : Number(value.replace(/,/g, ""))
            return {
              ...cat,
              allocations: {
                ...cat.allocations,
                [date]: Number.isFinite(parsed as number) ? parsed : "",
              },
            }
          }),
        })),
      })),
    )
  }

  function onAmountApplyToFuture(
    categoryId: string,
    fromDate: string,
    value: string,
  ) {
    const parsed =
      value.trim() === "" ? ("" as const) : Number(value.replace(/,/g, ""))
    const nextVal = Number.isFinite(parsed as number) ? parsed : ("" as const)

    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            const allocations = { ...cat.allocations }
            for (const p of year.paychecks) {
              if (p.date > fromDate) {
                allocations[p.date] = nextVal
              }
            }
            return { ...cat, allocations }
          }),
        })),
      })),
    )
  }

  function onCategoryFieldChange(
    categoryId: string,
    field: "goal" | "balance",
    value: string,
  ) {
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            const trimmed = value.trim()
            if (trimmed === "") {
              return { ...cat, [field]: undefined }
            }
            const parsed = Number(trimmed.replace(/,/g, ""))
            return {
              ...cat,
              [field]: Number.isFinite(parsed) ? parsed : cat[field],
            }
          }),
        })),
      })),
    )
  }

  function onAddBucket(bucket: Bucket) {
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: [...year.buckets, bucket],
      })),
    )
  }

  function onUpdateBucket(bucket: Bucket) {
    if (bucket.kind === "income") {
      const today = new Date().toISOString().slice(0, 10)
      setWorkspace((prev) =>
        updateActiveYearBudget(prev, (year) => {
          const generated = generatePaychecksFromIncomeBucket(bucket)
          const prevByDate = new Map(year.paychecks.map((p) => [p.date, p]))
          const generatedDates = new Set(generated.map((p) => p.date))
          const retainedPast = year.paychecks.filter(
            (p) => p.date < today && !generatedDates.has(p.date),
          )
          const merged = [...retainedPast, ...generated]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((p) => {
              const old = prevByDate.get(p.date)
              return old
                ? {
                    ...p,
                    id: old.id,
                    completed: old.completed || p.date < today,
                  }
                : { ...p, completed: p.date < today }
            })
          const byDate = new Map<string, (typeof merged)[number]>()
          for (const p of merged) byDate.set(p.date, p)
          const paychecks = [...byDate.values()].sort((a, b) =>
            a.date.localeCompare(b.date),
          )

          const prevIncome =
            year.buckets.find((b) => b.id === bucket.id) ?? null
          const next = applyIncomeAllocations(bucket, paychecks, {
            prev: prevIncome,
            fromDate: today,
          })
          return {
            ...year,
            buckets: year.buckets.map((b) => (b.id === next.id ? next : b)),
            paychecks,
          }
        }),
      )
      return
    }
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((b) => (b.id === bucket.id ? bucket : b)),
      })),
    )
  }

  function onSetupIncome(sources: IncomeSourceInput[]) {
    const paychecks = generatePaychecksFromIncome(sources)
    const incomeBucket = buildIncomeBucket(sources, paychecks)
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: [
          incomeBucket,
          ...year.buckets.filter((b) => b.kind !== "income"),
        ],
        paychecks,
      })),
    )
    setSelectedPaycheckId(
      paychecks.find((p) => !p.completed)?.id ?? paychecks[0]?.id ?? "",
    )
  }

  function onToggleHolderFlag(
    paycheckId: string,
    field: "received" | "boaMoved" | "sofiMoved",
  ) {
    setWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        holderSplits: year.holderSplits.map((split) =>
          split.paycheckId === paycheckId
            ? { ...split, [field]: !split[field] }
            : split,
        ),
      })),
    )
  }

  if (loadingWorkspace) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading budget…
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader
        user={role}
        onUserChange={onUserChange}
        onSignOut={signOut}
        username={profile?.username}
        activeYear={workspace.activeYear}
        years={years}
        nextYearLabel={nextYearLabel}
        onYearChange={switchYear}
        onCreateYear={onCreateYear}
        canCreateYear={canCreateYear}
      />

      {freshPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-[60px] py-2 text-xs text-amber-900">
          Fresh preview — empty workspace, not saved to your account. Remove{" "}
          <code className="font-mono">?fresh</code> from the URL to use your
          real data.
        </div>
      ) : null}

      {saveError ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-[60px] py-2 text-xs text-destructive">
          Couldn’t save: {saveError}
        </div>
      ) : null}

      <main className="px-[60px] py-4">
        {role === "liz" ? (
          <BudgetGrid
            buckets={yearBudget.buckets}
            paychecks={yearBudget.paychecks}
            doneKeys={doneKeys}
            onToggleDone={toggleDone}
            onAmountChange={onAmountChange}
            onAmountApplyToFuture={onAmountApplyToFuture}
            onCategoryFieldChange={onCategoryFieldChange}
            onAddBucket={onAddBucket}
            onUpdateBucket={onUpdateBucket}
            onSetupIncome={onSetupIncome}
          />
        ) : (
          <div className="mx-auto max-w-7xl space-y-4">
            <HolderPanel
              workspace={yearBudget}
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
