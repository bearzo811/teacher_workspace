import { orderDebts } from "@/lib/debtOrder";
import type { DisplayDebtItem } from "@/types/display";

export type DebtChecklistItem = DisplayDebtItem & {
  key: string;
  category: "作業" | "護照" | "閱讀／讀報";
  contactBookDate?: string | null;
};

/** 列印包含所有待學生處理項目，不受大屏的其他項目顯示開關影響。 */
export function prepareDebtChecklist(items: DebtChecklistItem[], savedOrder: string[]): DebtChecklistItem[] {
  const outstanding = items.filter((item) =>
    item.status !== "completed" && item.status !== "pending_confirmation",
  );
  const byKey = new Map(outstanding.map((item) => [item.key, item]));
  return orderDebts(outstanding, savedOrder).map((item) => byKey.get(item.key)!);
}
