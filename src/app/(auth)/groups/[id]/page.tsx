import GroupDetail from "@/components/GroupDetail";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <GroupDetail id={(await params).id} />;
}
