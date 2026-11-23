"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../../lib/supabase";
import {shopInteger} from "../../../../lib/shop";
export async function configureShop(form:FormData){
 if(process.env.PILOT_PURCHASE_ENGINE_ENABLED!=="true")redirect("/workspace/shop");
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const classroom=String(form.get("classId")??""),mode=String(form.get("mode")??""),version=shopInteger(form.get("version"),0,1000000);
 if(!/^[0-9a-f-]{36}$/i.test(classroom)||!['open','close'].includes(mode)||version===null||form.get("confirm")!=="yes")redirect("/workspace/shop/settings?error=input");
 const result=await client.rpc("configure_pilot_shop",{target_class:classroom,open_shop:mode==='open',expected_version:version});
 revalidatePath("/workspace/shop/settings");redirect(`/workspace/shop/settings?${result.error?'error=save':'notice=saved'}`);
}
