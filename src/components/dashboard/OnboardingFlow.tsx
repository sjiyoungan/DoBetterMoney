import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { FirstGroupForm } from "@/components/dashboard/FirstGroupForm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IncomeSourceInput } from "@/lib/income-schedule"
import type { Bucket, PayFrequency } from "@/types/budget"

type IncomeDraft = {
  id: string
  name: string
  amount: string
  frequency: PayFrequency | ""
}

type Props = {
  hasIncome: boolean
  onSetupIncome: (sources: IncomeSourceInput[]) => void
  onAddGroup: (bucket: Bucket) => void
}

function newIncomeDraft(): IncomeDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    frequency: "",
  }
}

function parseAmount(value: string): number | undefined {
  const trimmed = value.trim().replace(/,/g, "")
  if (trimmed === "") return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function OnboardingFlow({
  hasIncome,
  onSetupIncome,
  onAddGroup,
}: Props) {
  const [step, setStep] = useState<"income" | "group">(
    hasIncome ? "group" : "income",
  )
  const [drafts, setDrafts] = useState<IncomeDraft[]>([newIncomeDraft()])

  const canContinue = useMemo(
    () =>
      drafts.some((d) => {
        const amount = parseAmount(d.amount)
        return d.name.trim() !== "" && amount !== undefined && d.frequency !== ""
      }),
    [drafts],
  )

  function updateDraft(id: string, patch: Partial<IncomeDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function handleContinue() {
    const sources: IncomeSourceInput[] = drafts
      .map((d) => {
        const amount = parseAmount(d.amount)
        if (!d.name.trim() || amount === undefined || !d.frequency) return null
        return {
          name: d.name.trim(),
          amount,
          frequency: d.frequency,
        }
      })
      .filter((s): s is IncomeSourceInput => s !== null)

    if (sources.length === 0) return
    onSetupIncome(sources)
    setStep("group")
  }

  if (step === "group") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 pt-[60px]">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Create your first group
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Groups hold related categories like bills or savings.
          </p>
        </div>
        <FirstGroupForm onCreate={onAddGroup} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pt-[60px]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Tell us about your income
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add each paycheck or income source you want to plan around.
        </p>
      </div>

      <div className="space-y-6">
        {drafts.map((draft, index) => (
          <div key={draft.id} className="space-y-3">
            {drafts.length > 1 ? (
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Income {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() =>
                    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                  }
                  title="Remove"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor={`income-name-${draft.id}`}
              >
                Income
              </label>
              <Input
                id={`income-name-${draft.id}`}
                value={draft.name}
                onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                placeholder="Air Techniques"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor={`income-amount-${draft.id}`}
              >
                Amount
              </label>
              <div className="flex h-10 items-center rounded-lg border border-input px-2.5">
                <span className="pr-1 text-sm text-muted-foreground/50">$</span>
                <input
                  id={`income-amount-${draft.id}`}
                  className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  value={draft.amount}
                  onChange={(e) =>
                    updateDraft(draft.id, { amount: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder="1,000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Pay frequency</label>
              <Select
                value={draft.frequency || undefined}
                onValueChange={(value) =>
                  updateDraft(draft.id, {
                    frequency: value as PayFrequency,
                  })
                }
              >
                <SelectTrigger size="default" className="w-full">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-1"
          onClick={() => setDrafts((prev) => [...prev, newIncomeDraft()])}
        >
          <Plus className="size-3.5" />
          Add another
        </Button>
        <Button
          type="button"
          className="h-10 px-5"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
