import { Skeleton } from "@/shadcn/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <div className="fixed left-0 right-0 top-0 z-50 ml-20 flex h-20 items-center gap-4 bg-white px-6 shadow-md">
        <Link
          href={`/`}
          className="flex items-center gap-2 rounded-full bg-gray-300 px-3 py-2"
          prefetch={true}
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Loading Circle for Avatar */}
          <Skeleton className="h-10 w-10 rounded-full" />

          {/* Loading Bar for Proposal Name */}
          <Skeleton className="h-6 w-48 rounded-md" />
        </div>
      </div>
      loading [dao_slug]/[item_id]/results/[result_number]
    </div>
  );
}
