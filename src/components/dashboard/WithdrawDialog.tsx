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
import { useEffect, useState } from "react"

export type WithdrawOption = {
  id: string
  name: string
  amount: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: WithdrawOption[]
  onWithdraw: (input: { categoryId: string; amount: number }) => void
}

export function WithdrawDialog({
  open,
  onOpenChange,
  options,
  onWithdraw,
}: Props) {
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (!open) return
    setAmount("")
    if (categoryId && options.some((o) => o.id === categoryId)) return
    setCategoryId(options[0]?.id ?? "")
  }, [open, options, categoryId])

  function submit() {
    const n = Number(amount)
    if (!categoryId || !Number.isFinite(n) || n <= 0) return
    const max = options.find((o) => o.id === categoryId)?.amount ?? 0
    const capped = Math.min(n, max)
    if (capped <= 0) return
    onWithdraw({ categoryId, amount: capped })
    onOpenChange(false)
    setAmount("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Withdraw</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="withdraw-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="withdraw-category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name} ({formatMoney(row.amount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="withdraw-amount">Amount</Label>
            <Input
              id="withdraw-amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
              Number(amount) <= 0
            }
            onClick={submit}
          >
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
