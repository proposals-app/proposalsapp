import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getGroups } from "./actions";
import { Suspense } from "react";
import { LazyLoadTrigger } from "./components/LazyLoadTrigger";

// Cache the getGroups function
const getCachedGroups = unstable_cache(
  async (daoSlug: string, page: number, itemsPerPage: number) => {
    return await getGroups(daoSlug, page, itemsPerPage);
  },
  ["getGroups"], // Cache key
  { revalidate: 60 * 5, tags: ["groups"] },
);

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug } = await params;
  const { page } = await searchParams;

  const currentPage = page ? Number(page) : 1;
  const itemsPerPage = 25; // Number of items per page

  // Fetch all groups up to the current page
  const allGroups = [];
  for (let i = 1; i <= currentPage; i++) {
    const groups = await getCachedGroups(daoSlug, i, itemsPerPage);

    // Handle the case where groups is null
    if (!groups) {
      continue; // Skip this page if no groups are found
    }

    allGroups.push(...groups);
  }

  if (!allGroups.length) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100 pl-20">
      <div className="w-full p-4">
        <h1 className="mb-6 text-3xl font-bold">DAO: {daoSlug}</h1>
        <div className="flex flex-col gap-2">
          {/* Server-rendered list of groups */}
          {allGroups.map((group) => (
            <Link
              key={String(group.id)}
              href={`/${daoSlug}/${group.id}`}
              className="rounded-lg bg-white p-6 shadow-md hover:bg-gray-100"
            >
              <h2 className="mb-2 text-xl font-semibold">{group.name}</h2>
              <p className="text-gray-700">
                View proposals and discussions in the {group.name} group.
              </p>
            </Link>
          ))}
        </div>

        {/* Client-side lazy load trigger */}
        <Suspense fallback={<div>Loading more groups...</div>}>
          <LazyLoadTrigger currentPage={currentPage} />
        </Suspense>
      </div>
    </div>
  );
}
