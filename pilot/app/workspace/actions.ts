"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverClient } from "../../lib/supabase";
import { validateModules } from "../../lib/modules";

async function teacherClient() {
  const client = await serverClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.app_metadata.provider !== "google") redirect("/login");
  return client;
}

export async function createClass(form: FormData) {
  const client = await teacherClient();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 80) redirect("/workspace?error=input");
  const selected = validateModules(form.getAll("modules"));
  if (!selected) redirect("/workspace?error=input");
  const { error } = process.env.PILOT_MODULE_SELECTION_ENABLED === "true"
    ? await client.rpc("create_pilot_class_with_modules", { class_name: name, selected_modules: selected })
    : await client.rpc("create_pilot_class", { class_name: name });
  if (error) redirect("/workspace?error=create");
  revalidatePath("/workspace");
  redirect("/workspace");
}

export async function configureModules(form: FormData) {
  if (process.env.PILOT_MODULE_SELECTION_ENABLED !== "true") redirect("/workspace?error=unavailable");
  const client = await teacherClient();
  const id = uuid(form.get("classId"));
  const selected = validateModules(form.getAll("modules"));
  if (!selected) redirect("/workspace?error=input");
  const { error } = await client.rpc("configure_pilot_modules", { target_class: id, selected_modules: selected });
  if (error) redirect("/workspace?error=modules");
  revalidatePath("/workspace");
  redirect("/workspace?notice=modules");
}

export async function addStudent(form: FormData) {
  const client = await teacherClient();
  const seat = Number(form.get("seat"));
  const name = String(form.get("name") ?? "").trim();
  const classId = String(form.get("classId") ?? "");
  if (!Number.isInteger(seat) || seat < 1 || seat > 99 || !name || name.length > 80
    || !/^[0-9a-f-]{36}$/i.test(classId)) redirect("/workspace?error=input");
  const { error } = await client.rpc("add_pilot_student", { target_class: classId, student_seat: seat, student_name: name });
  if (error) redirect("/workspace?error=student");
  revalidatePath("/workspace");
  redirect("/workspace");
}

function uuid(value: FormDataEntryValue | null) {
  const id = String(value ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) redirect("/workspace?error=input");
  return id;
}

function requireRosterManagement() {
  if (process.env.PILOT_ROSTER_MANAGEMENT_ENABLED !== "true") redirect("/workspace?error=unavailable");
}

export async function renameClass(form: FormData) {
  requireRosterManagement();
  const client = await teacherClient();
  const id = uuid(form.get("classId"));
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 80) redirect("/workspace?error=input");
  const { error } = await client.rpc("rename_pilot_class", { target_class: id, class_name: name });
  if (error) redirect("/workspace?error=rename");
  revalidatePath("/workspace");
  redirect("/workspace");
}

export async function updateStudent(form: FormData) {
  requireRosterManagement();
  const client = await teacherClient();
  const id = uuid(form.get("studentId"));
  const seat = Number(form.get("seat"));
  const name = String(form.get("name") ?? "").trim();
  if (!Number.isInteger(seat) || seat < 1 || seat > 99 || !name || name.length > 80) redirect("/workspace?error=input");
  const { error } = await client.rpc("update_pilot_student", { target_student: id, student_seat: seat, student_name: name });
  if (error) redirect("/workspace?error=student");
  revalidatePath("/workspace");
  redirect("/workspace");
}

export async function archiveStudent(form: FormData) {
  requireRosterManagement();
  const client = await teacherClient();
  const id = uuid(form.get("studentId"));
  if (form.get("confirm") !== "yes") redirect("/workspace?error=confirm");
  const { error } = await client.rpc("archive_pilot_student", { target_student: id });
  if (error) redirect("/workspace?error=archive");
  revalidatePath("/workspace");
  redirect("/workspace");
}

export async function restoreStudent(form: FormData) {
  requireRosterManagement();
  const client = await teacherClient();
  const id = uuid(form.get("studentId"));
  const { error } = await client.rpc("restore_pilot_student", { target_student: id });
  if (error) redirect("/workspace?error=restore");
  revalidatePath("/workspace");
  redirect("/workspace");
}
