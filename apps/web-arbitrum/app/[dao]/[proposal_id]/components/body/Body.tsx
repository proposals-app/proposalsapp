import { BodiesDataType } from "../../actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import BodyContent from "./BodyContent";
import { PostedTime } from "./BodyVersionChange";

export default async function Body({
  bodies,
  version,
}: {
  bodies: BodiesDataType;
  version: number;
}) {
  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  // Find the initial and latest bodies based on createdAt
  const initialBody = bodies[0];
  const latestBody = bodies[bodies.length - 1];
  const visibleBody = bodies[version];

  return (
    <div className="flex w-full justify-center bg-gray-100 p-4">
      <div className="flex w-3/4 flex-col gap-4">
        <div className="text-4xl font-bold">{visibleBody.title}</div>

        <div className="flex flex-col">
          <div className="flex flex-row justify-between">
            <AuthorInfo
              authorName={visibleBody.author_name}
              authorPicture={visibleBody.author_picture}
            />

            <div className="flex flex-row">
              <PostedTime
                label="initially posted"
                createdAt={initialBody.createdAt}
              />

              <PostedTime
                label="latest revision"
                createdAt={latestBody.createdAt}
                border
              />
            </div>
          </div>
        </div>

        <BodyContent content={visibleBody.content} />
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
