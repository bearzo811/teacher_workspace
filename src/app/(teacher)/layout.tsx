import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { isTeacherRequest } from "@/lib/access";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isTeacherRequest())) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
