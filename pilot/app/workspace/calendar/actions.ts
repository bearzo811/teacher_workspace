"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverClient } from "../../../lib/supabase";
import { validDate, validRange } from "../../../lib/calendar";

async function teacher() {
  if (process.env.PILOT_CALENDAR_ENABLED !== "true") redirect("/workspace");
  const client = await serverClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.app_metadata.provider !== "google") redirect("/login");
  return client;
}
function id(form: FormData, key: string) {
  const value = String(form.get(key) ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) redirect("/workspace/calendar?error=input");
  return value;
}
function termFields(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  if (!name || name.length > 80 || !validRange(start, end) || start < "2000-01-01" || end > "2100-12-31") redirect("/workspace/calendar?error=input");
  return { term_name: name, first_day: start, last_day: end };
}
function done(error: unknown) {
  if (error) redirect("/workspace/calendar?error=save");
  revalidatePath("/workspace/calendar");
  redirect("/workspace/calendar?notice=saved");
}
export async function createTerm(form: FormData) {
  const client = await teacher();
  done((await client.rpc("create_pilot_term", { target_class: id(form,"classId"), ...termFields(form) })).error);
}
export async function updateTerm(form: FormData) {
  const client = await teacher();
  done((await client.rpc("update_pilot_term", { target_term: id(form,"termId"), ...termFields(form) })).error);
}
export async function activateTerm(form: FormData) {
  const client = await teacher();
  done((await client.rpc("activate_pilot_term", { target_term: id(form,"termId") })).error);
}
export async function setDay(form: FormData) {
  const client = await teacher();
  const target_day = String(form.get("day") ?? "");
  const mode = String(form.get("mode") ?? "");
  const day_note = String(form.get("note") ?? "").trim();
  if (!validDate(target_day) || !["school","holiday","default"].includes(mode) || day_note.length > 120) redirect("/workspace/calendar?error=input");
  done((await client.rpc("set_pilot_day", { target_term: id(form,"termId"), target_day, school: mode === "default" ? null : mode === "school", day_note })).error);
}
