import { create } from "zustand";

type HomeworkStore = {
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
};

export const useHomeworkStore = create<HomeworkStore>((set) => ({
  selectedDate: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
