import type {
  GamificationLedgerView,
  GamificationView,
} from "@/types/gamification";

export type StudentDetail = {
  id: string;
  name: string;
  seatNumber: number;
  chinese: { completed: number; total: number };
  english: { completed: number; total: number };
  homework: { completed: number; total: number; percent: number };
  gamification: GamificationView;
  gamificationRecent: GamificationLedgerView[];
};
