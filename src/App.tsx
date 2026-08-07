import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/auth/AuthProvider"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { createEmptyWorkspace, emptyWorkspace } from "@/data/empty"
import { applyAmountToFuture } from "@/lib/apply-to-future"
import { renamePaycheckDate } from "@/lib/paycheck-date"
import { reorderById } from "@/lib/reorder"
import {
  applyIncomeAllocations,
  buildIncomeBucket,
  generatePaychecksFromIncome,
  generatePaychecksFromIncomeBucket,
  type IncomeSourceInput,
} from "@/lib/income-schedule"
import {
  cloneUndoSnapshot,
  pushUndoSnapshot,
  type UndoSnapshot,
} from "@/lib/undo-history"
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
  syncYearPrefills,
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveReady, setSaveReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  )
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const saveReadyRef = useRef(false)
  const saveGenerationRef = useRef(0)
  const savingRef = useRef(false)
  const workspaceRef = useRef(workspace)
  const doneKeysRef = useRef(doneKeys)
  const workspaceIdRef = useRef(workspaceId)
  const userIdRef = useRef(user?.id)
  const undoStackRef = useRef<UndoSnapshot[]>([])
  const redoStackRef = useRef<UndoSnapshot[]>([])
  const coalesceKeyRef = useRef<string | null>(null)

  workspaceRef.current = workspace
  doneKeysRef.current = doneKeys
  workspaceIdRef.current = workspaceId
  userIdRef.current = user?.id
  saveReadyRef.current = saveReady

  const yearBudget = useMemo(() => getActiveYearBudget(workspace), [workspace])
  const years = useMemo(() => listYears(workspace), [workspace])
  const nextYearLabel = nextYearToCreate(workspace)
  const canCreateYear = !workspace.years[String(nextYearLabel)]

  function clearHistory() {
    undoStackRef.current = []
    redoStackRef.current = []
    coalesceKeyRef.current = null
    setUndoDepth(0)
    setRedoDepth(0)
  }

  function recordHistory(coalesceKey?: string) {
    if (
      coalesceKey !== undefined &&
      coalesceKeyRef.current === coalesceKey
    ) {
      return
    }
    coalesceKeyRef.current = coalesceKey ?? null
    undoStackRef.current = pushUndoSnapshot(
      undoStackRef.current,
      cloneUndoSnapshot(workspaceRef.current, doneKeysRef.current),
    )
    redoStackRef.current = []
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(0)
  }

  function applySnapshot(snapshot: UndoSnapshot) {
    workspaceRef.current = snapshot.workspace
    doneKeysRef.current = new Set(snapshot.doneKeys)
    setWorkspace(snapshot.workspace)
    setDoneKeys(new Set(snapshot.doneKeys))
    const slice = getActiveYearBudget(snapshot.workspace)
    setSelectedPaycheckId((prev) =>
      slice.paychecks.some((p) => p.id === prev)
        ? prev
        : (slice.paychecks.find((p) => !p.completed)?.id ??
          slice.paychecks[0]?.id ??
          ""),
    )
    markDirty()
  }

  function queueSave() {
    if (freshPreview || !saveReadyRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void flushSave()
    }, 200)
  }

  function markDirty() {
    dirtyRef.current = true
    saveGenerationRef.current += 1
    setSaveStatus("idle")
    queueSave()
  }

  async function flushSave() {
    if (freshPreview) return
    const id = workspaceIdRef.current
    const uid = userIdRef.current
    if (!id || !uid || !saveReadyRef.current) return
    if (!dirtyRef.current) return
    if (savingRef.current) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    const generation = saveGenerationRef.current
    const ws = workspaceRef.current
    const keys = [...doneKeysRef.current]
    dirtyRef.current = false
    savingRef.current = true
    setSaveStatus("saving")

    try {
      await saveWorkspace(id, ws, keys, uid)
      savingRef.current = false
      if (saveGenerationRef.current !== generation || dirtyRef.current) {
        dirtyRef.current = true
        queueSave()
        return
      }
      setSaveError(null)
      setSaveStatus("saved")
    } catch (err) {
      savingRef.current = false
      dirtyRef.current = true
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
      setSaveStatus("error")
    }
  }

  /** Force an immediate save after a cell commit (blur). */
  function onAmountCommit() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    void flushSave()
  }

  function patchWorkspace(updater: (prev: BudgetWorkspace) => BudgetWorkspace) {
    setWorkspace((prev) => {
      const next = updater(prev)
      workspaceRef.current = next
      return next
    })
    markDirty()
  }

  function patchDoneKeys(updater: (prev: Set<string>) => Set<string>) {
    setDoneKeys((prev) => {
      const next = updater(prev)
      doneKeysRef.current = next
      return next
    })
    markDirty()
  }

  function undo() {
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const previous = stack[stack.length - 1]
    undoStackRef.current = stack.slice(0, -1)
    redoStackRef.current = pushUndoSnapshot(
      redoStackRef.current,
      cloneUndoSnapshot(workspaceRef.current, doneKeysRef.current),
    )
    coalesceKeyRef.current = null
    applySnapshot(previous)
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
  }

  function redo() {
    const stack = redoStackRef.current
    if (stack.length === 0) return
    const next = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    undoStackRef.current = pushUndoSnapshot(
      undoStackRef.current,
      cloneUndoSnapshot(workspaceRef.current, doneKeysRef.current),
    )
    coalesceKeyRef.current = null
    applySnapshot(next)
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
  }

  useEffect(() => {
    if (profile?.preferred_role) setRole(profile.preferred_role)
  }, [profile?.preferred_role])

  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  const flushSaveRef = useRef(flushSave)
  undoRef.current = undo
  redoRef.current = redo
  flushSaveRef.current = flushSave

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === "z" && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (freshPreview) {
      setWorkspace(createEmptyWorkspace())
      setWorkspaceId(null)
      setDoneKeys(new Set())
      setSelectedPaycheckId("")
      setLoadingWorkspace(false)
      setSaveReady(false)
      dirtyRef.current = false
      clearHistory()
      return
    }
    if (!user?.id) return
    let cancelled = false
    setLoadingWorkspace(true)
    setSaveReady(false)
    dirtyRef.current = false

    loadOrCreateWorkspace(user.id)
      .then((state) => {
        if (cancelled) return
        dirtyRef.current = false
        workspaceRef.current = state.workspace
        doneKeysRef.current = new Set(state.doneKeys)
        setWorkspaceId(state.id)
        setWorkspace(state.workspace)
        setDoneKeys(new Set(state.doneKeys))
        const active = getActiveYearBudget(state.workspace)
        setSelectedPaycheckId(
          active.paychecks.find((p) => !p.completed)?.id ??
            active.paychecks[0]?.id ??
            "",
        )
        clearHistory()
        setLoadError(null)
        setSaveError(null)
        setLoadingWorkspace(false)
        setSaveStatus("idle")
        setSaveReady(true)
      })
      .catch((err: Error) => {
        if (cancelled) return
        const msg = err.message ?? String(err)
        const missingSchema =
          /budget_workspace|schema cache|get_email_for_username/i.test(msg)
        setLoadError(
          missingSchema
            ? "Database tables aren’t set up yet. In Supabase → SQL Editor, paste and Run supabase/schema.sql, then refresh this page."
            : msg,
        )
        setWorkspace(createEmptyWorkspace())
        setWorkspaceId(null)
        clearHistory()
        setSaveReady(false)
        setLoadingWorkspace(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, freshPreview])

  // Flush pending edits if the tab is closing/hiding before debounce fires
  useEffect(() => {
    function onFlush() {
      void flushSaveRef.current()
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") onFlush()
    }
    window.addEventListener("pagehide", onFlush)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", onFlush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  async function onUserChange(next: UserRole) {
    setRole(next)
    try {
      await setPreferredRole(next)
    } catch {
      // Keep local toggle even if profile update fails
    }
  }

  function switchYear(year: number) {
    recordHistory()
    patchWorkspace((prev) => {
      const leaving = updateActiveYearBudget(prev, (y) => ({
        ...y,
        doneKeys: [...doneKeysRef.current],
      }))
      const next = setActiveYear(leaving, year)
      const slice = getActiveYearBudget(next)
      doneKeysRef.current = new Set(slice.doneKeys)
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
    recordHistory()
    patchWorkspace((prev) => {
      const withDone = updateActiveYearBudget(prev, (y) => ({
        ...y,
        doneKeys: [...doneKeysRef.current],
      }))
      const next = createNextYear(withDone)
      const slice = getActiveYearBudget(next)
      doneKeysRef.current = new Set(slice.doneKeys)
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
    recordHistory()
    patchDoneKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function onAmountChange(categoryId: string, date: string, value: string) {
    recordHistory(`amount:${categoryId}:${date}`)
    const trimmed = value.trim()
    const num = Number(trimmed.replace(/,/g, ""))
    const parsed =
      trimmed === "" || !Number.isFinite(num) || num === 0
        ? ("" as const)
        : num
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            return {
              ...cat,
              allocations: {
                ...cat.allocations,
                [date]: parsed,
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
    const trimmed = value.trim()
    const num = Number(trimmed.replace(/,/g, ""))
    const nextVal =
      trimmed === "" || !Number.isFinite(num) || num === 0
        ? ("" as const)
        : num

    recordHistory()
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            return {
              ...cat,
              allocations: applyAmountToFuture(
                cat,
                year.paychecks,
                fromDate,
                nextVal,
              ),
            }
          }),
        })),
      })),
    )
  }

  function onCategoryFieldChange(
    categoryId: string,
    field: "goal" | "amount",
    value: string,
  ) {
    recordHistory(`field:${categoryId}:${field}`)
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((bucket) => ({
          ...bucket,
          categories: bucket.categories.map((cat) => {
            if (cat.id !== categoryId) return cat
            const trimmed = value.trim()
            if (trimmed === "") {
              if (field === "amount") {
                return {
                  ...cat,
                  amount: undefined,
                  recurringAmount: undefined,
                  minPayment: undefined,
                }
              }
              return { ...cat, goal: undefined }
            }
            const parsed = Number(trimmed.replace(/,/g, ""))
            if (!Number.isFinite(parsed)) return cat
            if (field === "amount") {
              return {
                ...cat,
                amount: parsed,
                recurringAmount: parsed,
                isRecurring: true,
              }
            }
            return { ...cat, goal: parsed }
          }),
        })),
      })),
    )
  }

  function onAddBucket(bucket: Bucket) {
    recordHistory()
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: [...year.buckets, bucket],
      })),
    )
  }

  function onUpdateBucket(bucket: Bucket) {
    recordHistory()
    if (bucket.kind === "income") {
      const today = new Date().toISOString().slice(0, 10)
      patchWorkspace((prev) =>
        updateActiveYearBudget(prev, (year) => {
          const yearNum = prev.activeYear
          const yearPrefix = String(yearNum)
          const generated = generatePaychecksFromIncomeBucket(bucket, yearNum)
          const prevByDate = new Map(year.paychecks.map((p) => [p.date, p]))
          const generatedDates = new Set(generated.map((p) => p.date))
          const retainedPast = year.paychecks.filter(
            (p) =>
              p.date.startsWith(yearPrefix) &&
              p.date < today &&
              !generatedDates.has(p.date),
          )
          const merged = [...retainedPast, ...generated]
            .filter((p) => p.date.startsWith(yearPrefix))
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
            year: yearNum,
          })
          const withIncome = {
            ...year,
            buckets: year.buckets.map((b) => (b.id === next.id ? next : b)),
            paychecks,
          }
          return syncYearPrefills(withIncome, yearNum)
        }),
      )
      return
    }
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: year.buckets.map((b) => (b.id === bucket.id ? bucket : b)),
      })),
    )
  }

  function onReorderBuckets(fromId: string, beforeId: string | null) {
    recordHistory()
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) => ({
        ...year,
        buckets: reorderById(year.buckets, fromId, beforeId),
      })),
    )
  }

  function onSetupIncome(sources: IncomeSourceInput[]) {
    recordHistory()
    patchWorkspace((prev) => {
      const yearNum = prev.activeYear
      const anchored = sources.map((s) => ({
        ...s,
        recurrence: {
          ...s.recurrence,
          startDate: s.recurrence.startDate.startsWith(String(yearNum))
            ? s.recurrence.startDate
            : `${yearNum}-01-01`,
        },
      }))
      const paychecks = generatePaychecksFromIncome(anchored, yearNum)
      const incomeBucket = buildIncomeBucket(anchored, paychecks, yearNum)
      setSelectedPaycheckId(
        paychecks.find((p) => !p.completed)?.id ?? paychecks[0]?.id ?? "",
      )
      return updateActiveYearBudget(prev, (year) =>
        syncYearPrefills(
          {
            ...year,
            buckets: [
              incomeBucket,
              ...year.buckets.filter((b) => b.kind !== "income"),
            ],
            paychecks,
          },
          yearNum,
        ),
      )
    })
  }

  function onPaycheckDateChange(paycheckId: string, date: string) {
    recordHistory()
    patchWorkspace((prev) =>
      updateActiveYearBudget(prev, (year) =>
        renamePaycheckDate(year, paycheckId, date),
      ),
    )
  }

  function onToggleHolderFlag(
    paycheckId: string,
    field: "received" | "boaMoved" | "sofiMoved",
  ) {
    recordHistory()
    patchWorkspace((prev) =>
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

      {loadError ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-[60px] py-2 text-xs text-destructive">
          Couldn’t load: {loadError}
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
            onAmountCommit={onAmountCommit}
            onCategoryFieldChange={onCategoryFieldChange}
            onAddBucket={onAddBucket}
            onUpdateBucket={onUpdateBucket}
            onReorderBuckets={onReorderBuckets}
            onSetupIncome={onSetupIncome}
            onPaycheckDateChange={onPaycheckDateChange}
            canUndo={undoDepth > 0}
            canRedo={redoDepth > 0}
            onUndo={undo}
            onRedo={redo}
            saveStatus={saveStatus}
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
