"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
import {validReturnTask} from "../../../lib/return-days";
async function teacher(){if(process.env.PILOT_RETURN_DAYS_ENABLED!=="true")redirect("/workspace");const client=await serverClient(true);const {data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=="google")redirect("/login");return client;}
function id(value:FormDataEntryValue|null){const result=String(value??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result))redirect("/workspace/return-days?error=input");return result;}
function day(form:FormData){const result=String(form.get("day")??"");if(!validDate(result)||result<"2000-01-01"||result>"2100-12-31")redirect("/workspace/return-days?error=input");return result;}
function finish(error:unknown,date:string){revalidatePath("/workspace/return-days");revalidatePath("/workspace/today");redirect(`/workspace/return-days?day=${date}&${error?"error=save":"notice=saved"}`);}
export async function saveReturnDay(form:FormData){const client=await teacher();const date=day(form);const label=String(form.get("label")??"").trim();if(!label||label.length>60)redirect("/workspace/return-days?error=input");finish((await client.rpc("save_pilot_return_day",{target_class:id(form.get("classId")),target_day:date,day_label:label,is_enabled:form.get("enabled")==="yes"})).error,date);}
export async function setReturnTask(form:FormData){const client=await teacher();const date=day(form);const task=String(form.get("task")??"");const state=String(form.get("state")??"");if(!validReturnTask(task)||!["true","false"].includes(state))redirect("/workspace/return-days?error=input");finish((await client.rpc("set_pilot_return_check",{target_class:id(form.get("classId")),target_student:id(form.get("studentId")),target_day:date,routine_key:task,is_completed:state==="true"})).error,date);}
