import { Skeleton } from "@/shadcn/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex w-full items-center justify-center p-6">
      <Skeleton className="h-10 w-1/2" />
    </div>
  );
}
