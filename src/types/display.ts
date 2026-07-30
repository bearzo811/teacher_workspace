import type { HomeworkDayView } from "@/services/homeworkService";
import type { PassportWeekView } from "@/services/passportService";

export type DisplayPassportPanel = {
  chinese: PassportWeekView;
  english: PassportWeekView;
};

export type DisplayData = {
  className: string;
  schoolYear: string;
  today: string;
  contactBook: {
    date: string;
    dueDate: string;
    note: string;
    titles: string[];
  };
  homework: HomeworkDayView;
  passport: DisplayPassportPanel;
  displaySettings: {
    allowStudentHomeworkToggle: boolean;
    allowStudentPassportToggle: boolean;
    carouselEnabled: boolean;
    refreshSeconds: number;
    hasToken: boolean;
  };
  students: { studentId: string; name: string; seatNumber: number }[];
};
