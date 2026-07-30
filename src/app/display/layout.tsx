import { DisplayShell } from "@/components/layout/DisplayShell";

export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DisplayShell>{children}</DisplayShell>;
}
