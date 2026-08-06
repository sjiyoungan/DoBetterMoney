import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/auth/AuthProvider"
import { BudgetGrid } from "@/components/dashboard/BudgetGrid"
import { HolderPanel } from "@/components/holder/HolderPanel"
import { AppHeader } from "@/components/layout/AppHeader"
import { mockWorkspace } from "@/data/mock"
import {
  loadOrCreateWorkspace,
  saveWorkspace,
} from "@/lib/workspace-api"
import type { Bucket, BudgetWorkspace, UserRole } from "@/types/budget"

export default function App() {
  const { user, profile, setPreferredRole, signOut } = useAuth()
  const [role, setRole] = useState<UserRole>("liz")
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<BudgetWorkspace>(mockWorkspace)
  const [selectedPaycheckId, setSelectedPaycheckId] = useState(
    () => mockWorkspace.paychecks.find((p) => !p.completed)?.id ?? "p15",
  )
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyToSave = useRef(false)

  useEffect(() => {
    if (profile?.preferred_role) setRole(profile.preferred_role)
  }, [profile?.preferred_role])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingWorkspace(true)
    readyToSave.current = false

    loadOrCreateWorkspace(user.id)
      .then((state) => {
        if (cancelled) return
        setWorkspaceId(state.id)
        setWorkspace(state.workspace)
        setDoneKeys(new Set(state.doneKeys))
        setSelectedPaycheckId(
          state.workspace.paychecks.find((p) => !p.completed)?.id ??
            state.workspace.paychecks[0]?.id ??
            "",
        )
        setLoadingWorkspace(false)
        // Avoid saving the initial hydrate
        queueMicrotask(() => {
          readyToSave.current = true
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setSaveError(err.message)
        setLoadingWorkspace(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user || !workspaceId || !readyToSave.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      saveWorkspace(workspaceId, workspace, [...doneKeys], user.id)
        .then(() => setSaveError(null))
        .catch((err: Error) => setSaveError(err.message))
    }, 600)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [workspace, doneKeys, workspaceId, user])

  async function onUserChange(next: UserRole) {
    setRole(next)
    try {
      await setPreferredRole(next)
    } catch {
      // Keep local toggle even if profile update fails
    }
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

  function onCategoryFieldChange(
    categoryId: string,
    field: "goal" | "balance",
    value: string,
  ) {
    setWorkspace((prev) => ({
      ...prev,
      buckets: prev.buckets.map((bucket) => ({
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
    }))
  }

  function onAddBucket(bucket: Bucket) {
    setWorkspace((prev) => ({
      ...prev,
      buckets: [...prev.buckets, bucket],
    }))
  }

  function onUpdateBucket(bucket: Bucket) {
    setWorkspace((prev) => ({
      ...prev,
      buckets: prev.buckets.map((b) => (b.id === bucket.id ? bucket : b)),
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
      />

      {saveError ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-[60px] py-2 text-xs text-destructive">
          Couldn’t save: {saveError}
        </div>
      ) : null}

      <main className="px-[60px] py-4">
        {role === "liz" ? (
          <BudgetGrid
            buckets={workspace.buckets}
            paychecks={workspace.paychecks}
            doneKeys={doneKeys}
            onToggleDone={toggleDone}
            onAmountChange={onAmountChange}
            onCategoryFieldChange={onCategoryFieldChange}
            onAddBucket={onAddBucket}
            onUpdateBucket={onUpdateBucket}
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
