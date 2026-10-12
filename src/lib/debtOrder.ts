import type { DisplayDebtItem } from "@/types/display";

export function orderDebts(items: (DisplayDebtItem & { key: string })[], saved: string[]) {
  const ranks = new Map(saved.map((key, index) => [key, index]));
  return [...items].sort((a, b) => {
    const rank = (ranks.get(a.key) ?? Infinity) - (ranks.get(b.key) ?? Infinity);
    if (rank && !Number.isNaN(rank)) return rank;
    const aHomework = a.key.startsWith("homework:");
    const bHomework = b.key.startsWith("homework:");
    if (aHomework && bHomework) return (b.dueDate ?? "").localeCompare(a.dueDate ?? "");
    return 0;
  });
}
