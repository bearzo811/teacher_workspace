"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverClient } from "../../lib/supabase";

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
  const { error } = await client.rpc("create_pilot_class", { class_name: name });
  if (error) redirect("/workspace?error=create");
  revalidatePath("/workspace");
  redirect("/workspace");
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
