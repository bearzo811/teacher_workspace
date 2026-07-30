"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Home,
  Languages,
  Monitor,
  NotebookPen,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/contact-book", label: "聯絡簿", icon: ClipboardList },
  { href: "/chinese", label: "國語護照", icon: BookOpen },
  { href: "/english", label: "英語護照", icon: Languages },
  { href: "/homework", label: "作業管理", icon: NotebookPen },
  { href: "/students", label: "學生中心", icon: Users },
  { href: "/settings", label: "系統設定", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-5">
        <p className="text-sm font-semibold text-gray-900">Teacher Workspace</p>
        <p className="mt-1 text-xs text-gray-500">導師工作台</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
        <a
          href="/display"
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Monitor className="h-4 w-4 shrink-0" />
          教室大屏
        </a>
      </nav>
    </aside>
  );
}
