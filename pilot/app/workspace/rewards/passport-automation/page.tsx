import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {Submit} from "../../submit";
import {configurePassportRewards} from "./actions";
export const dynamic="force-dynamic";
export default async function PassportAutomation({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_PASSPORT_REWARDS_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");const passport=classroom&&moduleEnabled(classroom.enabled_modules,"passport");
 const [settings,rules]=enabled?await Promise.all([
  client.from("pilot_passport_reward_settings").select("enabled").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_reward_rules").select("rules,version").eq("class_id",classroom.id).maybeSingle(),
 ]):[null,null];
 const unavailable=classes.error||settings?.error||rules?.error;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>護照完成自動獎勵</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">本班護照獎勵設定已儲存。</p>}{params.error&&<p role="alert">未能儲存。請檢查本班模組、已確認規則及確認勾選。</p>}
 {unavailable?<p role="alert">資料讀取失敗，不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <h2>目前：{settings?.data?.enabled?"已啟用":"未啟用"}</h2><p>須先<Link href="/workspace/rewards/rules">確認本班獎勵規則</Link>。只有金幣，不給 XP。</p>
 <ul><li>提早於該週完成，採週一獎勵；當週按實際星期一至五的規則計獎，週末及逾期完成不發完成獎勵。</li><li>以台灣今天為完成日，學期首末週依實際起訖日。不追補原本已完成的紀錄。</li><li>取消會回沖。重新完成依新的實際完成日、原規則版本計算，不可藉取消重領較高金額。</li><li>關閉後不發新獎勵，取消先前獎勵仍回沖。每本護照、每個週次各自計獎。</li><li>本階段尚未啟用每日逾期扣點，也尚未串接學生大屏及下課／商店限制。</li></ul>
 {!passport&&<p>護照模組未開啟，目前只能關閉自動獎勵。</p>}{!rules?.data&&<p>尚未確認班級規則，不可啟用。</p>}
 <form action={configurePassportRewards}><input type="hidden" name="classId" value={classroom!.id}/><p><label><input type="checkbox" name="enabled" value="yes" defaultChecked={Boolean(settings?.data?.enabled&&passport)} disabled={!passport||!rules?.data}/>啟用本班護照完成金幣</label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>我了解以上規則並確認這次設定。</label></p><Submit>確認儲存啟用狀態</Submit></form><p><Link href="/workspace/rewards">查看金幣與 XP 帳本</Link> · <Link href="/workspace/passports">管理護照</Link></p>
 </>}
 </main>;
}
