import Link from "next/link";
import {redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {rewardDisplay,rewardLevel} from "../../../lib/rewards";
import {defaultRewardRules,validRewardRules} from "../../../lib/reward-rules";
import {Submit} from "../submit";
import {adjustRewards} from "./actions";
export const dynamic="force-dynamic";
export default async function Rewards({searchParams}:{searchParams:Promise<{student?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_REWARD_LEDGER_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");
 const [students,balances,rules]=enabled?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_reward_balances").select("student_id,coin_net,xp_total").eq("class_id",classroom.id),
  process.env.PILOT_REWARD_RULES_ENABLED==="true"?client.from("pilot_reward_rules").select("rules").eq("class_id",classroom.id).maybeSingle():Promise.resolve(null),
 ]):[null,null,null];
 const student=params.student?students?.data?.find(item=>item.id===params.student):students?.data?.[0];
 const ledger=enabled&&student?await client.from("pilot_reward_ledger").select("id,coin_delta,xp_delta,reason,created_at").eq("class_id",classroom.id).eq("student_id",student.id).order("created_at",{ascending:false}).order("id").limit(100):null;
 const config=rules?.data?.rules??defaultRewardRules;
 const unavailable=classes.error||students?.error||balances?.error||ledger?.error||rules?.error||!validRewardRules(config);const rows=(students?.data??[]).map(item=>{const balance=balances?.data?.find(row=>row.student_id===item.id);const display=rewardDisplay(balance?.coin_net,balance?.xp_total);return {...item,balance:display,level:display&&validRewardRules(config)?rewardLevel(display.xp,config.level_base_xp):null};});
 return <main style={{maxWidth:1100,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>金幣與 XP 帳本</h1><p>{classroom?.name}</p>
 {params.notice==="saved"&&<p role="status">調整已記錄。重送同一請求不會重複加扣。</p>}{params.error&&<p role="alert">未能調整。請確認學生、模組、整數範圍與原因；扣除後 XP 不可小於 0。</p>}
 <p>此處顯示班級虛擬金幣及 XP，不是實際貨幣，可由老師手動調整。自動獎勵須逐項另行確認，不批次追補原有紀錄。{process.env.PILOT_ROUTINE_REWARDS_ENABLED==="true"&&<><Link href="/workspace/rewards/automation">生活任務設定</Link>。</>}{process.env.PILOT_READING_REWARDS_ENABLED==="true"&&<><Link href="/workspace/rewards/reading-automation">閱讀／讀報設定</Link>。</>}學生購買尚未開放。</p>
 {process.env.PILOT_BACKPACK_ENABLED==="true"&&<p><Link href="/workspace/backpacks">學生背包與老師贈送／核銷</Link></p>}
 <p>{process.env.PILOT_PASSPORT_REWARDS_ENABLED==="true"&&<><Link href="/workspace/rewards/passport-automation">護照獎勵設定</Link>　</>}{process.env.PILOT_HOMEWORK_REWARDS_ENABLED==="true"&&<Link href="/workspace/rewards/homework-automation">作業獎勵設定</Link>}</p>
 {unavailable||rows.some(row=>!row.balance)?<p role="alert">資料讀取失敗，暫不顯示餘額或操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 {!rules?.data&&<p>等級暫依預設基數 {defaultRewardRules.level_base_xp} XP 顯示；請先確認本班規則。此處不影響商品購買權限。</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:12}}>{rows.map(row=><article key={row.id} style={{border:"1px solid #cbd5e1",padding:16,borderRadius:8}}><h2>{row.seat} {row.name}</h2><p>{row.balance!.coins} 金幣 · {row.balance!.xp} XP</p>{row.level&&<><p>Lv.{row.level.level} · 本級 {row.level.currentXp}／{row.level.requiredXp} XP</p><progress aria-label={`${row.name} 升級進度`} max={row.level.requiredXp} value={row.level.currentXp} style={{width:"100%"}}/><p>距離下一級 {row.level.remainingXp} XP</p></>}{row.balance!.coinNet<0&&<p>金幣淨額：{row.balance!.coinNet}；顯示可用金幣最低為 0，後續獎勵會先抵銷負淨額。</p>}<Link href={`/workspace/rewards?student=${row.id}`}>查看帳本／調整</Link></article>)}</div>
 {params.student&&!student?<p role="alert">找不到此班使用中的學生，不顯示其他人的帳本。</p>:!student?<p>尚無使用中學生。</p>:<section><h2>{student.seat} {student.name} · 手動調整</h2><form action={adjustRewards} style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="requestId" value={randomUUID()}/><label>金幣增減（負數為扣除）<input name="coins" type="number" min={-10000} max={10000} step={1} defaultValue={0} required/></label><label>XP 增減（負數為扣除）<input name="xp" type="number" min={-10000} max={10000} step={1} defaultValue={0} required/></label><label>調整原因 <input name="reason" maxLength={200} required/></label><Submit>記錄調整</Submit></form><p>每次各限 ±10000，至少一項非 0。帳本不可覆寫或刪除；有誤請以新的一筆反向調整並註明原因。</p><h3>最近 100 筆紀錄</h3>{!ledger?.data?.length?<p>尚無調整紀錄。</p>:<ul>{ledger.data.map(item=><li key={item.id}><time>{new Date(item.created_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false})}</time> · 金幣 {item.coin_delta>0?"+":""}{item.coin_delta} · XP {item.xp_delta>0?"+":""}{item.xp_delta} · {item.reason}</li>)}</ul>}</section>}
 </>}
 </main>;
}
