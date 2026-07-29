export type DashboardTodayTask = {
  taskKey: "chinese_passport" | "english_passport" | "homework";
  label: string;
  completed: boolean;
};

export type PassportDashboardCard = {
  week: number;
  weekCompleted: number;
  weekTotal: number;
  overallCompleted: number;
  overallTotal: number;
  owedStudents: {
    name: string;
    seatNumber: number;
    detail: string;
  }[];
};

export type DashboardData = {
  todayTasks: DashboardTodayTask[];
  passportSummary: {
    chinese: PassportDashboardCard;
    english: PassportDashboardCard;
  };
  homeworkSummary: {
    completed: number;
    total: number;
    hasItems: boolean;
  } | null;
  remainingStudents: {
    chinese: { name: string; note?: string }[];
    english: { name: string; note?: string }[];
    homework: { name: string; missing: string[] }[];
  };
};
