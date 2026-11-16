"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {validDate} from "../../../lib/calendar";
async function teacher() {
 if(process.env.PILOT_CONTACT_BOOK_ENABLED!=="true") redirect("/workspace");
 const client=await serverClient(true);
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google") redirect("/login");
 return client;
}
function uuid(value:FormDataEntryValue|null) {
 const id=String(value??"");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) redirect("/workspace/contact-book?error=input");
 return id;
}
function day(form:FormData) {
 const value=String(form.get("day")??"");
 if(!validDate(value)) redirect("/workspace/contact-book?error=input");
 return value;
}
function finish(error:unknown,form:FormData) {
 revalidatePath("/workspace/contact-book");
 redirect(`/workspace/contact-book?day=${day(form)}&${error?"error=save":"notice=saved"}`);
}
export async function saveNotes(form:FormData) {
 const client=await teacher(); const notes=String(form.get("notes")??"").trim();
 if(notes.length>3000) redirect("/workspace/contact-book?error=input");
 finish((await client.rpc("save_pilot_contact_notes",{target_class:uuid(form.get("classId")),target_term:uuid(form.get("termId")),target_day:day(form),contact_notes:notes})).error,form);
}
export async function saveAssignment(form:FormData) {
 const client=await teacher();const content=String(form.get("content")??"").trim();
 if(!content||content.length>200) redirect("/workspace/contact-book?error=input");
 finish((await client.rpc("save_pilot_assignment",{target_class:uuid(form.get("classId")),target_term:uuid(form.get("termId")),target_day:day(form),target_assignment:form.get("assignmentId")?uuid(form.get("assignmentId")):null,target_workbook:uuid(form.get("workbookId")),assignment_content:content,restrict_break:form.get("break")==="yes",restrict_shop:form.get("shop")==="yes"})).error,form);
}
export async function archiveAssignment(form:FormData) {
 const client=await teacher();const mode=String(form.get("mode")??"");
 if(!["archive","restore"].includes(mode)||form.get("confirm")!=="yes") redirect("/workspace/contact-book?error=input");
 finish((await client.rpc("archive_pilot_assignment",{target_class:uuid(form.get("classId")),target_assignment:uuid(form.get("assignmentId")),remove_assignment:mode==="archive"})).error,form);
}
