"use client";

type WeekSelectorProps = {
  week: number;
  startWeek: number;
  endWeek: number;
  currentWeek: number;
  onChange: (week: number) => void;
  disabled?: boolean;
};

export function WeekSelector({
  week,
  startWeek,
  endWeek,
  currentWeek,
  onChange,
  disabled,
}: WeekSelectorProps) {
  const weeks = Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-gray-600">
        週數
        <select
          className="ml-2 h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none ring-blue-500 focus:ring-2"
          value={week}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {weeks.map((value) => (
            <option key={value} value={value}>
              第 {value} 週
              {value === currentWeek ? "（目前週）" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
