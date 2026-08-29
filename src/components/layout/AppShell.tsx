import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
