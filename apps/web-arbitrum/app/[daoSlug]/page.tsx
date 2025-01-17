import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getGroups } from "./actions";
import { Suspense } from "react";
import { LazyLoadTrigger } from "./components/LazyLoadTrigger";
import { getGroupData } from "./[groupId]/actions";
import { after } from "next/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Skeleton } from "@/shadcn/ui/skeleton";
import { Button } from "@/shadcn/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/shadcn/ui/avatar";

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
    <div className="flex min-h-screen w-full flex-row bg-background pl-20">
      <div className="w-full p-8">
        {/* Use the DAO name in the heading */}
        <h1 className="mb-8 text-4xl font-bold text-foreground">
          {daoName || daoSlug}
        </h1>
        <div className="flex flex-col gap-4">
          {/* Server-rendered list of groups */}
          {allGroups.map((group) => (
            <Link
              key={String(group.id)}
              href={`/${daoSlug}/${group.id}`}
              prefetch={true}
            >
              <Card className="transition-shadow duration-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {group.name}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    View proposals and discussions in the {group.name} group.
                  </CardDescription>
                </CardHeader>
                <CardContent></CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Client-side lazy load trigger */}
        <Suspense fallback={<LoadingSkeleton />}>
          <LazyLoadTrigger currentPage={currentPage} />
        </Suspense>
      </div>
    </div>
  );
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="mt-2 h-4 w-full rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
