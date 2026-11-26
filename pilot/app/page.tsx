import Link from "next/link";

export default function Page() {
  return (
    <main style={{ maxWidth: 760, padding: "48px 24px", margin: "auto", lineHeight: 1.8 }}>
      <p>Teacher Workspace ／ 新版獨立環境</p>
      <h1>小班試用版開發中</h1>
      <p>這是獨立於原有教室系統的新應用，以 Google 帳號註冊，不需邀請碼。</p>
      <h2>從自己的班級開始</h2>
      <ul>
        <li>不載入原站的頁面、API、環境設定與學生資料。</li>
        <li>可管理名冊、聯絡簿、作業、學習紀錄、值日與商店，選擇班級需要的功能。</li>
        <li>只使用虛構資料驗收，完整教室流程仍在開發。</li>
      </ul>
      <p>原有單班正式站維持運作，不需要搬移或重設。</p>
      <p><Link href="/demo">先用虛構資料試玩，不需登入</Link></p>
      <p><Link href="/guide">第一次使用導覽</Link></p>
      <Link href="/login">前往導師登入／註冊</Link>
    </main>
  );
}
