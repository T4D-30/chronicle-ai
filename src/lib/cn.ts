/**
 * cn — class name utility
 * Combines clsx (conditional class logic) with tailwind-merge
 * (deduplicates conflicting Tailwind classes).
 *
 * Every component in Chronicle AI imports from here rather than
 * defining its own local copy.
 */
import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
