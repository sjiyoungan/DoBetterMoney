import { useState } from "react"
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
import { Label } from "@/components/ui/label"

type Props = {
  open: boolean
  bucketName: string
  onOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
}

export function AddCategoryDialog({
  open,
  bucketName,
  onOpenChange,
  onAdd,
}: Props) {
  const [name, setName] = useState("")

  function reset() {
    setName("")
  }

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>
            Add a category under {bucketName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="category-name">Category name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={name.trim() === ""}
            onClick={handleAdd}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
