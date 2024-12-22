import { ArrowDown } from "lucide-react";

export const FullViewBar = ({ onClick }: { onClick: () => void }) => (
  <div
    className="flex w-full justify-between hover:underline"
    onClick={onClick}
  >
    <div className="flex items-center">
      <ArrowDown className="rounded-full border p-1" />
      <div className="px-2">Read Full Proposal</div>
    </div>
  </div>
);
