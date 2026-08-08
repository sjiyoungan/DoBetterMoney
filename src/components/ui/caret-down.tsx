import type { SVGProps } from "react"
import { cn } from "@/lib/utils"

/**
 * Solid filled down triangle with slightly rounded tips.
 * Use as a dropdown indicator (not a stroke chevron).
 */
export function CaretDownIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 10 7"
      fill="currentColor"
      aria-hidden
      className={cn("size-2.5 shrink-0", className)}
      {...props}
    >
      <path d="M.95.75c-.47 0-.73.58-.45.95l4.05 5.35c.25.4.65.4.9 0l4.05-5.35c.28-.37.02-.95-.45-.95H.95z" />
    </svg>
  )
}
