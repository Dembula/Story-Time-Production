import { CreatorProfileClient } from "./profile-client";

interface CreatorProfilePageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveReturnTo(searchParams: Record<string, string | string[] | undefined>) {
  const returnTo = searchParams.returnTo;
  if (typeof returnTo === "string" && returnTo.startsWith("/creator/network")) {
    return returnTo;
  }

  const from = searchParams.from;
  if (from === "discover") return "/creator/network?tab=discover";
  if (from === "feed") return "/creator/network?tab=feed";
  if (from === "chats") return "/creator/network?tab=chats";

  return null;
}

export default async function CreatorProfilePage({ params, searchParams }: CreatorProfilePageProps) {
  const { userId } = await params;
  const sp = await searchParams;
  return <CreatorProfileClient userId={userId} returnTo={resolveReturnTo(sp)} />;
}
