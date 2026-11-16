"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
async function teacher() {
  if(process.env.PILOT_WORKBOOKS_ENABLED!=="true") redirect("/workspace");
  const client=await serverClient(true);
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||user.app_metadata.provider!=="google") redirect("/login");
  return client;
}
function id(value:FormDataEntryValue|null) {
  const result=String(value??"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) redirect("/workspace/workbooks?error=input");
  return result;
}
function finish(error:unknown) {
  if(error) redirect("/workspace/workbooks?error=save");
  revalidatePath("/workspace/workbooks");
  redirect("/workspace/workbooks?notice=saved");
}
export async function saveWorkbook(form:FormData) {
  const client=await teacher();
  const subject=String(form.get("subject")??"").trim();
  const name=String(form.get("name")??"").trim();
  if(!subject||subject.length>40||!name||name.length>40) redirect("/workspace/workbooks?error=input");
  finish((await client.rpc("save_pilot_workbook",{target_class:id(form.get("classId")),target_workbook:form.get("workbookId")?id(form.get("workbookId")):null,workbook_subject:subject,workbook_name:name})).error);
}
export async function archiveWorkbook(form:FormData) {
  const client=await teacher();
  const mode=String(form.get("mode")??"");
  if(!["archive","restore"].includes(mode)||form.get("confirm")!=="yes") redirect("/workspace/workbooks?error=input");
  finish((await client.rpc("archive_pilot_workbook",{target_class:id(form.get("classId")),target_workbook:id(form.get("workbookId")),stop_using:mode==="archive"})).error);
}
