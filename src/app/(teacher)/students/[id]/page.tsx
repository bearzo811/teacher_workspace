import { StudentDetailClient } from "@/components/students/StudentDetailClient";

type StudentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { id } = await params;
  return <StudentDetailClient studentId={id} />;
}
