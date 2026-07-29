import { create } from "zustand";

type PassportStore = {
  selectedWeek: number | null;
  setSelectedWeek: (week: number | null) => void;
};

export const usePassportStore = create<PassportStore>((set) => ({
  selectedWeek: null,
  setSelectedWeek: (week) => set({ selectedWeek: week }),
}));
