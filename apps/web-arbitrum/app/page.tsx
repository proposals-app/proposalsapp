import { Filters } from "./components/filters/filters";
import { ProposalsTable } from "./components/table/table";
import NavBar from "./components/header/header";
import { PostHogIdentifier } from "./components/posthog-identifier";
import SendNotification from "./components/notification";

export default async function Home(props: {
  searchParams: Promise<{
    state: string;
    dao: string | string[];
  }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex w-full flex-col gap-12 px-4 pb-40 pt-14 lg:max-w-[1200px]">
      <div className="flex w-full flex-col items-center gap-8">
        <PostHogIdentifier />
        <NavBar />
        <div className="flex w-full flex-col items-center lg:px-2">
          <Filters />
        </div>

        <ProposalsTable searchParams={searchParams} />
      </div>
    </div>
  );
}
