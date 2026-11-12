export const modules = [
  { id: "homework", name: "聯絡簿與作業", description: "安排每日聯絡事項，追蹤作業繳交與訂正。" },
  { id: "routines", name: "每日任務", description: "追蹤打掃、刷牙等生活任務。" },
  { id: "duty", name: "值日工作", description: "分配及輪替班級工作。" },
  { id: "passport", name: "護照", description: "追蹤學校自訂的每週背誦任務。" },
  { id: "reading", name: "閱讀／讀報", description: "追蹤每月閱讀心得與讀報。" },
  { id: "rewards", name: "金幣與商店", description: "完成任務累積金幣，兌換商品並管理背包。" },
] as const;
export type ModuleId = typeof modules[number]["id"];
export function validateModules(values: unknown[]): ModuleId[] | null {
  if (values.some(value => typeof value !== "string" || !modules.some(module => module.id === value))) return null;
  return modules.filter(module => values.includes(module.id)).map(module => module.id);
}
// A missing configuration is not consent to enable optional modules.
export function moduleEnabled(selected: readonly string[] | null | undefined, id: ModuleId) {
  return selected?.includes(id) === true;
}
