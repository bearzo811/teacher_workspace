"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../../lib/supabase";
export async function configureRoutineRewards(form:FormData){
 if(process.env.PILOT_ROUTINE_REWARDS_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const classroom=String(form.get("classId")??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classroom)||form.get("confirm")!=="yes")redirect("/workspace/rewards/automation?error=input");
 const result=await client.rpc("configure_pilot_routine_rewards",{target_class:classroom,is_enabled:form.get("enabled")==="yes"});
 revalidatePath("/workspace/rewards/automation");redirect(`/workspace/rewards/automation?${result.error?"error=save":"notice=saved"}`);
}
