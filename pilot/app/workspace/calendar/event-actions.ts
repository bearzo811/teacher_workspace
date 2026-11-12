"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverClient } from "../../../lib/supabase";
import { validDate } from "../../../lib/calendar";
async function teacher() {
  if (process.env.PILOT_CALENDAR_ENABLED!=="true" || process.env.PILOT_EVENTS_ENABLED!=="true") redirect("/workspace");
  const client=await serverClient(true);
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||user.app_metadata.provider!=="google") redirect("/login");
  return client;
}
function uuid(value:FormDataEntryValue|null) {
  const id=String(value??"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) redirect("/workspace/calendar?error=event");
  return id;
}
function finish(error:unknown) {
  if(error) redirect("/workspace/calendar?error=event");
  revalidatePath("/workspace/calendar");
  redirect("/workspace/calendar?notice=event#events");
}
export async function saveEvent(form:FormData) {
  const client=await teacher();
  const title=String(form.get("title")??"").trim();
  const day=String(form.get("day")??"");
  const note=String(form.get("note")??"").trim();
  if(!title||title.length>80||note.length>500||!validDate(day)||day<"2000-01-01"||day>"2100-12-31") redirect("/workspace/calendar?error=event");
  finish((await client.rpc("save_pilot_event",{target_class:uuid(form.get("classId")),target_event:form.get("eventId")?uuid(form.get("eventId")):null,event_title:title,event_day:day,event_note:note,show_countdown:form.get("countdown")==="yes"})).error);
}
export async function archiveEvent(form:FormData) {
  const client=await teacher();
  const mode=String(form.get("mode")??"");
  if(!["archive","restore"].includes(mode)||form.get("confirm")!=="yes") redirect("/workspace/calendar?error=event");
  finish((await client.rpc("archive_pilot_event",{target_event:uuid(form.get("eventId")),remove_event:mode==="archive"})).error);
}
