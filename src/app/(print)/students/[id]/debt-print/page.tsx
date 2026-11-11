import { notFound, redirect } from "next/navigation";
import { isTeacherRequest } from "@/lib/access";
import { getStudentDebtChecklist } from "@/services/debtChecklistService";
import { DebtChecklistPrint } from "@/components/students/DebtChecklistPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "欠繳作業自主檢核表" };

export default async function DebtPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isTeacherRequest())) redirect(`/login?next=${encodeURIComponent(`/students/${id}/debt-print`)}`);
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) notFound();
  const data = await getStudentDebtChecklist(id);
  if (!data) notFound();
  return <DebtChecklistPrint data={data} studentId={id} />;
}
