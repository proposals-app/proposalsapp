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
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <Filters />
      <ProposalsTable searchParams={searchParams} />
    </div>
  );
}
