import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
export const dynamic="force-dynamic";
export default async function Receipts({searchParams}:{searchParams:Promise<{page?:string}>}){
 if(process.env.PILOT_PURCHASE_ENGINE_ENABLED!=="true")redirect("/workspace/shop");
 const params=await searchParams,page=params.page===undefined?1:/^[1-9]\d{0,3}$/.test(params.page)?Number(params.page):null;
 const client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const rooms=await client.from("pilot_classes").select("id,name,enabled_modules"),room=rooms.data?.[0];
 if(!rooms.error&&!room)redirect("/workspace");if(room&&!room.enabled_modules.includes("rewards"))redirect("/workspace");
 const receipts=room&&page?await client.from("pilot_purchase_receipts").select("id,student_id,reward_id,price_paid,ledger_id,stock_consumed,offer_version,rule_version,shop_version,created_at",{count:"exact"}).eq("class_id",room.id).order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1):null;
 const studentIds=[...new Set(receipts?.data?.map(r=>r.student_id)??[])],rewardIds=receipts?.data?.map(r=>r.reward_id)??[];
 const [students,rewards]=room&&rewardIds.length?await Promise.all([client.from("pilot_students").select("id,seat,name").eq("class_id",room.id).in("id",studentIds),client.from("pilot_student_rewards").select("id,item_name,status").eq("class_id",room.id).in("id",rewardIds)]):[null,null];
 const failed=rooms.error||receipts?.error||students?.error||rewards?.error;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace/shop">← 商品管理</Link><h1>購買交易紀錄</h1><p>{room?.name}</p><p>每筆紀錄對應一份永久背包獎品；商品後來改名，仍保留購買時名稱。免費商品沒有扣款帳本。這裡只供核對，不會再次扣款。</p>
 {failed?<p role="alert">交易紀錄讀取失敗。</p>:page===null?<p role="alert">頁碼無效。</p>:<><p>共 {receipts?.count??0} 筆；每頁最多 50 筆。</p>{!receipts?.data?.length&&<p>本頁沒有購買紀錄。目前尚無學生購買入口。</p>}
 {receipts?.data?.map(r=>{const student=students?.data?.find(s=>s.id===r.student_id),reward=rewards?.data?.find(w=>w.id===r.reward_id);return <article key={r.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16,marginBottom:12,overflowWrap:"anywhere"}}><h2>{reward?.item_name??'獎品資料未能顯示'}</h2><p>{student?`${student.seat} 號 ${student.name}`:'學生資料未能顯示'} · 實付 {r.price_paid} 金幣 · {r.stock_consumed?'有限庫存減一':'無限供應'}</p><p>{new Date(r.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})} · 交易 {r.id}</p><p>報價第 {r.offer_version} 版／獎勵規則第 {r.rule_version} 版／開放設定第 {r.shop_version} 版</p><p>扣款帳本：{r.ledger_id??'免費商品，無扣款'}</p><Link href={`/workspace/backpacks?student=${r.student_id}&reward=${r.reward_id}`}>查看對應背包與操作紀錄</Link></article>;})}
 <nav aria-label="交易紀錄分頁">{page>1&&<Link href={`/workspace/shop/receipts?page=${page-1}`}>上一頁</Link>} 第 {page} 頁 {page*50<(receipts?.count??0)&&page<9999&&<Link href={`/workspace/shop/receipts?page=${page+1}`}>下一頁</Link>}</nav></>}
 </main>;
}
