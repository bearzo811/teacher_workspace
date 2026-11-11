export default function Page() {
  return (
    <main style={{ maxWidth: 760, padding: "48px 24px", margin: "auto", lineHeight: 1.8 }}>
      <p>Teacher Workspace ／ 新版獨立環境</p>
      <h1>邀請試用版開發中</h1>
      <p>這是獨立於原有教室系統的新應用，目前尚未開放登入或學生操作。</p>
      <h2>目前階段：M0 環境隔離</h2>
      <ul>
        <li>不載入原站的頁面、API、環境設定與學生資料。</li>
        <li>沒有資料庫連線、發扣點排程或購買操作。</li>
        <li>登入、邀請與班級權限完成驗收後，才開放下一階段。</li>
      </ul>
      <p>原有單班正式站維持運作，不需要搬移或重設。</p>
    </main>
  );
}
