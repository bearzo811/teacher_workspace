/**
 * Passport cell status (三態)
 * not_started = 未開始
 * missing_parent = 缺家長
 * completed = 已完成
 */
export type PassportStatus = "not_started" | "missing_parent" | "completed";

export const PASSPORT_STATUS_ORDER: PassportStatus[] = [
  "not_started",
  "missing_parent",
  "completed",
];

export const PASSPORT_STATUS_LABEL: Record<PassportStatus, string> = {
  not_started: "未開始",
  missing_parent: "缺家長",
  completed: "已完成",
};

export function nextPassportStatus(current: PassportStatus): PassportStatus {
  const index = PASSPORT_STATUS_ORDER.indexOf(current);
  return PASSPORT_STATUS_ORDER[(index + 1) % PASSPORT_STATUS_ORDER.length];
}

/** 國語／英語護照只使用未開始、已完成兩種狀態。 */
export function nextBinaryPassportStatus(
  current: PassportStatus,
): "not_started" | "completed" {
  return current === "completed" ? "not_started" : "completed";
}

export function isPassportStatus(value: unknown): value is PassportStatus {
  return (
    value === "not_started" ||
    value === "missing_parent" ||
    value === "completed"
  );
}
