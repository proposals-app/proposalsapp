import { Skeleton } from "@/shadcn/ui/skeleton";
import { cn } from "@/shadcn/lib/utils";

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex">
        <div className="fixed left-0 top-0 z-20 flex min-h-screen flex-col items-center bg-gray-300 p-2">
          <Skeleton
            className={cn("aspect-square w-16 rounded-sm", "bg-gray-400")}
          />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex w-full justify-between lg:pl-20">
        <div className="mx-auto flex w-[90%] flex-col justify-center md:w-3/4 lg:w-1/2">
          {/* Body Skeleton */}
          <div className="flex w-full justify-center bg-gray-100 p-4">
            <div className="flex w-full flex-col gap-6">
              {/* Title Skeleton */}
              <Skeleton
                className={cn("h-12 w-3/4 rounded-lg", "bg-gray-300")}
              />

              {/* Author and Posted Time Skeleton */}
              <div className="flex flex-row justify-between">
                <div className="flex flex-row items-center gap-2">
                  <Skeleton
                    className={cn("h-10 w-10 rounded-full", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-4 w-24 rounded-md", "bg-gray-300")}
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Skeleton
                    className={cn("h-4 w-32 rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-4 w-32 rounded-md", "bg-gray-300")}
                  />
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="space-y-3">
                <Skeleton
                  className={cn("h-4 w-full rounded-md", "bg-gray-300")}
                />
                <Skeleton
                  className={cn("h-4 w-5/6 rounded-md", "bg-gray-300")}
                />
                <Skeleton
                  className={cn("h-4 w-4/6 rounded-md", "bg-gray-300")}
                />
                <Skeleton
                  className={cn("h-4 w-3/6 rounded-md", "bg-gray-300")}
                />
                <Skeleton
                  className={cn("h-4 w-2/6 rounded-md", "bg-gray-300")}
                />
              </div>
            </div>
          </div>

          {/* Menu Bar Skeleton */}
          <div className="fixed bottom-0 z-50 flex w-full max-w-[90%] justify-center self-center px-4 pb-4 md:max-w-[75%] lg:max-w-[48%]">
            <div
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg",
                "bg-gray-200",
              )}
            >
              <div className="flex w-full justify-between">
                {/* Left Side: Show Changes */}
                <div className="flex items-center gap-4">
                  <Skeleton
                    className={cn("h-8 w-8 rounded-full", "bg-gray-300")}
                  />
                  <div className="flex items-center gap-2">
                    <Skeleton
                      className={cn("h-6 w-6 rounded-full", "bg-gray-300")}
                    />
                    <Skeleton
                      className={cn("h-4 w-24 rounded-md", "bg-gray-300")}
                    />
                  </div>
                </div>

                {/* Middle: Version Pagination */}
                <div className="flex items-center gap-2">
                  <Skeleton
                    className={cn("h-8 w-8 rounded-full", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-8 w-32 rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-8 w-8 rounded-full", "bg-gray-300")}
                  />
                </div>

                {/* Right Side: Comments and Votes */}
                <div className="flex items-center gap-4">
                  <Skeleton
                    className={cn("h-8 w-24 rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-8 w-8 rounded-full", "bg-gray-300")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Feed Skeleton */}
          <div className="flex w-full flex-col items-center divide-y">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex w-full flex-col p-4">
                {/* Author Info Skeleton */}
                <div className="flex flex-row justify-between">
                  <div className="flex flex-row items-center gap-2">
                    <Skeleton
                      className={cn("h-10 w-10 rounded-full", "bg-gray-300")}
                    />
                    <Skeleton
                      className={cn("h-4 w-24 rounded-md", "bg-gray-300")}
                    />
                  </div>
                  <Skeleton
                    className={cn("h-4 w-32 rounded-md", "bg-gray-300")}
                  />
                </div>

                {/* Content Skeleton */}
                <div className="mt-4 space-y-3">
                  <Skeleton
                    className={cn("h-4 w-full rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-4 w-5/6 rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-4 w-4/6 rounded-md", "bg-gray-300")}
                  />
                  <Skeleton
                    className={cn("h-4 w-3/6 rounded-md", "bg-gray-300")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Skeleton */}
        <div className="hidden lg:flex">
          <Skeleton className={cn("min-h-screen min-w-80", "bg-gray-300")} />
        </div>
      </div>
    </div>
  );
}
