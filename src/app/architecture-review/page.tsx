const uxOpportunities = [
  {
    id: "U1",
    title: "Today 改為「下一步處理」",
    priority: "最高",
    detail:
      "把卡片的「設定」改為具體動詞，例如「查看 3 位未完成學生」；最上方只顯示今天最急的 3 件事。",
  },
  {
    id: "U2",
    title: "聯絡簿一站完成日常交辦",
    priority: "最高",
    detail:
      "輸入作業後直接顯示繳交日、未繳名單入口與列印／投影預覽，避免在聯絡簿、作業與大屏間切換。",
  },
  {
    id: "U3",
    title: "批次點名式操作",
    priority: "高",
    detail:
      "在作業、護照、每日任務加入「全班完成／只顯示未完成／下一位」與一次復原，減少逐位掃描。",
  },
  {
    id: "U4",
    title: "依使用頻率重整側欄",
    priority: "高",
    detail:
      "將 Today、聯絡簿、作業、每日任務置頂；學生、行事曆、值日、設定收在「班級管理」。將英文 Today 改為「今日」。",
  },
  {
    id: "U5",
    title: "設定分成日常與進階",
    priority: "中",
    detail:
      "把學期／大屏／養成規則改為分頁或折疊區塊；日常只看班級、週次與大屏開關。",
  },
  {
    id: "U6",
    title: "大屏登入後提供 QR 與狀態",
    priority: "中",
    detail:
      "使用安全大屏 session 後，顯示「已連線／最後更新」與 QR 開啟流程，讓教室電腦換機更快。",
  },
] as const;

const priorityStyle = {
  最高: "border-rose-200 bg-rose-50 text-rose-700",
  高: "border-amber-200 bg-amber-50 text-amber-700",
  中: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

export default function ArchitectureReviewPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-8">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-blue-700">Teacher Workspace · UX 審核</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          讓班導師每天少想一步、少點幾下
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          以下建議依「日常使用頻率 × 節省時間 × 降低遺漏」排序；優先改善流程辨識，而不是增加功能數量。
        </p>
      </header>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-lg font-semibold text-blue-950">建議先做：U1「下一步處理」</h2>
        <p className="mt-2 text-sm leading-6 text-blue-900">
          Today 是每天的入口。將通用的「設定」改為具體的下一個行動，能最快降低老師判斷目前該做什麼的成本。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">改善項目</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {uxOpportunities.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-500">{item.id}</span>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyle[item.priority]}`}>
                  {item.priority}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-6 text-sm text-slate-500">
        審核依據：目前的 Today 卡片、側欄、聯絡簿／作業分流、設定頁與大屏操作流程。
      </section>
    </main>
  );
}
