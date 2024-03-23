import { getProxies, getSubscribedDAOs } from "../../actions";
import { Filters } from "./../components/filters";
import { validateRequest } from "../../../../server/auth";
import ItemsTable from "../../active/components/items-table";

export default async function Home({
  params,
  searchParams,
}: {
  params: { dao: string };
  searchParams: { voted: string; proxy: string };
}) {
  const subscribedDAOs = await getSubscribedDAOs();
  const proxies = await getProxies();
  const { user } = await validateRequest();

  const subscriptions = subscribedDAOs.map((entry) => {
    return { id: entry.id, name: entry.name };
  });

  return (
    <div className="min-h-screen gap-2">
      <Filters
        selectedFrom={params.dao}
        isConnected={user ? true : false}
        subscriptions={subscriptions}
        proxies={proxies}
      />

      {params.dao && searchParams.proxy && searchParams.voted && (
        <ItemsTable
          from={params.dao}
          proxy={searchParams.proxy}
          voted={searchParams.voted}
        />
      )}
    </div>
  );
}
