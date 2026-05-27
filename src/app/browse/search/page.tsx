import { BrowseSearchWithModoc } from "../browse-search-with-modoc";

type Props = {
  searchParams: Promise<{ q?: string; type?: string; filter?: string }>;
};

export default async function BrowseSearchPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="min-h-[60vh] px-4 pt-4 md:px-12 md:pt-6">
      <h1 className="mb-4 font-display text-xl font-semibold text-white md:text-2xl">Search</h1>
      <BrowseSearchWithModoc defaultSearch={params.q ?? ""} type={params.type} filter={params.filter} />
    </div>
  );
}
