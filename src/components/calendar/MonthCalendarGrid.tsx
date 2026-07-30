"use client";

import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/lib/calendarMonth";
import type { CalendarMonthDay } from "@/types/calendar";

type Props = {
  cells: CalendarMonthDay[];
  selectedDate?: string;
  today: string;
  onSelectDate?: (date: string) => void;
  /** teacher = light UI；display = dark classroom */
  variant?: "teacher" | "display";
};

export function MonthCalendarGrid({
  cells,
  selectedDate,
  today,
  onSelectDate,
  variant = "teacher",
}: Props) {
  const isDisplay = variant === "display";

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid grid-cols-7 gap-1 text-center",
          isDisplay ? "text-base text-slate-400" : "text-xs text-gray-500",
        )}
      >
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "py-1 font-medium",
              (index === 0 || index === 6) &&
                (isDisplay ? "text-rose-300" : "text-red-500"),
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const selected = selectedDate === cell.date;
          const isToday = cell.date === today;
          const interactive = Boolean(onSelectDate);
          const className = cn(
            "flex min-h-14 flex-col items-center justify-start rounded-lg border p-1 text-center transition",
            isDisplay ? "min-h-16 text-lg" : "text-sm",
            cell.inMonth
              ? isDisplay
                ? "border-slate-700 bg-slate-900/80 text-slate-100"
                : "border-gray-200 bg-white text-gray-900"
              : isDisplay
                ? "border-transparent bg-transparent text-slate-600"
                : "border-transparent bg-transparent text-gray-300",
            isToday &&
              (isDisplay
                ? "ring-2 ring-sky-400"
                : "ring-2 ring-blue-400"),
            selected &&
              (isDisplay
                ? "border-amber-300 bg-amber-500/20"
                : "border-blue-500 bg-blue-50"),
            interactive && cell.inMonth && "cursor-pointer hover:brightness-110",
          );

          const dayClass = cn(
            "font-semibold",
            cell.inMonth &&
              cell.isHoliday &&
              (isDisplay ? "text-rose-300" : "text-red-600"),
            !cell.inMonth &&
              cell.isHoliday &&
              (isDisplay ? "text-rose-400/50" : "text-red-300"),
          );

          const content = (
            <>
              <span className={dayClass}>{cell.day}</span>
              {cell.eventCount > 0 ? (
                <span
                  className={cn(
                    "mt-1 line-clamp-2 w-full text-[10px] leading-tight",
                    isDisplay ? "text-amber-200 text-xs" : "text-blue-700",
                  )}
                  title={cell.titles.join("、")}
                >
                  {cell.titles[0]}
                  {cell.eventCount > 1 ? ` +${cell.eventCount - 1}` : ""}
                </span>
              ) : (
                <span
                  className={cn(
                    "mt-2 h-1.5 w-1.5 rounded-full",
                    cell.eventCount > 0
                      ? isDisplay
                        ? "bg-amber-300"
                        : "bg-blue-500"
                      : "bg-transparent",
                  )}
                />
              )}
            </>
          );

          if (!interactive) {
            return (
              <div key={cell.date} className={className}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={cell.date}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => onSelectDate?.(cell.date)}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
