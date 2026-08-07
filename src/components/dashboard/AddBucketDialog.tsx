import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Eye, EyeOff, Menu, Pencil, Plus, Trash2 } from "lucide-react"
import { FrequencyEditor } from "@/components/dashboard/FrequencyEditor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { prefillAllocations, mergeAllocationsOntoPaychecks } from "@/lib/allocations"
import {
  formatRecurrenceSummary,
  legacyFrequencyToRecurrence,
} from "@/lib/recurrence"
import { isReorderNoOp, reorderById } from "@/lib/reorder"
import type {
  Bucket,
  BucketKind,
  Category,
  CategoryVariability,
  IncomeRecurrence,
  PayFrequency,
  Paycheck,
} from "@/types/budget"

export type BucketDraftType = "expenses" | "savings" | "income"

type CategoryDraft = {
  id: string
  name: string
  amount: string
  goal: string
  dueDay: string
  frequency: PayFrequency | ""
  recurrence: IncomeRecurrence | null
  variability: CategoryVariability | ""
  hidden: boolean
}

type Props = {
  open: boolean
  bucket?: Bucket | null
  paychecks?: Paycheck[]
  onOpenChange: (open: boolean) => void
  onAdd: (bucket: Bucket) => void
  onUpdate: (bucket: Bucket) => void
}

const fieldH = "h-10" // 40px
const selectH = "h-10 w-full data-[size=default]:h-10"
/** Type column hugs “Select type” / Fixed / Variable */
const selectTypeH = "h-10 w-full data-[size=default]:h-10"
const selectFreqH = "h-10 w-full data-[size=default]:h-10"

/** Eye 24px · fields · trash 28px · rearrange grip 24px */
const COL_EXP =
  "grid-cols-[24px_minmax(0,200px)_68px_64px_9.75rem_7.5rem_28px_24px]" as const
const COL_INC =
  "grid-cols-[24px_minmax(0,238px)_68px_minmax(11rem,1fr)_28px_24px]" as const
const COL_SAV =
  "grid-cols-[24px_minmax(0,1fr)_68px_68px_28px_24px]" as const

const TYPE_LABEL: Record<BucketDraftType, string> = {
  expenses: "Expenses",
  savings: "Savings",
  income: "Income",
}

const FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
]

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    goal: "",
    dueDay: "",
    frequency: "",
    recurrence: null,
    variability: "",
    hidden: false,
  }
}

function mapType(type: BucketDraftType): BucketKind {
  if (type === "savings") return "savings"
  if (type === "income") return "income"
  return "spending"
}

function kindToDraftType(kind: BucketKind): BucketDraftType {
  if (kind === "savings") return "savings"
  if (kind === "income") return "income"
  return "expenses"
}

function parseNum(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const n = Number(trimmed.replace(/,/g, ""))
  return Number.isFinite(n) ? n : undefined
}

function ordinalSuffix(day: number): string {
  const j = day % 10
  const k = day % 100
  if (j === 1 && k !== 11) return "st"
  if (j === 2 && k !== 12) return "nd"
  if (j === 3 && k !== 13) return "rd"
  return "th"
}

function bucketToDrafts(bucket: Bucket): CategoryDraft[] {
  if (bucket.categories.length === 0) return [newDraft()]
  return bucket.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    amount:
      bucket.kind === "savings"
        ? cat.balance === undefined
          ? ""
          : String(cat.balance)
        : cat.amount !== undefined
          ? String(cat.amount)
          : cat.recurringAmount !== undefined
            ? String(cat.recurringAmount)
            : cat.minPayment !== undefined
              ? String(cat.minPayment)
              : "",
    goal: cat.goal === undefined ? "" : String(cat.goal),
    dueDay:
      cat.dueDay !== undefined
        ? String(cat.dueDay)
        : cat.dueDate && /^\d+$/.test(cat.dueDate)
          ? cat.dueDate
          : "",
    frequency: cat.frequency ?? "",
    recurrence:
      cat.recurrence ??
      (cat.frequency ? legacyFrequencyToRecurrence(cat.frequency) : null),
    variability: cat.variability ?? "",
    hidden: !!cat.hidden,
  }))
}

function resolveAllocations(opts: {
  prev?: Category
  paychecks: Paycheck[]
  frequency: PayFrequency | ""
  amount: number | undefined
  dueDay: number | undefined
}) {
  const { prev, paychecks, frequency, amount, dueDay } = opts
  if (!frequency || amount === undefined) {
    return prev?.allocations ?? {}
  }

  const prevAmount = prev?.amount ?? prev?.recurringAmount
  const unchanged =
    prev &&
    prev.frequency === frequency &&
    prevAmount === amount &&
    (prev.dueDay ?? undefined) === dueDay

  const hasFilledCell =
    prev &&
    Object.values(prev.allocations).some(
      (v) => v !== "" && v !== undefined && Number(v) !== 0,
    )

  // Keep manual/edited cells when inputs match; still fill if calendar was empty
  if (unchanged && hasFilledCell) {
    const filled = prefillAllocations({
      paychecks,
      frequency,
      amount,
      dueDay,
    })
    return mergeAllocationsOntoPaychecks(paychecks, prev.allocations, filled)
  }

  return prefillAllocations({
    paychecks,
    frequency,
    amount,
    dueDay,
  })
}

function draftsToBucket(
  bucketName: string,
  bucketType: BucketDraftType,
  drafts: CategoryDraft[],
  paychecks: Paycheck[],
  existing?: Bucket | null,
): Bucket {
  const bucketKind = mapType(bucketType)

  const categories: Category[] = drafts.map((d) => {
    const prev = existing?.categories.find((c) => c.id === d.id)
    const amount = parseNum(d.amount)
    const goal = parseNum(d.goal)
    const dueDayRaw = parseNum(d.dueDay)
    const dueDay =
      dueDayRaw !== undefined && dueDayRaw >= 1 && dueDayRaw <= 31
        ? Math.round(dueDayRaw)
        : undefined
    const frequency = d.frequency

    const base: Category = {
      id: prev?.id ?? crypto.randomUUID(),
      name: d.name.trim(),
      allocations: resolveAllocations({
        prev,
        paychecks,
        frequency,
        amount,
        dueDay,
      }),
      ...(d.variability ? { variability: d.variability } : {}),
      ...(frequency ? { frequency } : {}),
      ...(d.hidden ? { hidden: true } : {}),
    }

    if (bucketKind === "savings") {
      const carryOver = amount
      return {
        id: prev?.id ?? crypto.randomUUID(),
        name: d.name.trim(),
        allocations: prev?.allocations ?? {},
        goal: goal ?? prev?.goal ?? 0,
        balance: carryOver ?? prev?.balance ?? 0,
        ...(d.hidden ? { hidden: true } : {}),
      }
    }

    if (bucketKind === "income") {
      const recurrence = d.recurrence
      const derivedFreq: PayFrequency | undefined =
        recurrence?.unit === "week" && recurrence.interval === 1
          ? "weekly"
          : recurrence?.unit === "week" && recurrence.interval === 2
            ? "biweekly"
            : recurrence?.unit === "month"
              ? "monthly"
              : d.frequency || undefined
      return {
        id: prev?.id ?? crypto.randomUUID(),
        name: d.name.trim(),
        allocations: prev?.allocations ?? {},
        ...(amount !== undefined ? { amount } : {}),
        ...(recurrence ? { recurrence } : {}),
        ...(derivedFreq ? { frequency: derivedFreq } : {}),
        ...(d.hidden ? { hidden: true } : {}),
      }
    }

    return {
      ...base,
      ...(amount !== undefined
        ? { amount, recurringAmount: amount, isRecurring: true }
        : {}),
      ...(dueDay !== undefined ? { dueDay } : {}),
    }
  })

  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: bucketName.trim(),
    kind: bucketKind,
    note: existing?.note,
    categories,
  }
}

function snapshotKey(
  name: string,
  type: BucketDraftType | "",
  drafts: CategoryDraft[],
) {
  return JSON.stringify({
    name: name.trim(),
    type,
    drafts: drafts.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      amount: d.amount.trim(),
      goal: d.goal.trim(),
      dueDay: d.dueDay.trim(),
      frequency: d.frequency,
      recurrence: d.recurrence,
      variability: d.variability,
      hidden: d.hidden,
    })),
  })
}

function HideToggle({
  hidden,
  onToggle,
}: {
  hidden: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "-ml-1 size-7 shrink-0 justify-self-start text-muted-foreground hover:bg-transparent",
        hidden
          ? "text-neutral-400 hover:text-neutral-400"
          : "hover:text-foreground",
      )}
      onClick={onToggle}
      title={hidden ? "Show category" : "Hide category"}
    >
      {hidden ? (
        <EyeOff className="size-3.5" />
      ) : (
        <Eye className="size-3.5" />
      )}
    </Button>
  )
}

function ReorderGrip({
  active,
  dimmed,
  onPointerDown,
}: {
  active: boolean
  dimmed?: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      title="Rearrange category"
      aria-label="Rearrange category"
      onPointerDown={onPointerDown}
      className={cn(
        "flex h-10 w-full cursor-grab items-center justify-center justify-self-stretch text-neutral-400 opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing",
        dimmed && "text-neutral-400",
        active && "opacity-100",
      )}
    >
      <Menu className="size-3.5" strokeWidth={2} />
    </button>
  )
}

/** Thinner than the main grid drop line (2px vs 4px). */
function CategoryDropLine({
  show,
  edge,
}: {
  show: boolean
  edge: "top" | "bottom"
}) {
  if (!show) return null
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-neutral-900",
        edge === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
      )}
    />
  )
}

function draftRowClass(hidden: boolean, cols: string) {
  return cn(
    "group/row relative grid items-center gap-2",
    cols,
    hidden && "text-neutral-400",
  )
}

function dimField(hidden: boolean) {
  return hidden
    ? "border-neutral-300 text-neutral-400 hover:border-neutral-300 focus-within:border-neutral-300 focus-within:ring-0"
    : undefined
}

function dimTrigger(hidden: boolean) {
  return hidden
    ? "border-neutral-300 text-neutral-400 hover:bg-transparent hover:text-neutral-400"
    : undefined
}

function draftHasData(d: CategoryDraft) {
  return (
    d.name.trim() !== "" ||
    d.amount.trim() !== "" ||
    d.goal.trim() !== "" ||
    d.dueDay.trim() !== ""
  )
}

/** Money field with persistent $ prefix; always tabbable */
function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  dimmed = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-md border px-1.5",
        dimmed
          ? "border-neutral-300"
          : "border-input hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
    >
      <span
        className={cn(
          "pr-1 text-sm",
          dimmed ? "text-neutral-400" : "text-neutral-500",
        )}
      >
        $
      </span>
      <input
        className={cn(
          "h-full w-full bg-transparent text-right text-sm tabular-nums outline-none",
          dimmed
            ? "text-neutral-400 placeholder:text-neutral-300"
            : "text-foreground placeholder:text-muted-foreground/50",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        inputMode="numeric"
        placeholder={placeholder}
      />
    </div>
  )
}

/** Due day: digits only; always tabbable; small gray ordinal when valid */
function DueDayInput({
  value,
  onChange,
  onCommit,
  invalid = false,
  dimmed = false,
}: {
  value: string
  onChange: (value: string) => void
  onCommit?: (value: string) => void
  invalid?: boolean
  dimmed?: boolean
}) {
  const day = parseNum(value)
  const valid = day !== undefined && day >= 1 && day <= 31
  const n = valid ? Math.round(day) : null

  return (
    <div
      className={cn(
        "flex h-10 items-center justify-end rounded-md border px-1.5",
        invalid
          ? "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/25"
          : dimmed
            ? "border-neutral-300"
            : "border-input hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
    >
      <input
        className={cn(
          "h-full w-full min-w-0 bg-transparent text-right text-sm tabular-nums outline-none",
          dimmed ? "text-neutral-400" : "text-foreground",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onBlur={(e) => onCommit?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        inputMode="numeric"
      />
      {n !== null ? (
        <span
          className={cn(
            "shrink-0 text-[10px] leading-none",
            dimmed ? "text-neutral-400" : "text-muted-foreground",
          )}
        >
          {ordinalSuffix(n)}
        </span>
      ) : null}
    </div>
  )
}

function isDueDayInvalid(dueDay: string) {
  if (dueDay.trim() === "") return false
  const day = parseNum(dueDay)
  return day === undefined || day < 1 || day > 31
}

export function AddBucketDialog({
  open,
  bucket = null,
  paychecks = [],
  onOpenChange,
  onAdd,
  onUpdate,
}: Props) {
  const editing = !!bucket
  const [bucketName, setBucketName] = useState("")
  const [bucketType, setBucketType] = useState<BucketDraftType | "">("")
  const [drafts, setDrafts] = useState<CategoryDraft[]>([newDraft()])
  const [baseline, setBaseline] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [dueDayError, setDueDayError] = useState(false)
  const [frequencyDraftId, setFrequencyDraftId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null | undefined>(
    undefined,
  )
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const dragMovedRef = useRef(false)

  useLayoutEffect(() => {
    if (!open) return
    if (bucket) {
      const nextDrafts = bucketToDrafts(bucket)
      const nextType = kindToDraftType(bucket.kind)
      setBucketName(bucket.name)
      setBucketType(nextType)
      setDrafts(nextDrafts)
      setBaseline(snapshotKey(bucket.name, nextType, nextDrafts))
    } else {
      const nextDrafts = [newDraft()]
      setBucketName("")
      setBucketType("")
      setDrafts(nextDrafts)
      setBaseline(snapshotKey("", "", nextDrafts))
    }
    setConfirmOpen(false)
    setRemoveId(null)
    setEditingName(false)
    setTypeOpen(false)
    setDueDayError(false)
    setFrequencyDraftId(null)
    setDraggingId(null)
    setDropBeforeId(undefined)
  }, [open, bucket])

  const draftIds = useMemo(() => drafts.map((d) => d.id), [drafts])

  const dropIndicatorActive =
    draggingId !== null &&
    dropBeforeId !== undefined &&
    !isReorderNoOp(draftIds, draggingId, dropBeforeId)

  // Category rearrange within the modal list
  useEffect(() => {
    if (!draggingId) return

    const resolveDropBefore = (clientY: number) => {
      for (let i = 0; i < draftIds.length; i++) {
        const id = draftIds[i]!
        const el = rowRefs.current.get(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (clientY < rect.top) return id
        if (clientY <= rect.bottom) {
          const mid = rect.top + rect.height / 2
          if (clientY < mid) return id
          return draftIds[i + 1] ?? null
        }
      }
      return null
    }

    const onMove = (e: PointerEvent) => {
      dragMovedRef.current = true
      setDropBeforeId(resolveDropBefore(e.clientY))
    }

    const onUp = (e: PointerEvent) => {
      const before = resolveDropBefore(e.clientY)
      const from = draggingId
      setDraggingId(null)
      setDropBeforeId(undefined)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
      if (
        dragMovedRef.current &&
        !isReorderNoOp(draftIds, from, before)
      ) {
        setDrafts((prev) => reorderById(prev, from, before))
      }
    }

    document.body.style.cursor = "grabbing"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [draggingId, draftIds])

  const dirty = useMemo(
    () => snapshotKey(bucketName, bucketType, drafts) !== baseline,
    [bucketName, bucketType, drafts, baseline],
  )

  const canSubmit =
    dirty &&
    bucketName.trim() !== "" &&
    bucketType !== "" &&
    drafts.some((d) => d.name.trim() !== "") &&
    !drafts.some((d) => isDueDayInvalid(d.dueDay))

  const frequencyTarget = frequencyDraftId
    ? drafts.find((d) => d.id === frequencyDraftId)
    : undefined
  const removeTarget = removeId
    ? drafts.find((d) => d.id === removeId)
    : undefined
  const nestedOpen = confirmOpen || !!removeId || !!frequencyDraftId

  function closeClean() {
    setConfirmOpen(false)
    setRemoveId(null)
    onOpenChange(false)
  }

  function requestClose() {
    if (nestedOpen) return
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    closeClean()
  }

  function requestRemove(id: string) {
    const draft = drafts.find((d) => d.id === id)
    if (!draft) return
    const existed = bucket?.categories.some((c) => c.id === id)
    if (existed || draftHasData(draft)) {
      setRemoveId(id)
      return
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  function confirmRemove() {
    if (!removeId) return
    setDrafts((prev) => prev.filter((d) => d.id !== removeId))
    setRemoveId(null)
  }

  function handleSubmit() {
    if (!canSubmit || !bucketType) return
    const validDrafts = drafts.filter((d) => d.name.trim() !== "")
    const next = draftsToBucket(
      bucketName,
      bucketType,
      validDrafts,
      paychecks,
      bucket,
    )
    if (editing) onUpdate(next)
    else onAdd(next)
    closeClean()
  }

  function updateDraft(id: string, patch: Partial<CategoryDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function setRowRef(id: string, el: HTMLDivElement | null) {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }

  function startCategoryDrag(
    draftId: string,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) {
    e.preventDefault()
    e.stopPropagation()
    dragMovedRef.current = false
    setDraggingId(draftId)
    setDropBeforeId(draftId)
  }

  function isDropBeforeRow(draftId: string) {
    return (
      dropIndicatorActive &&
      dropBeforeId !== undefined &&
      dropBeforeId === draftId
    )
  }

  function isDropAfterLastRow(draftId: string) {
    const lastId = draftIds[draftIds.length - 1]
    return (
      dropIndicatorActive &&
      dropBeforeId === null &&
      draftId === lastId
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true)
            return
          }
          // Nested confirm dialogs — don't treat as closing the group dialog
          if (confirmOpen || removeId || frequencyDraftId) return
          // Tab blur / backgrounding can emit a dismiss — keep the modal open
          if (document.visibilityState === "hidden") return
          requestClose()
        }}
      >
        <DialogContent
          className="w-max max-w-[calc(100%-2rem)] gap-0 pt-4 pr-4 pb-6 pl-6 sm:max-w-none"
          showCloseButton={false}
          onPointerDownOutside={(e) => {
            e.preventDefault()
            if (confirmOpen || removeId || frequencyDraftId) return
            // Ignore dismissals from leaving the browser tab
            if (document.visibilityState === "hidden") return
            requestClose()
          }}
          onInteractOutside={(e) => {
            e.preventDefault()
            if (confirmOpen || removeId || frequencyDraftId) return
            if (document.visibilityState === "hidden") return
            requestClose()
          }}
          onFocusOutside={(e) => {
            // Keep the dialog open when focus leaves the page (tab switch)
            e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            if (frequencyDraftId) {
              setFrequencyDraftId(null)
              return
            }
            if (removeId) {
              setRemoveId(null)
              return
            }
            if (confirmOpen) {
              setConfirmOpen(false)
              return
            }
            requestClose()
          }}
        >
          {frequencyTarget ? (
            <FrequencyEditor
              value={frequencyTarget.recurrence}
              onCancel={() => setFrequencyDraftId(null)}
              onSave={(next) => {
                updateDraft(frequencyTarget.id, { recurrence: next })
                setFrequencyDraftId(null)
              }}
            />
          ) : (
            <>
          {/* Header — full-bleed divider like the footer, no fill */}
          <div className="-ml-6 -mr-4 border-b px-6 pr-4 pb-4">
            {!editing ? (
              <div className="flex items-center gap-3">
                <Input
                  autoFocus
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="Group name"
                  className={cn(fieldH, "min-w-0 flex-1 text-base md:text-sm")}
                />
                <Select
                  value={bucketType || undefined}
                  open={typeOpen}
                  onOpenChange={setTypeOpen}
                  onValueChange={(value) =>
                    setBucketType(value as BucketDraftType)
                  }
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      selectH,
                      "ml-auto w-auto shrink-0 text-foreground",
                    )}
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="end"
                    className="w-max min-w-[var(--radix-select-trigger-width)]"
                  >
                    <SelectItem value="expenses">Expenses</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="group flex min-h-10 min-w-0 items-center gap-1.5">
                  {editingName ? (
                    <input
                      autoFocus
                      className="min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur()
                      }}
                      placeholder="Group name"
                      size={Math.max(bucketName.length, 8)}
                    />
                  ) : (
                    <>
                      <h2 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">
                        {bucketName.trim() !== ""
                          ? bucketName
                          : "Group name"}
                      </h2>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        onClick={() => setEditingName(true)}
                        title="Edit name"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>

                <Select
                  value={bucketType || undefined}
                  open={typeOpen}
                  onOpenChange={setTypeOpen}
                  onValueChange={(value) =>
                    setBucketType(value as BucketDraftType)
                  }
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      "h-auto w-auto shrink-0 justify-start gap-1.5 border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground shadow-none",
                      "hover:bg-transparent hover:text-foreground",
                      "focus-visible:ring-0 focus-visible:outline-none",
                      "data-[size=default]:h-auto [&_svg]:size-3.5 [&_svg]:opacity-0 hover:[&_svg]:opacity-100 data-[state=open]:[&_svg]:opacity-100",
                    )}
                  >
                    <SelectValue>
                      {bucketType ? TYPE_LABEL[bucketType] : "Select type"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="w-max min-w-[var(--radix-select-trigger-width)]"
                  >
                    <SelectItem value="expenses">Expenses</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    {bucketType === "income" ? (
                      <SelectItem value="income">Income</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {bucketType === "savings" ? (
              <div
                className={cn(
                  "grid gap-2 text-xs font-medium text-muted-foreground",
                  COL_SAV,
                )}
              >
                <span />
                <span>Category</span>
                <span>Goal</span>
                <span>Carry over</span>
                <span />
                <span />
              </div>
            ) : bucketType === "income" ? (
              <div
                className={cn(
                  "grid gap-2 text-xs font-medium text-muted-foreground",
                  COL_INC,
                )}
              >
                <span />
                <span>Category</span>
                <span>Income</span>
                <span>Frequency</span>
                <span />
                <span />
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-2 text-xs font-medium text-muted-foreground",
                  COL_EXP,
                )}
              >
                <span />
                <span>Category</span>
                <span>Payment</span>
                <span>Due day</span>
                <span>Frequency</span>
                <span>Type</span>
                <span />
                <span />
              </div>
            )}

            {drafts.map((draft) => {
              const showTopLine = isDropBeforeRow(draft.id)
              const showBottomLine = isDropAfterLastRow(draft.id)
              const grip = (
                <ReorderGrip
                  active={draggingId === draft.id}
                  dimmed={draft.hidden}
                  onPointerDown={(e) => startCategoryDrag(draft.id, e)}
                />
              )

              if (bucketType === "savings") {
                return (
                  <div
                    key={draft.id}
                    ref={(el) => setRowRef(draft.id, el)}
                    className={cn(
                      draftRowClass(draft.hidden, COL_SAV),
                      draggingId === draft.id && "opacity-50",
                    )}
                  >
                    <CategoryDropLine show={showTopLine} edge="top" />
                    <CategoryDropLine show={showBottomLine} edge="bottom" />
                    <HideToggle
                      hidden={draft.hidden}
                      onToggle={() =>
                        updateDraft(draft.id, { hidden: !draft.hidden })
                      }
                    />
                    <Input
                      className={cn(fieldH, dimField(draft.hidden))}
                      value={draft.name}
                      onChange={(e) =>
                        updateDraft(draft.id, { name: e.target.value })
                      }
                      placeholder="Category name"
                    />
                    <MoneyInput
                      value={draft.goal}
                      onChange={(v) => updateDraft(draft.id, { goal: v })}
                      dimmed={draft.hidden}
                    />
                    <MoneyInput
                      value={draft.amount}
                      onChange={(v) => updateDraft(draft.id, { amount: v })}
                      dimmed={draft.hidden}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        "justify-self-end hover:bg-transparent",
                        draft.hidden
                          ? "text-neutral-400 hover:text-neutral-400"
                          : "text-muted-foreground",
                      )}
                      disabled={drafts.length === 1}
                      onClick={() => requestRemove(draft.id)}
                      title="Remove category"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    {grip}
                  </div>
                )
              }

              if (bucketType === "income") {
                return (
                  <div
                    key={draft.id}
                    ref={(el) => setRowRef(draft.id, el)}
                    className={cn(
                      draftRowClass(draft.hidden, COL_INC),
                      draggingId === draft.id && "opacity-50",
                    )}
                  >
                    <CategoryDropLine show={showTopLine} edge="top" />
                    <CategoryDropLine show={showBottomLine} edge="bottom" />
                    <HideToggle
                      hidden={draft.hidden}
                      onToggle={() =>
                        updateDraft(draft.id, { hidden: !draft.hidden })
                      }
                    />
                    <Input
                      className={cn(fieldH, dimField(draft.hidden))}
                      value={draft.name}
                      onChange={(e) =>
                        updateDraft(draft.id, { name: e.target.value })
                      }
                      placeholder="Category name"
                    />
                    <MoneyInput
                      value={draft.amount}
                      onChange={(v) => updateDraft(draft.id, { amount: v })}
                      dimmed={draft.hidden}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        fieldH,
                        "w-full justify-start truncate px-3 font-normal",
                        !draft.recurrence && "text-muted-foreground",
                        dimTrigger(draft.hidden),
                      )}
                      onClick={() => setFrequencyDraftId(draft.id)}
                    >
                      {draft.recurrence
                        ? formatRecurrenceSummary(draft.recurrence)
                        : "Select frequency"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        "justify-self-end hover:bg-transparent",
                        draft.hidden
                          ? "text-neutral-400 hover:text-neutral-400"
                          : "text-muted-foreground",
                      )}
                      disabled={drafts.length === 1}
                      onClick={() => requestRemove(draft.id)}
                      title="Remove category"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    {grip}
                  </div>
                )
              }

              return (
                <div
                  key={draft.id}
                  ref={(el) => setRowRef(draft.id, el)}
                  className={cn(
                    draftRowClass(draft.hidden, COL_EXP),
                    draggingId === draft.id && "opacity-50",
                  )}
                >
                  <CategoryDropLine show={showTopLine} edge="top" />
                  <CategoryDropLine show={showBottomLine} edge="bottom" />
                  <HideToggle
                    hidden={draft.hidden}
                    onToggle={() =>
                      updateDraft(draft.id, { hidden: !draft.hidden })
                    }
                  />
                  <Input
                    className={cn(fieldH, dimField(draft.hidden))}
                    value={draft.name}
                    onChange={(e) =>
                      updateDraft(draft.id, { name: e.target.value })
                    }
                    placeholder="Category name"
                  />
                  <MoneyInput
                    value={draft.amount}
                    onChange={(v) => updateDraft(draft.id, { amount: v })}
                    dimmed={draft.hidden}
                  />
                  <DueDayInput
                    value={draft.dueDay}
                    invalid={dueDayError && isDueDayInvalid(draft.dueDay)}
                    dimmed={draft.hidden}
                    onChange={(v) => {
                      updateDraft(draft.id, { dueDay: v })
                      if (dueDayError) {
                        setDueDayError(
                          drafts.some((d) =>
                            isDueDayInvalid(
                              d.id === draft.id ? v : d.dueDay,
                            ),
                          ),
                        )
                      }
                    }}
                    onCommit={(v) => {
                      setDueDayError(
                        drafts.some((d) =>
                          isDueDayInvalid(d.id === draft.id ? v : d.dueDay),
                        ),
                      )
                    }}
                  />
                  <Select
                    value={draft.frequency || undefined}
                    onValueChange={(value) =>
                      updateDraft(draft.id, {
                        frequency: value as PayFrequency,
                      })
                    }
                  >
                    <SelectTrigger
                      size="default"
                      className={cn(selectFreqH, dimTrigger(draft.hidden))}
                    >
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="min-w-0 w-[var(--radix-select-trigger-width)]"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.variability || undefined}
                    onValueChange={(value) =>
                      updateDraft(draft.id, {
                        variability: value as CategoryVariability,
                      })
                    }
                  >
                    <SelectTrigger
                      size="default"
                      className={cn(selectTypeH, dimTrigger(draft.hidden))}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="min-w-0 w-[var(--radix-select-trigger-width)]"
                    >
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="variable">Variable</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "justify-self-end hover:bg-transparent",
                      draft.hidden
                        ? "text-neutral-400 hover:text-neutral-400"
                        : "text-muted-foreground",
                    )}
                    disabled={drafts.length === 1}
                    onClick={() => requestRemove(draft.id)}
                    title="Remove category"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                  {grip}
                </div>
              )
            })}

            <Button
              type="button"
              variant="outline"
              className="ml-[calc(24px+0.5rem)] gap-1"
              onClick={() => setDrafts((prev) => [...prev, newDraft()])}
            >
              <Plus className="size-3.5" />
              {bucketType === "income" ? "Add another income" : "Add category"}
            </Button>
            {dueDayError ? (
              <p className="text-xs text-destructive">
                Due day can&apos;t be more than the days in a month.
              </p>
            ) : null}
          </div>

          <DialogFooter className="-ml-6 -mr-4 -mb-6 mt-5 items-center pl-6 pr-4 py-4 sm:justify-end sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="disabled:border-neutral-300 disabled:text-muted-foreground/70"
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-6 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits. If you cancel, that information will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={closeClean}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeId}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null)
        }}
      >
        <DialogContent className="p-6 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove category?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name
                ? `Removing “${removeTarget.name}” will delete its existing data from this group.`
                : "Removing this category will delete its existing data from this group."}{" "}
              This can’t be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveId(null)}
            >
              Keep category
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
