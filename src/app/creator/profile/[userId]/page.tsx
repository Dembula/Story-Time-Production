import { CreatorProfileClient } from "./profile-client";

interface CreatorProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function CreatorProfilePage({ params }: CreatorProfilePageProps) {
  const { userId } = await params;
  return <CreatorProfileClient userId={userId} />;
}
