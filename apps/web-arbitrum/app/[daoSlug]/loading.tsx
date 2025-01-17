import { Skeleton } from "@/shadcn/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex w-full items-center justify-center p-6">
      <Skeleton className="h-12 w-12 rounded-full" />
    </div>
  );
}
