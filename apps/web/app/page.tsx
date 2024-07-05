import { Filters } from "./components/filters/filters";
import { ProposalsTable } from "./components/table/table";
import NavBar from "./components/header/header";
import { usePostHog } from "posthog-js/react";
import { validateRequest } from "@/lib/auth";
import { PostHogIdentifier } from "./components/posthog-identifier";

export default async function Home({
  searchParams,
}: {
  searchParams: {
    state: string;
    dao: string | string[];
  };
}) {
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <PostHogIdentifier />
      <NavBar />
      <div className="flex w-full flex-col items-center lg:px-2">
        <Filters />
      </div>
      <ProposalsTable searchParams={searchParams} />
    </div>
  );
}
