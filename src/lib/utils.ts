import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Soft blush hover wash for interactive cards / label buttons on white */
export const blushHoverClass =
  "hover:bg-[linear-gradient(160deg,#F7EBEE_0%,#FFFFFF_72%)]"

/** Sticky footer label hover: white → grey-pink fill (#F3EBED) */
export const stickyBlushHoverClass =
  "hover:bg-[linear-gradient(160deg,#FFFFFF_0%,#F3EBED_72%)]"
