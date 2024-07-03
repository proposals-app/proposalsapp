import { Filters } from "./components/filters/filters";
import { ProposalsTable } from "./components/table/table";

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
      <Filters />
      <ProposalsTable searchParams={searchParams} />
    </div>
  );
}
