import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {Submit} from "../../submit";
import {configurePassportOverdue} from "./actions";
export const dynamic="force-dynamic";
export default async function PassportOverdue({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_PASSPORT_OVERDUE_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");const passport=classroom&&moduleEnabled(classroom.enabled_modules,"passport");
 const [settings,rules,runs]=enabled?await Promise.all([
  client.from("pilot_passport_overdue_settings").select("enabled,enabled_on").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_reward_rules").select("rules,version").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_passport_overdue_runs").select("day,status,entry_count,attempts,error_code,finished_at").eq("class_id",classroom.id).order("day",{ascending:false}).limit(30),
 ]):[null,null,null];
 const unavailable=classes.error||settings?.error||rules?.error||runs?.error;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>護照每日逾期扣點</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">本班護照逾期設定已儲存。</p>}{params.error&&<p role="alert">未能儲存，請確認班級模組、獎勵規則與確認勾選。</p>}
 {unavailable?<p role="alert">資料讀取失敗，不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <h2>班級開關：{settings?.data?.enabled?"已啟用":"未啟用"}</h2>
 <p>這個開關與護照完成獎勵分開；還需要平台排程正常執行，不表示已發生扣款。</p>
 <ul><li>凌晨結算台灣時間前一天，僅扣「前幾週」未完成護照；當週尚未完成不扣。每本、每週、每學生、每日分開計算。</li><li>只扣啟用學期的上課日。週末／放假不扣，補課照扣；已登記當天請假者免扣。尚未點名暫按出席。</li><li>完成狀態按該日結束時的紀錄判斷；今天完成不會抹掉昨天的逾期。金額採結算時已確認規則，帳本保存版本；只扣金幣，不扣 XP。</li><li>從本班啟用日開始，不補扣先前日期；關閉期間不扣，重新啟用不追補停用期間。漏跑不掃描舊日期，重跑不重複扣。</li><li>結算後補登請假或修改舊紀錄，不自動改寫扣款。老師可在帳本新增反向調整並註明原因。</li><li>金幣淨額可為負，可用金幣最低顯示 0。班級單次結算失敗會整批撤回，錯誤留在下方。</li></ul>
 <p>請先<Link href="/workspace/rewards/rules">確認本班規則</Link>，並確認<Link href="/workspace/attendance">出缺席</Link>。{settings?.data?.enabled_on&&<>本輪起算日：{settings.data.enabled_on}。</>}</p>
 {!passport&&<p>護照模組未開啟，目前只能關閉扣點。</p>}
 <form action={configurePassportOverdue}><input type="hidden" name="classId" value={classroom!.id}/><p><label><input type="checkbox" name="enabled" value="yes" defaultChecked={Boolean(settings?.data?.enabled&&passport)} disabled={!passport||!rules?.data}/>啟用本班護照逾期扣點</label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>我了解以上規則並確認這次設定。</label></p><Submit>確認儲存啟用狀態</Submit></form>
 <h2>最近結算紀錄</h2>{!runs?.data?.length?<p>尚無結算紀錄；不代表排程已正常執行。</p>:<ul>{runs.data.map(run=><li key={run.day}>{run.day}：{run.status==="success"?`成功，扣點 ${run.entry_count} 項`:`失敗（${run.error_code??"未知"}），該次未扣款`}；嘗試 {run.attempts} 次</li>)}</ul>}
 <p><Link href="/workspace/rewards">查看帳本／手動調整</Link></p>
 </>}
 </main>;
}
