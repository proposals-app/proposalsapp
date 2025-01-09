import { ReactNode } from "react";
import { db } from "@proposalsapp/db";
import { notFound } from "next/navigation";
import { NavBar } from "./components/NavBar";

export default async function DaoLayout({
  params,
  children,
}: {
  params: Promise<{ daoSlug: string }>;
  children: ReactNode;
}) {
  const { daoSlug } = await params;
  // Fetch the DAO based on the slug
  const dao = await db
    .selectFrom("dao")
    .where("slug", "=", daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <NavBar dao={dao} daoSlug={daoSlug} />
      <div className="flex w-full justify-between">{children}</div>
    </div>
  );
}
