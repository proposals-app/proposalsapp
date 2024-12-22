import { getBodiesForGroup, GroupType } from "../../actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import BodyContent from "./BodyContent";
import { PostedTime } from "./PostedTime";
import { StickyHeader } from "./StickyHeader";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function Body({
  group,
  version,
  diff,
  expanded,
}: {
  group: GroupType;
  version: number;
  diff: boolean;
  expanded: boolean;
}) {
  if (!group) {
    notFound();
  }
  const bodies = await getBodiesForGroup(group.group.id);

  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  // Find the initial and latest bodies based on createdAt
  const initialBody = bodies[0];
  const latestBody = bodies[bodies.length - 1];
  const visibleBody = bodies[version];

  const defaultVersion = bodies ? bodies.length - 1 : 0;

  return (
    <div className="flex w-full justify-center bg-gray-100 p-4">
      <Suspense>
        <StickyHeader
          bodies={bodies}
          group={group}
          version={version ?? defaultVersion}
        />
      </Suspense>
      <div className="flex w-full flex-col gap-4">
        <div className="text-4xl font-bold">{visibleBody.title}</div>

        <div className="flex flex-col">
          <div className="flex flex-row justify-between">
            <AuthorInfo
              authorName={visibleBody.author_name}
              authorPicture={visibleBody.author_picture}
            />

            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-row">
                {/* <VersionChange
                  toVersion={version - 1}
                  dir="dec"
                  disabled={version - 1 < 0}
                /> */}
                <PostedTime
                  label="initially posted"
                  createdAt={initialBody.createdAt}
                />

                <PostedTime
                  label="latest revision"
                  createdAt={latestBody.createdAt}
                  border
                />
                {/* <VersionChange
                  toVersion={version + 1}
                  dir="inc"
                  disabled={version + 1 > bodies.length - 1}
                /> */}
              </div>
              {/* <VersionDiff /> */}
            </div>
          </div>
        </div>

        <BodyContent
          content={visibleBody.content}
          allBodies={bodies.map((b) => b.content)}
          version={version}
          diff={diff}
          expanded={expanded}
        />
      </div>
    </div>
  );
}

const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className="flex flex-row items-center gap-2">
    <Avatar className="bg-gray-500">
      <AvatarImage src={authorPicture} />
      <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
    </Avatar>
    <div className="font-bold">{authorName}</div>
  </div>
);
