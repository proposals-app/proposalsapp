import { ArrowDown, ArrowUp } from "lucide-react";

export const CommentsViewBar = ({ onClick }: { onClick: () => void }) => (
  <div className="flex w-full justify-between">
    <div className="flex flex-row items-center gap-2">
      <ArrowUp className="rounded-full border p-1" />
      <div className="px-2 hover:underline" onClick={onClick}>
        Read Full Proposal
      </div>
    </div>
    <div className="flex gap-2">
      <div>filter</div>
      <div>filter</div>
    </div>
  </div>
);
