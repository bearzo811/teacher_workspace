"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {backpackPage,rewardActions} from "../../../lib/backpack";
async function teacher(){
 if(process.env.PILOT_BACKPACK_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");return client;
}
function id(value:FormDataEntryValue|null){const result=String(value??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result))redirect("/workspace/backpacks?error=input");return result;}
function note(form:FormData){const value=String(form.get("note")??"").trim();if(!value||value.length>200||form.get("confirm")!=="yes")redirect("/workspace/backpacks?error=input");return value;}
function finish(error:unknown,student:string,page:number){revalidatePath("/workspace/backpacks");redirect(`/workspace/backpacks?student=${student}&page=${page}&${error?"error=save":"notice=saved"}`);}
export async function giftReward(form:FormData){
 const client=await teacher(),student=id(form.get("studentId"));
 const result=await client.rpc("gift_pilot_reward",{target_class:id(form.get("classId")),target_student:student,target_item:id(form.get("itemId")),request_key:id(form.get("requestId")),gift_note:note(form)});
 finish(result.error,student,1);
}
export async function manageReward(form:FormData){
 const client=await teacher(),student=id(form.get("studentId")),action=String(form.get("action")??""),versionText=String(form.get("version")??"");
 const page=backpackPage(String(form.get("page")??"1"));
 if(!Object.hasOwn(rewardActions,action)||!/^\d{1,7}$/.test(versionText)||Number(versionText)<1||Number(versionText)>1000000||page===null)redirect("/workspace/backpacks?error=input");
 const result=await client.rpc("manage_pilot_reward",{target_class:id(form.get("classId")),target_student:student,target_reward:id(form.get("rewardId")),request_key:id(form.get("requestId")),expected_version:Number(versionText),reward_action:action,action_note:note(form)});
 finish(result.error,student,page);
}
