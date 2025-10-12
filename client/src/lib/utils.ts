import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Permission helper
export function hasPermission(user: { permissions?: string[] } | null | undefined, perm: string): boolean {
  return !!user?.permissions?.includes(perm);
}

// Effective currency helper: prefer user currency, then app default, then XAF
export function getEffectiveCurrency(user?: { currency?: string | null; appDefaultCurrency?: string }) {
  return user?.currency || user?.appDefaultCurrency || 'XAF';
}

