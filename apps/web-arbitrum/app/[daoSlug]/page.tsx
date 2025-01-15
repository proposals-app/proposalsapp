import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getGroups as fetchGroups } from "./actions";

// Cache the getGroups function
const getGroups = unstable_cache(
  async (daoSlug: string) => {
    return await fetchGroups(daoSlug);
  },
  ["getGroups"], // Cache key
  { revalidate: 60 * 5, tags: ["groups"] },
);

export default async function ListPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const groups = await getGroups(daoSlug);

  if (!groups) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100 pl-20">
      <div className="w-full p-4">
        <h1 className="mb-6 text-3xl font-bold">DAO: {daoSlug}</h1>
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <Link
              key={String(group.id)}
              href={`/${daoSlug}/${group.id}`}
              className="rounded-lg bg-white p-6 shadow-md hover:bg-gray-100"
            >
              <h2 className="mb-2 text-xl font-semibold">{group.name}</h2>
              <p className="text-gray-700">
                View proposals and discussions in the {group.name} group.
              </p>
              <pre className="text-sm text-gray-400">
                {JSON.stringify(group.items, null, `\t`)}
              </pre>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
