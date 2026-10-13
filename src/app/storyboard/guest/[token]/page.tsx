import { StoryboardGuestStudio } from "@/components/storyboard/storyboard-guest-studio";

export default async function StoryboardGuestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StoryboardGuestStudio token={token} />;
}
