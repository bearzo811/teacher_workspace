import Link from "next/link";
import { redirect } from "next/navigation";
import { serverClient } from "../../../lib/supabase";
import { nextSchoolDay, schoolDay, taipeiToday, termWeek, validDate, type Term, type DayOverride } from "../../../lib/calendar";
import { Submit } from "../submit";
import { createTerm, updateTerm, activateTerm, setDay } from "./actions";

export const dynamic = "force-dynamic";
const input = { padding: 8, maxWidth: "100%" };
function TermInputs({ term }: { term?: Term }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
    <label>學期名稱<br /><input name="name" defaultValue={term?.name} required maxLength={80} placeholder="例如：115 學年度上學期" style={input} /></label>
    <label>開始日<br /><input type="date" name="start" defaultValue={term?.start_date} min="2000-01-01" max="2100-12-31" required style={input} /></label>
    <label>結束日<br /><input type="date" name="end" defaultValue={term?.end_date} min="2000-01-01" max="2100-12-31" required style={input} /></label>
  </div>;
}
export default async function Calendar({ searchParams }: { searchParams: Promise<{ term?: string; month?: string; error?: string; notice?: string }> }) {
  if (process.env.PILOT_CALENDAR_ENABLED !== "true") redirect("/workspace");
  const params = await searchParams;
  const client = await serverClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const classes = await client.from("pilot_classes").select("id,name");
  if (classes.error) return <main><Link href="/workspace">返回工作台</Link><p role="alert">班級暫時無法載入，請稍後重試。</p></main>;
  const classroom = classes.data?.[0];
  if (!classroom) redirect("/workspace");
  const terms = await client.from("pilot_terms").select("*").eq("class_id",classroom.id).order("start_date",{ascending:false});
  const list = (terms.data ?? []) as Term[];
  const selected = list.find(term => term.id === params.term) ?? list.find(term => term.active) ?? list[0];
  const overrides = selected ? await client.from("pilot_day_overrides").select("day,is_school_day,note").eq("term_id",selected.id).order("day") : null;
  const days = (overrides?.data ?? []) as DayOverride[];
  const unavailable = terms.error || overrides?.error;
  const today = taipeiToday();
  const requestedMonth = params.month && validDate(params.month + "-01") ? params.month : undefined;
  const month = requestedMonth ?? (selected && (today < selected.start_date || today > selected.end_date) ? selected.start_date.slice(0,7) : today.slice(0,7));
  const first = new Date(month + "-01T00:00:00Z");
  const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const week = selected ? termWeek(today,selected) : null;
  return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}>
    <Link href="/workspace">← 返回工作台</Link><h1>學期與行事曆</h1><p>{classroom.name}</p>
    {params.notice === "saved" && <p role="status">設定已儲存。</p>}
    {params.error && <p role="alert">{params.error === "input" ? "請檢查名稱與日期：結束不得早於開始，學期最多 367 天。" : "無法儲存。請確認日期在學期內；縮短學期前，請先還原範圍外的放假／補課設定。每班最多保留 30 個學期。"}</p>}
    {unavailable ? <p role="alert">行事曆暫時無法載入，請重新整理。目前不開放修改，避免使用不完整資料。</p> : <>
      <details open={!list.length}><summary>建立新學期</summary><p>起訖日可為任意星期。第一個學期自動啟用；新學期需另外啟用，舊紀錄會保留。</p>
        <form action={createTerm}><input type="hidden" name="classId" value={classroom.id} /><TermInputs /><Submit>建立學期</Submit></form>
      </details>
      <h2>已建立的學期</h2>
      {list.length === 0 && <p>請先建立學期，再設定上課日。</p>}
      <nav aria-label="選擇學期" style={{display:"flex",flexWrap:"wrap",gap:16}}>{list.map(term => <Link key={term.id} href={`/workspace/calendar?term=${term.id}`} aria-current={selected?.id===term.id?"page":undefined}>{term.name}{term.active?"（目前啟用）":""}</Link>)}</nav>
      {selected && <section>
        <h2>{selected.name}</h2><p>{selected.start_date} ～ {selected.end_date} {selected.active?"｜目前啟用":"｜歷史／未啟用學期"}</p>
        {!selected.active && <form action={activateTerm}><input type="hidden" name="termId" value={selected.id} /><Submit>啟用此學期</Submit></form>}
        <details><summary>修改此學期</summary><form action={updateTerm}><input type="hidden" name="termId" value={selected.id} /><TermInputs term={selected} /><Submit>儲存學期</Submit></form></details>
        <p>今天（台灣時間）：{today}｜{week===null?"不在此學期內":`第 ${week} 週`}{schoolDay(today,selected,days)?"・上課日":"・非上課日"}｜下一個上課日：{nextSchoolDay(today,selected,days) ?? "此學期內無後續上課日"}</p>
        <p>週次由實際開學日所在週算第 1 週，之後每週一換週；放假與補課不移動週次。平日預設上課、六日預設放假，僅限學期起訖內。</p>
        <form method="get"><input type="hidden" name="term" value={selected.id} /><label>顯示月份 <input type="month" name="month" defaultValue={month} min="2000-01" max="2100-12" required style={input} /></label> <button>查看月份</button></form>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:4,marginTop:16}} aria-label={`${month} 月曆`}>
          {["日","一","二","三","四","五","六"].map(day=><strong key={day} style={{textAlign:"center"}}>{day}</strong>)}
          {Array.from({length:first.getUTCDay()},(_,index)=><div key={`blank-${index}`} />)}
          {Array.from({length:count},(_,index)=>{const date=`${month}-${String(index+1).padStart(2,"0")}`; const inTerm=date>=selected.start_date&&date<=selected.end_date; const custom=days.find(item=>item.day===date); return <div key={date} style={{border:"1px solid #cbd5e1",borderRadius:6,padding:8,overflowWrap:"anywhere",background:!inTerm?"#f1f5f9":schoolDay(date,selected,days)?"#eff6ff":"#fff1f2"}}><strong>{index+1}</strong><div style={{fontSize:13}}>{!inTerm?"學期外":schoolDay(date,selected,days)?"上課":"放假"}</div>{custom?.note&&<small>{custom.note}</small>}</div>;})}
        </div>
        <h3>設定放假／補課</h3><form action={setDay} style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
          <input type="hidden" name="termId" value={selected.id} />
          <label>日期<br /><input type="date" name="day" min={selected.start_date} max={selected.end_date} required style={input} /></label>
          <label>當日安排<br /><select name="mode" style={input}><option value="holiday">放假</option><option value="school">上課／補課</option><option value="default">還原預設（不刪除其他紀錄）</option></select></label>
          <label>說明（可空白）<br /><input name="note" maxLength={120} style={input} /></label><Submit>儲存當日安排</Submit>
        </form>
        <h3>此學期的例外日期</h3>{!days.length?<p>尚無放假或補課調整。</p>:<ul>{days.map(day=><li key={day.day}>{day.day}：{day.is_school_day?"上課／補課":"放假"} {day.note}</li>)}</ul>}
      </section>}
    </>}
  </main>;
}
