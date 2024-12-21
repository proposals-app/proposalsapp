import { notFound } from "next/navigation";
import { getBodiesForGroup, getFeedForGroup, getGroup } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { searchParamsCache } from "@/app/searchParams";
import { StickyHeader } from "./components/StickyHeader";
import { MenuBar } from "./components/menubar/MenuBar";
import Feed from "./components/feed/Feed";
import { Suspense } from "react";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ dao: string; proposal_id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dao, proposal_id } = await params;
  const group = await getGroup(dao, proposal_id);
  if (!group) {
    notFound();
  }

  const { version } = await searchParamsCache.parse(searchParams);

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <div className="hidden md:flex">
        <SideBar dao={group.dao} />
      </div>

      <div className="flex w-full flex-row md:pl-20">
        <div className="flex w-full flex-col items-center gap-4">
          <Suspense fallback={<div>Loading body</div>}>
            <Body group={group} version={version ?? 0} />
          </Suspense>
          <MenuBar />
          <Suspense fallback={<div>Loading feed</div>}>
            <Feed group={group} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
