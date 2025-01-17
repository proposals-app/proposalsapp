import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getGroups } from "./actions";
import { Suspense } from "react";
import { LazyLoadTrigger } from "./components/LazyLoadTrigger";
import { getGroupData } from "./[groupId]/actions";
import { after } from "next/server";

// Cache the getGroups function
const getCachedGroups = unstable_cache(
  async (daoSlug: string, page: number, itemsPerPage: number) => {
    return await getGroups(daoSlug, page, itemsPerPage);
  },
  ["getGroups"], // Cache key
  { revalidate: 60 * 5, tags: ["groups"] },
);

// Cache each group's data
const cachedGetGroupData = unstable_cache(
  async (daoSlug: string, groupId: string) => {
    return await getGroupData(daoSlug, groupId);
  },
  ["group-data"],
  { revalidate: 60 * 5, tags: ["group-data"] },
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
  const allGroups: Array<{
    id: string;
    name: string;
    daoId: string;
  }> = []; // Define the type explicitly
  let daoName: string | null = null; // Variable to store the DAO name

  for (let i = 1; i <= currentPage; i++) {
    const result = await getCachedGroups(daoSlug, i, itemsPerPage);

    // Handle the case where result is null or result.groups is not an array
    if (!result || !Array.isArray(result.groups)) {
      continue; // Skip this page if no groups are found
    }

    // Store the DAO name from the first page's result
    if (i === 1) {
      daoName = result.daoName;
    }

    // Push the groups into the allGroups array
    allGroups.push(...result.groups);
  }

  if (!allGroups.length) {
    notFound();
  }

  after(async () => {
    // Prefetch group data in parallel
    await Promise.all(
      allGroups.map((group) => {
        cachedGetGroupData(daoSlug, group.id);
      }),
    );
  });

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100 pl-20">
      <div className="w-full p-4">
        {/* Use the DAO name in the heading */}
        <h1 className="mb-6 text-3xl font-bold">{daoName || daoSlug}</h1>
        <div className="flex flex-col gap-2">
          {/* Server-rendered list of groups */}
          {allGroups.map((group) => (
            <Link
              key={String(group.id)}
              href={`/${daoSlug}/${group.id}`}
              className="rounded-lg bg-white p-6 shadow-md hover:bg-gray-100"
              prefetch={true}
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
