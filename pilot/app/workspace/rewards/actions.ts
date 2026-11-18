"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {rewardAdjustment} from "../../../lib/rewards";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function adjustRewards(form:FormData){
 if(process.env.PILOT_REWARD_LEDGER_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const classroom=String(form.get("classId")??""),student=String(form.get("studentId")??""),request=String(form.get("requestId")??"");
 const coins=rewardAdjustment(form.get("coins")),xp=rewardAdjustment(form.get("xp")),reason=String(form.get("reason")??"").trim();
 if(!uuid.test(classroom)||!uuid.test(student)||!uuid.test(request)||coins===null||xp===null||(!coins&&!xp)||!reason||reason.length>200)redirect("/workspace/rewards?error=input");
 const result=await client.rpc("adjust_pilot_rewards",{target_class:classroom,target_student:student,request_key:request,coins,xp,adjustment_reason:reason});
 revalidatePath("/workspace/rewards");redirect(`/workspace/rewards?student=${student}&${result.error?"error=save":"notice=saved"}`);
}
