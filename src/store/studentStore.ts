import { create } from "zustand";

type StudentStore = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

export const useStudentStore = create<StudentStore>((set) => ({
  searchQuery: "",
  setSearchQuery: (value) => set({ searchQuery: value }),
}));
