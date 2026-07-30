import { formatDisplayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type DisplayContactBookPanelProps = {
  className: string;
  schoolYear: string;
  date: string;
  dueDate: string;
  titles: string[];
  note: string;
};

export function DisplayContactBookPanel({
  className,
  schoolYear,
  date,
  dueDate,
  titles,
  note,
}: DisplayContactBookPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-6 md:p-8">
      <header className="border-b border-slate-700 pb-4 text-center">
        <p className="text-lg text-slate-300 md:text-xl">
          {schoolYear} 學年度 {className}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-wide md:text-4xl">
          今日聯絡簿
        </h2>
        <p className="mt-2 text-xl text-slate-300 md:text-2xl">
          {formatDisplayDate(date)}
        </p>
        <p className="mt-1 text-base text-amber-300/90 md:text-lg">
          繳交日：{formatDisplayDate(dueDate)}
        </p>
      </header>

      <div className="mt-6 flex-1">
        <p className="text-xl font-semibold text-sky-300 md:text-2xl">
          回家作業
        </p>
        {titles.length === 0 ? (
          <p className="mt-4 text-2xl text-slate-500">（尚未填寫）</p>
        ) : (
          <ol className="mt-4 list-decimal space-y-3 pl-8 text-2xl md:text-3xl">
            {titles.map((title) => (
              <li key={title} className="leading-relaxed">
                {title}
              </li>
            ))}
          </ol>
        )}
      </div>

      {note.trim() ? (
        <div
          className={cn(
            "mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4",
          )}
        >
          <p className="text-lg font-semibold text-amber-200 md:text-xl">叮嚀</p>
          <p className="mt-2 whitespace-pre-wrap text-xl leading-relaxed text-amber-50 md:text-2xl">
            {note}
          </p>
        </div>
      ) : null}
    </section>
  );
}
