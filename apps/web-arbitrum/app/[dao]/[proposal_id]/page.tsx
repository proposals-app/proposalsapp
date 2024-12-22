import { notFound } from "next/navigation";
import { getGroup } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { searchParamsCache } from "@/app/searchParams";
import { MenuBar } from "./components/menubar/MenuBar";
import Feed from "./components/feed/Feed";
import { Suspense } from "react";
import { Timeline } from "./components/timeline/Timeline";

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

  const { version, comments, votes, diff, expanded } =
    await searchParamsCache.parse(searchParams);

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <div className="hidden lg:flex">
        <SideBar dao={group.dao} />
      </div>

      <div className="flex w-full justify-between lg:pl-20">
        <div className="mx-auto flex w-3/4 flex-col justify-center lg:w-1/2">
          <Suspense fallback={<div>Loading body</div>}>
            <Body
              group={group}
              version={version ?? 0}
              diff={diff}
              expanded={expanded}
            />
          </Suspense>
          <Suspense fallback={<div>Loading MenuBar</div>}>
            <MenuBar />
          </Suspense>
          <Suspense fallback={<div>Loading feed</div>}>
            <Feed group={group} commentsFilter={comments} votesFilter={votes} />
          </Suspense>
        </div>

        <div className="hidden lg:flex">
          <Timeline />
        </div>
      </div>
    </div>
  );
}
