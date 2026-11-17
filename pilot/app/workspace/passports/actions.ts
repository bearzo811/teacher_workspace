"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validWeeks} from "../../../lib/passports";
async function teacher(){
 if(process.env.PILOT_PASSPORTS_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google")redirect("/login");return client;
}
function id(value:FormDataEntryValue|null){const result=String(value??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result))redirect("/workspace/passports?error=input");return result;}
function finish(error:unknown){revalidatePath("/workspace/passports");redirect(`/workspace/passports?${error?"error=save":"notice=saved"}`);}
export async function createPassport(form:FormData){
 const client=await teacher();const name=String(form.get("name")??"").trim();const first=Number(form.get("first")),last=Number(form.get("last"));
 if(!name||name.length>60||!validWeeks(first,last))redirect("/workspace/passports?error=input");
 finish((await client.rpc("create_pilot_passport",{target_class:id(form.get("classId")),target_term:id(form.get("termId")),passport_name:name,start_week:first,end_week:last})).error);
}
export async function archivePassport(form:FormData){
 const client=await teacher();const state=String(form.get("state")??"");if(!["true","false"].includes(state)||form.get("confirm")!=="yes")redirect("/workspace/passports?error=input");
 finish((await client.rpc("archive_pilot_passport",{target_class:id(form.get("classId")),target_passport:id(form.get("passportId")),stop_using:state==="true"})).error);
}
export async function setPassport(form:FormData){
 const client=await teacher();const week=Number(form.get("week"));const state=String(form.get("state")??"");if(!validWeeks(week,week)||!["true","false"].includes(state))redirect("/workspace/passports?error=input");
 finish((await client.rpc("set_pilot_passport_check",{target_class:id(form.get("classId")),target_passport:id(form.get("passportId")),target_student:id(form.get("studentId")),target_week:week,is_completed:state==="true"})).error);
}
