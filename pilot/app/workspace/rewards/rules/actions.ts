"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../../lib/supabase";
import {rewardRuleFields,validRewardRules} from "../../../../lib/reward-rules";
import {rewardAdjustment} from "../../../../lib/rewards";
export async function saveRewardRules(form:FormData){
 if(process.env.PILOT_REWARD_RULES_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const classroom=String(form.get("classId")??"");const version=String(form.get("version")??"");
 const rules=Object.fromEntries(rewardRuleFields.map(field=>[field.id,rewardAdjustment(form.get(field.id))]));
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classroom)||!/^\d{1,4}$/.test(version)||!validRewardRules(rules)||form.get("confirm")!=="yes")redirect("/workspace/rewards/rules?error=input");
 const result=await client.rpc("save_pilot_reward_rules",{target_class:classroom,target_rules:rules,expected_version:Number(version)});
 revalidatePath("/workspace/rewards/rules");redirect(`/workspace/rewards/rules?${result.error?"error=save":"notice=saved"}`);
}
