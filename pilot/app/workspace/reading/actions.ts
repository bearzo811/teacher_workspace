"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
import {readingKinds,validReadingStatus} from "../../../lib/reading";
export async function setReading(form:FormData){
 if(process.env.PILOT_READING_ENABLED!=="true")redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");
 const ids=["classId","termId","studentId"].map(key=>String(form.get(key)??""));const month=String(form.get("month")??"");const kind=String(form.get("kind")??"");const status=String(form.get("status")??"");
 if(ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||!validDate(month)||!month.endsWith('-01')||!readingKinds.some(item=>item.id===kind)||!validReadingStatus(status))redirect("/workspace/reading?error=input");
 const result=await client.rpc("set_pilot_reading_check",{target_class:ids[0],target_term:ids[1],target_student:ids[2],reading_kind:kind,target_month:month,reading_status:status});
 revalidatePath("/workspace/reading");redirect(`/workspace/reading?${result.error?"error=save":"notice=saved"}`);
}
