import Image from "next/image";
import { SignInButton } from "./auth/sign-in";
import { Profile } from "./auth/profile";
import Link from "next/link";
import { OnboardingVoterModal } from "./onboarding/voters";
import { getSubscripions, getVoters } from "../actions";
import { validateRequest } from "@/lib/auth";
import { OnboardingSubscriptionModal } from "./onboarding/subscriptions";

export default async function NavBar() {
  let { user } = await validateRequest();
  const userVoters = await getVoters();
  const userSubscriptions = await getSubscripions();

  return (
    <div className="w-full flex flex-col gap-8 lg:flex-row lg:gap-0 justify-between items-center">
      <Link
        href="/"
        className="animate-logo-rotate flex flex-row items-center justify-center rounded-xl bg-dark h-full lg:h-14"
      >
        <Image
          width={285}
          height={60}
          src="/assets/icons/web/logo-lettering.svg"
          alt={"proposals.app"}
        />
      </Link>

      <div className="w-full flex justify-end">
        {!user && <SignInButton />}
        {user && user.email_verified && <Profile />}
        {user && user.email_verified && userVoters && (
          <OnboardingVoterModal open={!userVoters.length} />
        )}
        {user && user.email_verified && userSubscriptions && (
          <OnboardingSubscriptionModal open={!userSubscriptions.length} />
        )}
      </div>
    </div>
  );
}
