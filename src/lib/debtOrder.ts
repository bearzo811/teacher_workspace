import type { DisplayDebtItem } from "@/types/display";

export function orderDebts(items: (DisplayDebtItem & { key: string })[], saved: string[]) {
  const ranks = new Map(saved.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (ranks.get(a.key) ?? Infinity) - (ranks.get(b.key) ?? Infinity));
}
