import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chinese", label: "國語" },
  { href: "/english", label: "英語" },
  { href: "/homework", label: "作業" },
  { href: "/students", label: "學生" },
] as const;

export function QuickActionCard() {
  return (
    <Card>
      <CardTitle>快捷功能</CardTitle>
      <CardDescription>導航捷徑</CardDescription>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
