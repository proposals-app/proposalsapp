import { Suspense } from "react";
import { validateRequest } from "@/lib/auth";
import { getHotDaos, getSubscripions, getVoters } from "@/app/actions";
import { OnboardingVoterModal } from "./voters";
import { OnboardingSubscriptionModal } from "./subscriptions";

export default async function OnboardingFlow() {
  let { user } = await validateRequest();
  const userVoters = await getVoters();
  const subscriptions = await getSubscripions();
  const hotDaos = await getHotDaos();

  return (
    <Suspense>
      {user && user.email_verified && userVoters && (
        <OnboardingVoterModal open={true} />
      )}
      {user &&
        user.email_verified &&
        userVoters &&
        userVoters.length &&
        subscriptions &&
        hotDaos && (
          <OnboardingSubscriptionModal open={false} hotDaos={hotDaos} />
        )}
    </Suspense>
  );
}
