import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { WithdrawalKind } from "@/types/budget"

export type CashMoveOption = {
  id: string
  name: string
  amount: number
}

export type CashMoveSubmit = {
  categoryId: string
  amount: number
  kind?: WithdrawalKind
  note?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "withdraw" | "deposit"
  options: CashMoveOption[]
  /** When true (withdraw), amount is capped to the category balance. */
  capToBalance?: boolean
  onSubmit: (input: CashMoveSubmit) => void
}

export function CashMoveDialog({
  open,
  onOpenChange,
  mode,
  options,
  capToBalance = mode === "withdraw",
  onSubmit,
}: Props) {
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [kind, setKind] = useState<WithdrawalKind>("transfer")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open) return
    setAmount("")
    setKind("transfer")
    setNote("")
    if (categoryId && options.some((o) => o.id === categoryId)) return
    setCategoryId(options[0]?.id ?? "")
  }, [open, options, categoryId])

  function submit() {
    const n = Number(amount)
    if (!categoryId || !Number.isFinite(n) || n <= 0) return
    const max = options.find((o) => o.id === categoryId)?.amount ?? 0
    const capped = capToBalance ? Math.min(n, max) : n
    if (capped <= 0) return
    const trimmed = note.trim()
    onSubmit({
      categoryId,
      amount: capped,
      ...(mode === "withdraw" ? { kind } : {}),
      ...(trimmed ? { note: trimmed } : {}),
    })
    onOpenChange(false)
    setAmount("")
    setNote("")
  }

  const title = mode === "withdraw" ? "Withdraw" : "Deposit"
  const showBalance = mode === "withdraw" || options.some((o) => o.amount !== 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-category`}>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id={`${mode}-category`} className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {showBalance
                      ? `${row.name} (${formatMoney(row.amount)})`
                      : row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-amount`}>Amount</Label>
            <Input
              id={`${mode}-amount`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {mode === "withdraw" ? (
            <div className="grid gap-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    kind === "transfer"
                      ? "border-foreground bg-muted/60 text-foreground"
                      : "border-neutral-200 text-muted-foreground hover:border-neutral-300 hover:text-foreground",
                  )}
                  onClick={() => setKind("transfer")}
                >
                  <span className="block font-medium">Transfer</span>
                  <span className="mt-0.5 block text-xs leading-snug opacity-80">
                    Use savings for where it belongs
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    kind === "borrow"
                      ? "border-foreground bg-muted/60 text-foreground"
                      : "border-neutral-200 text-muted-foreground hover:border-neutral-300 hover:text-foreground",
                  )}
                  onClick={() => setKind("borrow")}
                >
                  <span className="block font-medium">Borrow</span>
                  <span className="mt-0.5 block text-xs leading-snug opacity-80">
                    Pull now, put back later
                  </span>
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-note`}>Comment</Label>
            <Input
              id={`${mode}-note`}
              type="text"
              placeholder="Optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !categoryId ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) <= 0 ||
              options.length === 0
            }
            onClick={submit}
          >
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
