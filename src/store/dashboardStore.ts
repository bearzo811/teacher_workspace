import { create } from "zustand";

/** UI / cache only — do not compute completion rates here */
type DashboardStore = {
  isLoading: boolean;
  setLoading: (value: boolean) => void;
};

export const useDashboardStore = create<DashboardStore>((set) => ({
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));
