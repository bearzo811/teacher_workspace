"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
import {validRoutine} from "../../../lib/routines";
export async function setRoutine(form:FormData){
 if(process.env.PILOT_ROUTINES_ENABLED!=="true") redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const ids=["classId","termId","studentId"].map(key=>String(form.get(key)??""));
 const day=String(form.get("day")??"");const task=String(form.get("task")??"");const state=String(form.get("state")??"");
 if(ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||!validDate(day)||!validRoutine(task)||!["true","false"].includes(state))redirect("/workspace/routines?error=input");
 const result=await client.rpc("set_pilot_routine_check",{target_class:ids[0],target_term:ids[1],target_student:ids[2],target_day:day,routine_key:task,is_completed:state==="true"});
 revalidatePath("/workspace/routines");redirect(`/workspace/routines?day=${day}&${result.error?"error=save":"notice=saved"}`);
}
