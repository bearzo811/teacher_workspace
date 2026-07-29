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
    chinese: string[];
    english: string[];
    homework: { name: string; missing: string[] }[];
  };
};
