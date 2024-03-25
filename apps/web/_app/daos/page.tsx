import { getSubscriptions } from "./actions";
import SubscribedDAOs from "./components/subscribed/list";
import UnsubscribedDAOs from "./components/unsubscribed/list";

export default async function Home() {
  const { subscribed, unsubscribed } = await getSubscriptions();

  return (
    <main className="flex w-full flex-col">
      <SubscribedDAOs subscribed={subscribed} />
      <UnsubscribedDAOs unsubscribed={unsubscribed} />
    </main>
  );
}
