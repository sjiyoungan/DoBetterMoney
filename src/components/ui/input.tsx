import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const fieldClassName =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

type DropdownOption = {
  value: string
  label: string
}

type InputTextProps = Omit<React.ComponentProps<"input">, "children"> & {
  variant?: "default"
  leftIcon?: boolean
  options?: never
  onValueChange?: never
}

type InputDropdownProps = {
  variant: "dropdown"
  leftIcon?: boolean
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options: DropdownOption[]
  id?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
}

type InputProps = InputTextProps | InputDropdownProps

function Input(props: InputProps) {
  if (props.variant === "dropdown") {
    const {
      leftIcon = false,
      value,
      onValueChange,
      placeholder,
      options,
      id,
      className,
      disabled,
      "aria-invalid": ariaInvalid,
    } = props

    return (
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={ariaInvalid || undefined}
          size="default"
          className={cn(
            "w-full",
            leftIcon && "pl-2.5",
            className,
          )}
        >
          {leftIcon ? (
            <span className="pr-1 text-sm text-muted-foreground/50">$</span>
          ) : null}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const { className, type, leftIcon = false, ...inputProps } = props

  if (leftIcon) {
    return (
      <div
        className={cn(
          "flex h-10 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:bg-input/30",
          className,
        )}
      >
        <span className="pr-1 text-sm text-muted-foreground/50">$</span>
        <input
          type={type}
          data-slot="input"
          className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          {...inputProps}
        />
      </div>
    )
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClassName, className)}
      {...inputProps}
    />
  )
}

export { Input, fieldClassName }
export type { DropdownOption, InputProps }
