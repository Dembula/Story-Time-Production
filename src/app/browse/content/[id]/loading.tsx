import { ServerStoryTimeLoadingCenter } from "@/components/ui/storytime-loader-server";

export default function ContentDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <ServerStoryTimeLoadingCenter minHeight="60vh" size="md" />
    </div>
  );
}
