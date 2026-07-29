"use client";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "搜尋姓名",
}: SearchBarProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none ring-blue-500 focus:ring-2"
    />
  );
}
