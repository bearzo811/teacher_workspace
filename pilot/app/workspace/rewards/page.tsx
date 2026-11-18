import Link from "next/link";
import {redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {rewardDisplay} from "../../../lib/rewards";
import {Submit} from "../submit";
import {adjustRewards} from "./actions";
export const dynamic="force-dynamic";
export default async function Rewards({searchParams}:{searchParams:Promise<{student?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_REWARD_LEDGER_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");
 const [students,balances]=enabled?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_reward_balances").select("student_id,coin_net,xp_total").eq("class_id",classroom.id),
 ]):[null,null];
 const student=params.student?students?.data?.find(item=>item.id===params.student):students?.data?.[0];
 const ledger=enabled&&student?await client.from("pilot_reward_ledger").select("id,coin_delta,xp_delta,reason,created_at").eq("class_id",classroom.id).eq("student_id",student.id).order("created_at",{ascending:false}).order("id").limit(100):null;
 const unavailable=classes.error||students?.error||balances?.error||ledger?.error;const rows=(students?.data??[]).map(item=>{const balance=balances?.data?.find(row=>row.student_id===item.id);return {...item,balance:rewardDisplay(balance?.coin_net,balance?.xp_total)};});
 return <main style={{maxWidth:1100,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>金幣與 XP 帳本</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">調整已記錄。重送同一請求不會重複加扣。</p>}{params.error&&<p role="alert">未能調整。請確認學生、模組、整數範圍與原因；扣除後 XP 不可小於 0。</p>}
 <p>此階段為老師手動調整班級虛擬金幣及 XP，不是實際貨幣。不會追補既有任務或自動發扣獎勵，商店與背包尚未串接。</p>
 {unavailable||rows.some(row=>!row.balance)?<p role="alert">資料讀取失敗，暫不顯示餘額或操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:12}}>{rows.map(row=><article key={row.id} style={{border:"1px solid #cbd5e1",padding:16,borderRadius:8}}><h2>{row.seat} {row.name}</h2><p>{row.balance!.coins} 金幣 · {row.balance!.xp} XP</p>{row.balance!.coinNet<0&&<p>金幣淨額：{row.balance!.coinNet}；顯示可用金幣最低為 0，後續獎勵會先抵銷負淨額。</p>}<Link href={`/workspace/rewards?student=${row.id}`}>查看帳本／調整</Link></article>)}</div>
 {params.student&&!student?<p role="alert">找不到此班使用中的學生，不顯示其他人的帳本。</p>:!student?<p>尚無使用中學生。</p>:<section><h2>{student.seat} {student.name} · 手動調整</h2><form action={adjustRewards} style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="requestId" value={randomUUID()}/><label>金幣增減（負數為扣除）<input name="coins" type="number" min={-10000} max={10000} step={1} defaultValue={0} required/></label><label>XP 增減（負數為扣除）<input name="xp" type="number" min={-10000} max={10000} step={1} defaultValue={0} required/></label><label>調整原因 <input name="reason" maxLength={200} required/></label><Submit>記錄調整</Submit></form><p>每次各限 ±10000，至少一項非 0。帳本不可覆寫或刪除；有誤請以新的一筆反向調整並註明原因。</p><h3>最近 100 筆紀錄</h3>{!ledger?.data?.length?<p>尚無調整紀錄。</p>:<ul>{ledger.data.map(item=><li key={item.id}><time>{new Date(item.created_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false})}</time> · 金幣 {item.coin_delta>0?"+":""}{item.coin_delta} · XP {item.xp_delta>0?"+":""}{item.xp_delta} · {item.reason}</li>)}</ul>}</section>}
 </>}
 </main>;
}
