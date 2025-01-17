import { ReactNode } from "react";
import { db } from "@proposalsapp/db";
import { notFound } from "next/navigation";
import { NavBar } from "./components/NavBar";
import { unstable_cache } from "next/cache";

// Define a cached function to fetch the DAO data
const getDaoBySlug = unstable_cache(
  async (daoSlug: string) => {
    return await db
      .selectFrom("dao")
      .where("slug", "=", daoSlug)
      .selectAll()
      .executeTakeFirst();
  },
  ["dao-by-slug"],
  { revalidate: 3600, tags: ["dao"] }, // Cache for 1 hour
);

export default async function DaoLayout({
  params,
  children,
}: {
  params: Promise<{ daoSlug: string }>;
  children: ReactNode;
}) {
  const { daoSlug } = await params;

  // Fetch the DAO using the cached function
  const dao = await getDaoBySlug(daoSlug);

  if (!dao) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-row">
      <NavBar dao={dao} daoSlug={daoSlug} />
      <div className="flex w-full justify-between">{children}</div>
    </div>
  );
}
