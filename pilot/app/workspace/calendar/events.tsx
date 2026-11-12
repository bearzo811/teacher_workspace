import { serverClient } from "../../../lib/supabase";
import { daysUntil,upcomingEvents,type CalendarEvent } from "../../../lib/events";
import { Submit } from "../submit";
import { saveEvent,archiveEvent } from "./event-actions";
const input={padding:8,maxWidth:"100%"};
function EventFields({event}:{event?:CalendarEvent}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
    <label>活動名稱<br/><input name="title" defaultValue={event?.title} required maxLength={80} style={input}/></label>
    <label>活動日期<br/><input type="date" name="day" defaultValue={event?.day} min="2000-01-01" max="2100-12-31" required style={input}/></label>
    <label>備註（可空白）<br/><input name="note" defaultValue={event?.note} maxLength={500} style={input}/></label>
    <label><input type="checkbox" name="countdown" value="yes" defaultChecked={event?.countdown??true}/> 顯示倒數</label>
    <Submit>{event?"儲存活動":"新增活動"}</Submit>
  </div>;
}
export async function Events({classId,today,month}:{classId:string;today:string;month:string}) {
  const client=await serverClient();
  const result=await client.from("pilot_calendar_events").select("id,title,day,note,countdown,archived").eq("class_id",classId).order("day").order("id");
  if(result.error) return <section id="events"><h2>活動與倒數</h2><p role="alert">活動暫時無法載入，請重新整理。目前不開放新增，以免重複建立。</p></section>;
  const events=(result.data??[]) as CalendarEvent[];
  const upcoming=upcomingEvents(events,today);
  const inMonth=events.filter(event=>!event.archived&&event.day.startsWith(month));
  const archived=events.filter(event=>event.archived);
  return <section id="events" style={{marginTop:32}}>
    <h2>活動與倒數</h2><p>活動獨立於學期與上課日，不會更動放假、補課或週次。倒數依台灣今天計算，不受查看月份影響。</p>
    <h3>接下來的活動</h3>{upcoming.length?<ul>{upcoming.map(event=><li key={event.id}><strong>{event.title}</strong>　{event.day}　{event.day===today?"就是今天":`還有 ${daysUntil(today,event.day)} 天`}</li>)}</ul>:<p>目前沒有開啟倒數的未來活動。</p>}
    <details><summary>新增活動</summary><form action={saveEvent}><input type="hidden" name="classId" value={classId}/><EventFields/></form><p>每班最多保留 500 筆活動（含已移除），達上限時請編輯既有活動或聯絡管理者。</p></details>
    <h3>{month} 活動</h3>{!inMonth.length&&<p>本月尚無活動。切換上方月份可查看其他月份。</p>}
    {inMonth.map(event=><article key={event.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:12,marginBottom:12}}>
      <strong>{event.day}　{event.title}</strong>{event.note&&<p style={{overflowWrap:"anywhere"}}>{event.note}</p>}
      <details><summary>編輯活動</summary><form action={saveEvent}><input type="hidden" name="classId" value={classId}/><input type="hidden" name="eventId" value={event.id}/><EventFields event={event}/></form></details>
      <form action={archiveEvent}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="mode" value="archive"/><label><input type="checkbox" name="confirm" value="yes" required/> 確認移除，可復原</label> <Submit>移除活動</Submit></form>
    </article>)}
    {!!archived.length&&<details><summary>已移除活動（{archived.length}）</summary><ul>{archived.map(event=><li key={event.id}>{event.day}　{event.title}<form action={archiveEvent}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="mode" value="restore"/><input type="hidden" name="confirm" value="yes"/><Submit>復原活動</Submit></form></li>)}</ul></details>}
  </section>;
}
