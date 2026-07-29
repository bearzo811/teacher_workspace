export const HOMEWORK_TEMPLATES = ["國習", "數習", "生字", "英文"] as const;

export type HomeworkTemplate = (typeof HOMEWORK_TEMPLATES)[number];
