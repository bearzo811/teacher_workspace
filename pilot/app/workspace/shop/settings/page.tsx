import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {Submit} from "../../submit";
import {configureShop} from "./actions";
export const dynamic="force-dynamic";
export default async function Settings({searchParams}:{searchParams:Promise<{student?:string;error?:string;notice?:string}>}){
 if(process.env.PILOT_PURCHASE_ENGINE_ENABLED!=="true")redirect("/workspace/shop");
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules"),room=classes.data?.[0];
 if(!room&&!classes.error)redirect("/workspace");
 if(room&&!room.enabled_modules.includes("rewards"))redirect("/workspace");
 const [settings,students]=room?await Promise.all([client.from("pilot_shop_settings").select("is_open,version").eq("class_id",room.id).maybeSingle(),client.from("pilot_students").select("id,seat,name").eq("class_id",room.id).is("deleted_at",null).order("seat")]):[null,null];
 const selected=students?.data?.find(s=>s.id===params.student)??students?.data?.[0];
 const preview=room&&selected?await client.rpc("get_pilot_shop_eligibility",{target_class:room.id,target_student:selected.id}):null;
 const unavailable=classes.error||settings?.error||students?.error||preview?.error;
 const state=preview?.data as {rules_confirmed:boolean;term_ready:boolean;learning_clear:boolean;homework:number;passports:number;reading:number;coins:number;level:number|null}|null;
 return <main style={{maxWidth:900,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace/shop">← 商品管理</Link><h1>商店開放與購買資格</h1><p>{room?.name}</p>
 <p>目前準備私有購買交易功能，尚未提供學生購買入口。每班預設關閉；購買成功時會直接扣金幣、扣庫存並放入永久背包，不需要老師核准購買。</p>
 {params.notice&&<p role="status">商店設定已儲存。</p>}{params.error&&<p role="alert">未能儲存。請先確認獎勵規則，或重新整理後再試。</p>}
 {unavailable?<p role="alert">讀取失敗，暫不提供操作。</p>:<><h2>目前：{settings?.data?.is_open?'開放':'關閉'}</h2><form action={configureShop}><input type="hidden" name="classId" value={room!.id}/><input type="hidden" name="version" value={settings?.data?.version??0}/><input type="hidden" name="mode" value={settings?.data?.is_open?'close':'open'}/><p><label><input type="checkbox" name="confirm" value="yes" required/>確認{settings?.data?.is_open?'關閉':'開放'}本班商店交易設定。</label></p><Submit>儲存開放設定</Submit></form>
 <h2>學生資格預覽</h2><form method="get"><label>學生 <select name="student" defaultValue={selected?.id}>{students?.data?.map(s=><option key={s.id} value={s.id}>{s.seat} 號 {s.name}</option>)}</select></label> <button>查看</button></form>
 {state?<><p>Lv.{state.level??'尚未確認規則'} · 可用 {state.coins} 金幣</p><p>影響商店的未完成項目：作業 {state.homework} 項、護照 {state.passports} 項、讀報／閱讀 {state.reading} 項。</p><p>{!state.rules_confirmed?'請先確認班級獎勵規則。':!state.term_ready?'請先建立並啟用學期。':state.learning_clear?'學習條件已通過。':'尚有影響商店的未完成項目。'}</p></>:<p>請先新增學生。</p>}
 <p>作業依「影響商店」設定檢查；護照包含當週及以前；讀報與閱讀等月份結束後才算欠繳。交易仍會重新檢查開放狀態、金幣、商品等級、價格及庫存。老師贈送不受購買資格限制。</p></>}
 </main>;
}
