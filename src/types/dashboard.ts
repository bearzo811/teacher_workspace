export type DashboardTodayTask = {
  taskKey: "chinese_passport" | "english_passport" | "homework";
  label: string;
  completed: boolean;
};

export type DashboardData = {
  todayTasks: DashboardTodayTask[];
  passportSummary: {
    chinese: { week: number; completed: number; total: number };
    english: { week: number; completed: number; total: number };
  };
  homeworkSummary: { completed: number; total: number } | null;
  remainingStudents: {
    chinese: { name: string; note?: string }[];
    english: { name: string; note?: string }[];
    homework: { name: string; missing: string[] }[];
  };
};
