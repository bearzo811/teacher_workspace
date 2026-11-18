import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {defaultRewardRules,rewardRuleFields,validRewardRules} from "../../../../lib/reward-rules";
import {Submit} from "../../submit";
import {saveRewardRules} from "./actions";
export const dynamic="force-dynamic";
export default async function RewardRules({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_REWARD_RULES_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");
 const [current,history]=enabled?await Promise.all([
  client.from("pilot_reward_rules").select("version,rules,confirmed_at").eq("class_id",classroom.id).maybeSingle(),
  client.from("pilot_reward_rule_history").select("version,rules,confirmed_at").eq("class_id",classroom.id).order("version",{ascending:false}).limit(20),
 ]):[null,null];
 const rules=current?.data?.rules??defaultRewardRules;const unavailable=classes.error||current?.error||history?.error||!validRewardRules(rules);
 return <main style={{maxWidth:1100,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>班級獎勵規則</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">規則已確認保存；自動獎勵尚未啟用。</p>}{params.error&&<p role="alert">未能儲存。請確認數值及確認勾選；護照獎勵需隨星期不遞增。若其他分頁已更新，請重新整理再編輯。</p>}
 <p>這裡先保存每班獨立規則，尚不套用任務或回算舊帳。自動獎勵將另外串接、驗證後開放。手動帳本不受此範本影響。</p>
 {unavailable?<p role="alert">規則無法完整讀取，暫不顯示可儲存範本。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <h2>{current?.data?`已確認版本 ${current.data.version}`:"建議範本（尚未確認）"}</h2><p>護照提早到該週前完成，採週一金幣；逾週只在上課日計算。讀報／閱讀只有金幣，不給 XP。此頁目前僅保存數值，這些自動規則尚未執行。</p>
 <form action={saveRewardRules}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="version" value={current?.data?.version??0}/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:16}}>{rewardRuleFields.map(field=><label key={field.id}>{field.label}<input style={{display:"block",padding:8}} type="number" name={field.id} step={1} min={field.min} max={field.min<0?0:10000} defaultValue={rules[field.id]} required/></label>)}</div><p>升級基數：下一級需要「基數 × 目前等級」XP。所有值必須為整數，扣點可設 0 關閉；護照週一到週五獎勵不可遞增。</p><p><label><input type="checkbox" name="confirm" value="yes" required/>我已檢查並確認保存這份班級規則，了解目前尚未自動發扣獎勵。</label></p><Submit>確認保存規則</Submit></form>
 <details><summary>最近 20 個規則版本（最多保留 1000 版）</summary>{!history?.data?.length?<p>尚無已確認版本。</p>:history.data.map(item=><section key={item.version}><h3>版本 {item.version} · {new Date(item.confirmed_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false})}</h3>{validRewardRules(item.rules)?<ul>{rewardRuleFields.map(field=><li key={field.id}>{field.label}：{item.rules[field.id]}</li>)}</ul>:<p>此歷史版本格式無法顯示。</p>}</section>)}</details>
 </>}
 </main>;
}
