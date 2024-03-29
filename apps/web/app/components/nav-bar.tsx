import Image from "next/image";
import { SignInButton } from "./auth/sign-in";
import { SignOutButton } from "./auth/sign-out";
import Link from "next/link";
import { OnboardingVoterModal } from "./onboarding/voters";
import { getHotDaos, getSubscripions, getVoters } from "../actions";
import { validateRequest } from "@/lib/auth";
import { OnboardingSubscriptionModal } from "./onboarding/subscriptions";
import { Suspense } from "react";

export default async function NavBar() {
  let { user } = await validateRequest();
  const userVoters = await getVoters();
  const subscriptions = await getSubscripions();
  const hotDaos = await getHotDaos();

  return (
    <div className="w-full flex flex-col gap-8 lg:flex-row lg:gap-0 justify-between items-center px-2">
      <Link
        href="/"
        className="hover:animate-logo-straight animate-logo-skew flex flex-row items-center justify-center rounded-lg bg-dark h-[56px] px-[18px] py-auto lg:h-14 lg:p-5"
      >
        <Image
          className="pointer-events-none"
          width={285}
          height={60}
          src="/assets/icons/web/logo-lettering.svg"
          alt={"proposals.app"}
        />
      </Link>

      <div className="w-full flex justify-center lg:justify-end">
        <Suspense>
          {!user && <SignInButton />}
          {user && user.email_verified && <SignOutButton />}
          {user && user.email_verified && userVoters && (
            <OnboardingVoterModal open={!userVoters.length} />
          )}
          {user &&
            user.email_verified &&
            userVoters &&
            userVoters.length &&
            subscriptions &&
            hotDaos && (
              <OnboardingSubscriptionModal
                open={!subscriptions.length}
                hotDaos={hotDaos}
              />
            )}
        </Suspense>
      </div>
    </div>
  );
}
