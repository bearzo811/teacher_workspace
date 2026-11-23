import Link from "next/link";
import {redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {allowedRewardActions,backpackPage,rewardStates,rewardActions,type RewardState,type RewardAction} from "../../../lib/backpack";
import {Submit} from "../submit";
import {giftReward,manageReward} from "./actions";
export const dynamic="force-dynamic";
export default async function Backpacks({searchParams}:{searchParams:Promise<{student?:string;page?:string;reward?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_BACKPACK_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams,page=backpackPage(params.page);const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");
 const [students,items]=enabled?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_shop_items").select("id,name,icon").eq("class_id",classroom.id).eq("archived",false).order("min_level",{ascending:false}).order("price",{ascending:false}).order("name").order("id").range(0,200),
 ]):[null,null];
 const student=params.student?students?.data?.find(row=>row.id===params.student):students?.data?.[0];
 const rewards=enabled&&student&&page!==null?await client.from("pilot_student_rewards").select("id,item_name,item_icon,kind,description,source,price_paid,status,version,created_at",{count:"exact"}).eq("class_id",classroom.id).eq("student_id",student.id).order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1):null;
 const selected=enabled&&student&&params.reward&&/^[0-9a-f-]{36}$/i.test(params.reward)?await client.from("pilot_student_rewards").select("id,item_name").eq("class_id",classroom.id).eq("student_id",student.id).eq("id",params.reward).maybeSingle():null;
 const history=selected?.data?await client.from("pilot_reward_history").select("id,action,note,version,from_status,to_status,created_at").eq("class_id",classroom!.id).eq("student_id",student!.id).eq("reward_id",selected.data.id).order("version",{ascending:false}).limit(50):null;
 const unavailable=classes.error||students?.error||items?.error||rewards?.error||selected?.error||history?.error||(items?.data?.length??0)>200||Boolean(rewards&&rewards.count===null)||Boolean(rewards?.data?.some(row=>!Object.hasOwn(rewardStates,row.status)));
 const total=rewards?.count??0,validPage=page!==null&&(page===1||(page-1)*50<total);
 const base=student?`/workspace/backpacks?student=${student.id}`:"/workspace/backpacks";
 return <main style={{maxWidth:1200,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>學生背包與核銷</h1><p>{classroom?.name}</p>
 <p>獎品永久持有，不設定到期日。每一份獎品獨立記錄；商品改名或移除不會改寫背包快照。目前只有老師端贈送與代辦使用流程，尚無購買或學生大屏。這裡的核銷是確認獎品已使用，不是購買核准。</p>
 {params.notice==="saved"&&<p role="status">操作已儲存，同一請求重送不會重複執行。</p>}{params.error&&<p role="alert">未能儲存。請重新整理，確認學生、商品、狀態及版本仍有效，並填寫原因與確認。</p>}
 {unavailable?<p role="alert">背包資料讀取失敗，不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:<>
 <form method="get"><label>選擇學生 <select name="student" defaultValue={student?.id} required>{(students?.data??[]).map(row=><option key={row.id} value={row.id}>{row.seat} 號 {row.name}</option>)}</select></label> <button disabled={!students?.data?.length}>查看背包</button></form>
 {!student?<p role="alert">{params.student?"找不到此班使用中的學生，不顯示其他學生背包。":"尚無使用中學生。"}</p>:!validPage?<p role="alert">分頁無效，請<Link href={base}>回到第一頁</Link>。</p>:<>
 <h2>{student.seat} 號 {student.name}</h2>
 <details><summary>贈送一份獎品</summary><p>老師贈送不扣金幣、不扣庫存，不受等級或欠繳限制。每次一份；每位學生最多保留 1000 份（含已使用及已撤回）。</p>
 {!items?.data?.length?<p>沒有使用中商品，請先到<Link href="/workspace/shop">商品管理</Link>新增或復原。</p>:<form action={giftReward}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="requestId" value={randomUUID()}/><p><label>贈送商品 <select name="itemId" required>{items.data.map(item=><option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label></p><p><label>贈送原因 <input name="note" maxLength={200} defaultValue="教師贈送" required/></label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>確認贈送給 {student.seat} 號 {student.name}</label></p><Submit>贈送一份</Submit></form>}</details>
 <p>共 {total} 份紀錄；第 {page}／{Math.max(1,Math.ceil(total/50))} 頁，每頁最多 50 份。</p>
 {!total&&<p>此學生尚無獎品。</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:16}}>{(rewards?.data??[]).map(reward=>{
 const state=reward.status as RewardState,actions=allowedRewardActions(state,reward.source==='purchase'?'purchase':'gift');
 return <article key={reward.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16,minWidth:0}}><h3 style={{overflowWrap:"anywhere"}}>{reward.item_icon} {reward.item_name}</h3><strong>{rewardStates[state]}</strong><p>獎品編號 {reward.id.slice(0,8)} · 第 {reward.version} 版 · {reward.source==="gift"?"老師贈送":`購買 ${reward.price_paid} 金幣`}</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{reward.description}</p>
 <Link href={`${base}&page=${page}&reward=${reward.id}`}>查看此份獎品紀錄</Link>
 {!!actions.length&&(reward.source==='gift'||process.env.PILOT_PURCHASE_FULFILLMENT_ENABLED==='true')&&<details><summary>管理這份獎品</summary><form action={manageReward}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="rewardId" value={reward.id}/><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="version" value={reward.version}/><input type="hidden" name="page" value={page!}/><p><label>操作 <select name="action">{actions.map(action=><option key={action} value={action}>{rewardActions[action]}</option>)}</select></label></p><p><label>操作原因 <input name="note" maxLength={200} required/></label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>確認操作的是這一份獎品；核銷及撤回後不能再使用。</label></p><Submit>確認執行</Submit></form></details>}
 </article>;
 })}</div>
 <p>{page!>1&&<Link href={`${base}&page=${page!-1}`}>上一頁</Link>}　{page!*50<total&&<Link href={`${base}&page=${page!+1}`}>下一頁</Link>}</p>
 {params.reward&&(!selected?.data?<p role="alert">找不到此學生的獎品紀錄。</p>:<section><h2>{selected.data.item_name} · 最新 50 筆操作紀錄</h2><ul>{history?.data?.map(row=><li key={row.id}>第 {row.version} 版 · {row.action==='gift'?'教師贈送':row.action==='purchase'?'購買入包':rewardActions[row.action as RewardAction]??row.action} · {row.note} · {new Date(row.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</li>)}</ul><p><Link href={`${base}&page=${page}`}>收起紀錄</Link></p></section>)}
 </>}
 </>}
 </main>;
}
