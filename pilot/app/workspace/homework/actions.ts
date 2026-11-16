"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
import {validHomeworkStatus} from "../../../lib/homework";
export async function setHomeworkCheck(form:FormData) {
 if(process.env.PILOT_HOMEWORK_CHECKS_ENABLED!=="true") redirect("/workspace");
 const client=await serverClient(true);
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google") redirect("/login");
 const ids=["classId","assignmentId","studentId"].map(key=>String(form.get(key)??""));
 const day=String(form.get("day")??"");const status=String(form.get("status")??"");
 if(ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||!validDate(day)||!validHomeworkStatus(status)) redirect("/workspace/homework?error=input");
 const result=await client.rpc("set_pilot_homework_check",{target_class:ids[0],target_assignment:ids[1],target_student:ids[2],homework_status:status});
 revalidatePath("/workspace/homework");
 redirect(`/workspace/homework?day=${day}&${result.error?"error=save":"notice=saved"}`);
}
