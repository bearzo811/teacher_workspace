"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {shopInteger,validShopKind,shopLimits} from "../../../lib/shop";
async function teacher(){
 if(process.env.PILOT_SHOP_CATALOG_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google")redirect("/login");return client;
}
function id(value:FormDataEntryValue|null){const result=String(value??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result))redirect("/workspace/shop?error=input");return result;}
function finish(error:unknown){if(error)redirect("/workspace/shop?error=save");revalidatePath("/workspace/shop");redirect("/workspace/shop?notice=saved");}
export async function saveShopItem(form:FormData){
 const client=await teacher();const name=String(form.get("name")??"").trim(),icon=String(form.get("icon")??"").trim(),kind=String(form.get("kind")??""),description=String(form.get("description")??"").trim();
 const price=shopInteger(form.get("price"),0,shopLimits.price),level=shopInteger(form.get("minLevel"),1,shopLimits.minLevel),stock=shopInteger(form.get("stock"),-1,shopLimits.stock),version=shopInteger(form.get("version"),0,1000000);
 if(!name||name.length>80||!icon||icon.length>20||!validShopKind(kind)||description.length>1000||price===null||level===null||stock===null||version===null)redirect("/workspace/shop?error=input");
 finish((await client.rpc("save_pilot_shop_item",{target_class:id(form.get("classId")),target_item:form.get("itemId")?id(form.get("itemId")):null,request_key:id(form.get("requestId")),expected_version:version,product_name:name,product_icon:icon,product_kind:kind,product_description:description,product_price:price,product_min_level:level,product_stock:stock})).error);
}
export async function archiveShopItem(form:FormData){
 const client=await teacher(),mode=String(form.get("mode")??""),version=shopInteger(form.get("version"),1,1000000);
 if(!['archive','restore'].includes(mode)||version===null||form.get("confirm")!=="yes")redirect("/workspace/shop?error=input");
 finish((await client.rpc("archive_pilot_shop_item",{target_class:id(form.get("classId")),target_item:id(form.get("itemId")),stop_using:mode==='archive',expected_version:version})).error);
}
