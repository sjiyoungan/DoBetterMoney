import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Soft blush hover wash for interactive cards / label buttons on white */
export const blushHoverClass = "blush-hover"

/** Sticky footer label hover: white → grey-pink fill (#F3EBED) */
export const stickyBlushHoverClass = "sticky-blush-hover"
