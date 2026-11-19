import Link from "next/link";
import {redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {shopLimits} from "../../../lib/shop";
import {Submit} from "../submit";
import {ProductFields,type ShopItem} from "./fields";
import {saveShopItem,archiveShopItem} from "./actions";
export const dynamic="force-dynamic";
export default async function Shop({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_SHOP_CATALOG_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"rewards");
 const products=enabled?await client.from("pilot_shop_items").select("id,name,icon,kind,description,price,min_level,stock,archived,version").eq("class_id",classroom.id).order("min_level",{ascending:false}).order("price",{ascending:false}).order("name").order("id").range(0,shopLimits.retained):null;
 const unavailable=classes.error||products?.error||(products?.data?.length??0)>shopLimits.retained;
 const items=(products?.data??[]) as ShopItem[];
 return <main style={{maxWidth:1200,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>商品管理</h1><p>{classroom?.name}</p>
 <p>僅老師端管理商品；尚未開放學生購買、扣款或學生大屏。依等級由高到低，同等級價格由高到低排列。</p>
 {process.env.PILOT_BACKPACK_ENABLED==="true"&&<p><Link href="/workspace/backpacks">學生背包與老師贈送／核銷</Link></p>}
 {params.notice==="saved"&&<p role="status">商品設定已儲存。</p>}{params.error&&<p role="alert">未能儲存，請重新整理後確認名稱沒有重複、數值有效且版本未被其他分頁更新。</p>}
 {unavailable?<p role="alert">商品資料讀取失敗，不提供操作。</p>:!enabled?<p>請先在工作台開啟金幣與商店模組。</p>:<>
 <details><summary>新增商品</summary><p>每班最多保留 {shopLimits.retained} 項（含已移除）。重送同一新增表單不重複建立。</p><form action={saveShopItem}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="version" value="0"/><ProductFields/><Submit>新增商品</Submit></form></details>
 <h2>使用中商品（{items.filter(item=>!item.archived).length}）</h2>
 {!items.some(item=>!item.archived)&&<p>尚無使用中商品。</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:16}}>{items.filter(item=>!item.archived).map(item=><article key={item.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16,minWidth:0}}><h3 style={{overflowWrap:"anywhere"}}>{item.icon} {item.name}</h3><p>Lv.{item.min_level} 以上 · {item.price} 金幣 · {item.stock===-1?"無限供應":item.stock===0?"售罄":`剩餘 ${item.stock} 件`}</p><p>{item.kind==="privilege"?"使用權益":"實體物品"} · 第 {item.version} 版</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.description}</p>
 <details><summary>編輯商品</summary><form action={saveShopItem}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="version" value={item.version}/><ProductFields item={item}/><Submit>儲存商品</Submit></form></details>
 <details><summary>移除商品</summary><form action={archiveShopItem}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="version" value={item.version}/><input type="hidden" name="mode" value="archive"/><p><label><input type="checkbox" name="confirm" value="yes" required/>確認移至已移除清單，資料保留並可復原。</label></p><Submit>確認移除</Submit></form></details>
 </article>)}</div>
 <details style={{marginTop:24}}><summary>已移除商品（{items.filter(item=>item.archived).length}）</summary>{items.filter(item=>item.archived).map(item=><form key={item.id} action={archiveShopItem} style={{borderBottom:"1px solid #cbd5e1",padding:12}}><strong>{item.name}</strong><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="version" value={item.version}/><input type="hidden" name="mode" value="restore"/><p><label><input type="checkbox" name="confirm" value="yes" required/>確認復原（使用中若已有同名商品會拒絕）</label></p><Submit>復原商品</Submit></form>)}</details>
 </>}
 </main>;
}
