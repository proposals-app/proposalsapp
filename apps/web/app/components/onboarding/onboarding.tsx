import { getHotDaos, getOnboardingStep } from "@/app/actions";
import { validateRequest } from "@/lib/auth";
import { Suspense } from "react";
import { OnboardingSubscriptionModal } from "./subscriptions";
import { OnboardingVoterModal } from "./voters";

export default async function OnboardingFlow() {
  let { user } = await validateRequest();
  const step = await getOnboardingStep();
  const hotDaos = await getHotDaos();

  return (
    <Suspense>
      {user && step && step?.onboardingStep == 0 && (
        <OnboardingVoterModal open={true} />
      )}
      {user && step && step?.onboardingStep == 1 && (
        <OnboardingSubscriptionModal open={true} hotDaos={hotDaos} />
      )}
    </Suspense>
  );
}
