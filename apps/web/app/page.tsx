import { Filters } from "./components/filters/filters";
import { ProposalsTable } from "./components/table/table";
import NavBar from "./components/header/header";

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
      <NavBar />
      <div className="flex w-full flex-col items-center lg:px-2">
        <Filters />
      </div>
      <ProposalsTable searchParams={searchParams} />
    </div>
  );
}
