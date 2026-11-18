import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {Submit} from "../../submit";
import {configureReadingRewards} from "./actions";
export const dynamic="force-dynamic";
export default async function ReadingAutomation({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_READING_REWARDS_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");const reading=classroom&&moduleEnabled(classroom.enabled_modules,"reading");
 const [settings,rules]=enabled?await Promise.all([
  client.from("pilot_reading_reward_settings").select("enabled,first_enabled_at").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_reward_rules").select("version").eq("class_id",classroom.id).maybeSingle(),
 ]):[null,null];
 const unavailable=classes.error||settings?.error||rules?.error;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>閱讀／讀報自動獎勵</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">本班閱讀獎勵設定已儲存。</p>}{params.error&&<p role="alert">未能儲存。請檢查本班模組、已確認規則及確認勾選。</p>}
 {unavailable?<p role="alert">資料讀取失敗，不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <h2>目前：{settings?.data?.enabled?"已啟用":"未啟用"}</h2><p>須先<Link href="/workspace/rewards/rules">確認本班獎勵規則</Link>。讀報與閱讀心得每月分別計獎，只有金幣，不給 XP。</p>
 <ul><li>只處理啟用後老師新改為「已完成」的事件，不批次追補原先已完成的紀錄；完成舊月份未完成項目仍可獲獎勵。</li><li>未開始與缺家長不發獎勵。已完成退回任一未完成狀態會回沖原金幣。</li><li>第一次計獎保存規則版本；重送不重複，退回再完成沿用原金額，不因修改規則多領。</li><li>關閉自動獎勵或金幣模組後不再發新獎勵；取消先前獎勵仍回沖。規則不影響月份結束後才算欠繳的判定。</li><li>目前只支援老師端，學生大屏尚未串接。</li></ul>
 {!reading&&<p>閱讀／讀報模組未開啟，目前只能關閉自動獎勵。</p>}{!rules?.data&&<p>尚未確認班級規則，不可啟用。</p>}
 <form action={configureReadingRewards}><input type="hidden" name="classId" value={classroom!.id}/><p><label><input type="checkbox" name="enabled" value="yes" defaultChecked={Boolean(settings?.data?.enabled&&reading)} disabled={!reading||!rules?.data}/>啟用本班閱讀／讀報完成金幣</label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>我了解以上規則並確認這次設定。</label></p><Submit>確認儲存啟用狀態</Submit></form><p><Link href="/workspace/rewards">查看金幣與 XP 帳本</Link> · <Link href="/workspace/reading">管理閱讀／讀報</Link></p>
 </>}
 </main>;
}
