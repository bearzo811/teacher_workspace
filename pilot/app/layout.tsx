import type { ReactNode } from "react";

export const metadata = {
  title: "Teacher Workspace · 邀請試用版開發",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="zh-Hant"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#172033" }}>{children}</body></html>;
}
