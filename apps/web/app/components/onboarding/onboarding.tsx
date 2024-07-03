import { validateRequest } from "@/lib/auth";
import { Suspense } from "react";
import { OnboardingSubscriptionModal } from "./subscriptions";
import { OnboardingVoterModal } from "./voters";
import { getOnboardingStep } from "./actions";
import { getHotDaos } from "@/app/actions";

export default async function OnboardingFlow() {
  let { user } = await validateRequest();
  const step = await getOnboardingStep();
  const hotDaos = await getHotDaos();

  return (
    <Suspense>
      {user && step && step?.onboardingStep == 0 && (
        <OnboardingSubscriptionModal open={true} hotDaos={hotDaos} />
      )}
      {user && step && step?.onboardingStep == 1 && (
        <OnboardingVoterModal open={true} />
      )}
    </Suspense>
  );
}
