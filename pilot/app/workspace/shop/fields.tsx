import {shopLimits} from "../../../lib/shop";
export type ShopItem={id:string;name:string;icon:string;kind:string;description:string;price:number;min_level:number;stock:number;archived:boolean;version:number};
export function ProductFields({item}:{item?:ShopItem}){
 const field={display:"flex",flexDirection:"column" as const,gap:4};
 return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:16,marginBlock:16}}>
 <label style={field}>商品名稱<input name="name" maxLength={80} defaultValue={item?.name??""} required/><small>使用中商品名稱不可重複，最多 80 字。</small></label>
 <label style={field}>圖示／短字<input name="icon" maxLength={20} defaultValue={item?.icon??"禮"} required/><small>顯示在商品卡片，可填簡短文字或符號。</small></label>
 <label style={field}>商品種類<select name="kind" defaultValue={item?.kind??"physical"}><option value="physical">實體物品</option><option value="privilege">使用權益（點歌、作業減量等）</option></select><small>獎品不設定到期日；購買與背包將於後續串接。</small></label>
 <label style={field}>價格（金幣）<input name="price" type="number" min={0} max={shopLimits.price} step={1} defaultValue={item?.price??0} required/><small>整數 0～{shopLimits.price}，不是實際貨幣。</small></label>
 <label style={field}>最低購買等級<input name="minLevel" type="number" min={1} max={shopLimits.minLevel} step={1} defaultValue={item?.min_level??1} required/><small>未來購買時需達此等級；此頁只保存門檻。</small></label>
 <label style={field}>可供應數量<input name="stock" type="number" min={-1} max={shopLimits.stock} step={1} defaultValue={item?.stock??-1} required/><small>-1＝無限；0＝售罄；正整數＝剩餘件數。此階段不消耗庫存。</small></label>
 <label style={{...field,gridColumn:"1 / -1"}}>商品說明<textarea name="description" maxLength={1000} rows={3} defaultValue={item?.description??""}/><small>說明獎品內容及使用方式，最多 1000 字。</small></label>
 </div>;
}
