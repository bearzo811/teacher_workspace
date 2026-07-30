export function DisplayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto min-h-screen w-full max-w-[1600px] p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
