import { getProxies, getSubscribedDAOs } from "../actions";
import { Filters } from "./components/filters";
import { validateRequest } from "../../../server/auth";
import ItemsTable from "../past/components/items-table";

export default async function Home({
  searchParams,
}: {
  searchParams: { from: string; voted: string; proxy: string };
}) {
  const subscribedDAOs = await getSubscribedDAOs();
  const proxies = await getProxies();
  const { user } = await validateRequest();

  const subscripions = subscribedDAOs.map((entry) => {
    return { id: entry.id, name: entry.name };
  });

  return (
    <div className="min-h-screen gap-2">
      <Filters
        isConnected={user ? true : false}
        subscriptions={subscripions}
        proxies={proxies}
      />

      {searchParams.from && searchParams.proxy && searchParams.voted && (
        <ItemsTable searchParams={searchParams} />
      )}
    </div>
  );
}
