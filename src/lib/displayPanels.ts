export const DISPLAY_PANEL_ORDER = ["today", "passport", "lunch", "student", "debts", "calendar"] as const;
export type DisplayPanelKey = typeof DISPLAY_PANEL_ORDER[number];
export const DISPLAY_PANEL_LABEL: Record<DisplayPanelKey, string> = {
  today: "聯絡簿", passport: "護照與閱讀", lunch: "午餐",
  student: "學生資訊", debts: "欠繳作業", calendar: "行事曆",
};

export function isDisplayHiddenPanels(value: unknown): value is DisplayPanelKey[] {
  return Array.isArray(value) && value.length <= DISPLAY_PANEL_ORDER.length
    && new Set(value).size === value.length
    && value.every((key) => DISPLAY_PANEL_ORDER.includes(key));
}

export function visibleDisplayPanels(hidden: readonly DisplayPanelKey[] = []): DisplayPanelKey[] {
  return DISPLAY_PANEL_ORDER.filter((key) => !hidden.includes(key));
}

export function resolveDisplayPanel(current: DisplayPanelKey, visible: readonly DisplayPanelKey[]): DisplayPanelKey | null {
  return visible.includes(current) ? current : visible[0] ?? null;
}
