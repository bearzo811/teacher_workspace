import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {Submit} from "../../submit";
import {configureRoutineRewards} from "./actions";
export const dynamic="force-dynamic";
export default async function Automation({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_ROUTINE_REWARDS_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");const routines=classroom&&moduleEnabled(classroom.enabled_modules,"routines");
 const [settings,rules]=enabled?await Promise.all([
  client.from("pilot_routine_reward_settings").select("enabled,first_enabled_at").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_reward_rules").select("version,rules").eq("class_id",classroom.id).maybeSingle(),
 ]):[null,null];
 const unavailable=classes.error||settings?.error||rules?.error;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>生活任務自動獎勵</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">本班自動獎勵設定已儲存。</p>}{params.error&&<p role="alert">未能儲存。請檢查本班模組、已確認規則及確認勾選。</p>}
 {unavailable?<p role="alert">資料讀取失敗，不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <h2>目前：{settings?.data?.enabled?"已啟用":"未啟用"}</h2><p>須先<Link href="/workspace/rewards/rules">確認本班獎勵規則</Link>，再單獨啟用。此階段只有老師端生活任務自動給金幣與 XP，尚未串接作業、護照、閱讀、代班或學生大屏。</p>
 <ul><li>僅獎勵台灣時間「今天」新標記完成的任務，不追補已完成、過去日期或預填未來日期。</li><li>第一次計獎保存當時規則版本；重送不重複，取消完成會回沖，再完成沿用原金額，不因調高規則多領。</li><li>一般日與返校日同一天的同一任務不重複給獎勵。請假與是否上課仍由原任務規則判斷。</li><li>關閉後不再發新獎勵，但取消已獲獎勵的任務仍會回沖，避免保留已取消的獎勵。</li><li>金幣淨額可負；若老師已人工扣除 XP，回沖以當時剩餘 XP 為上限，確保 XP 不會負數，也不阻擋取消任務。</li></ul>
 {!routines&&<p>每日任務模組未開啟，目前只能關閉自動獎勵。</p>}{!rules?.data&&<p>尚未確認班級規則，不可啟用。</p>}
 <form action={configureRoutineRewards}><input type="hidden" name="classId" value={classroom!.id}/><p><label><input type="checkbox" name="enabled" value="yes" defaultChecked={Boolean(settings?.data?.enabled&&routines)} disabled={!routines||!rules?.data}/>啟用本班生活任務自動獎勵</label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>我了解以上規則並確認這次設定。</label></p><Submit>確認儲存啟用狀態</Submit></form><p><Link href="/workspace/rewards">查看金幣與 XP 帳本</Link> · <Link href="/workspace/routines">管理每日任務</Link></p>
 </>}
 </main>;
}
