import Link from "next/link";

export default function Page() {
  return (
    <main style={{ maxWidth: 760, padding: "48px 24px", margin: "auto", lineHeight: 1.8 }}>
      <p>Teacher Workspace ／ 新版獨立環境</p>
      <h1>小班試用版開發中</h1>
      <p>這是獨立於原有教室系統的新應用，以 Google 帳號註冊，不需邀請碼。</p>
      <h2>目前階段：M1 註冊、班級與資料隔離</h2>
      <ul>
        <li>不載入原站的頁面、API、環境設定與學生資料。</li>
        <li>正在驗證註冊與小班名冊，沒有發扣點排程或購買操作。</li>
        <li>只使用虛構資料驗收，完整教室流程仍在開發。</li>
      </ul>
      <p>原有單班正式站維持運作，不需要搬移或重設。</p>
      <Link href="/login">前往導師登入</Link>
    </main>
  );
}
