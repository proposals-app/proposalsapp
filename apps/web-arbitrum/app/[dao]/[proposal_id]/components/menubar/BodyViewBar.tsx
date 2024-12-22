import { ArrowDown, ArrowUp } from "lucide-react";

export const BodyViewBar = ({ onClick }: { onClick: () => void }) => (
  <div
    className="flex w-full cursor-pointer justify-between hover:underline"
    onClick={onClick}
  >
    <ArrowUp className="rounded-full border p-1" />
    <div className="flex flex-row items-center gap-2">
      <div className="px-2">Comments and Votes</div>
      <ArrowDown className="rounded-full border p-1" />
    </div>
  </div>
);
