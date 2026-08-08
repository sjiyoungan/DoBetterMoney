import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Soft blush hover wash for interactive cards / label buttons */
export const blushHoverClass =
  "hover:bg-[linear-gradient(160deg,#F7EBEE_0%,#FFFFFF_72%)]"
