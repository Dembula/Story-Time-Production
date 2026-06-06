import { ServerStoryTimeLoadingCenter } from "@/components/ui/storytime-loader-server";

export default function BrowseLoading() {
  return (
    <div className="relative mx-auto min-h-[70vh] max-w-7xl px-4 pb-16 pt-4 md:px-8">
      <ServerStoryTimeLoadingCenter minHeight="70vh" size="lg" />
    </div>
  );
}
