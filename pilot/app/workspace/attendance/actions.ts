"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
export async function setAttendance(form:FormData) {
 if(process.env.PILOT_ATTENDANCE_ENABLED!=="true") redirect("/workspace");
 const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google") redirect("/login");
 const ids=["classId","studentId"].map(key=>String(form.get(key)??""));
 const day=String(form.get("day")??"");const state=String(form.get("state")??"");
 if(ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||!validDate(day)||day<"2000-01-01"||day>"2100-12-31"||!["present","absent"].includes(state)) redirect("/workspace/attendance?error=input");
 const result=await client.rpc("set_pilot_attendance",{target_class:ids[0],target_student:ids[1],target_day:day,is_absent:state==="absent"});
 revalidatePath("/workspace/attendance");
 redirect(`/workspace/attendance?day=${day}&${result.error?"error=save":"notice=saved"}`);
}
