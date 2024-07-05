import Image from "next/legacy/image";
import Link from "next/link";
import { validateRequest } from "@/lib/auth";
import { Suspense } from "react";
import { SettingsButton } from "./settings-button";
import { SubscribeButton } from "./subscribe";
import { VerificationModal } from "../verification-modal";

export default async function NavBar() {
  let { user } = await validateRequest();

  return (
    <div className="flex w-full flex-col items-center justify-between gap-8 px-2 lg:flex-row">
      <Link
        href="/"
        className="py-auto flex h-[56px] flex-row items-center justify-center rounded-lg bg-dark px-[18px]"
      >
        <Image
          width={285}
          height={60}
          src="/assets/icons/web/logo-lettering.svg"
          alt={"proposals.app"}
        />
      </Link>

      <div className="flex w-full justify-center lg:w-fit">
        <Suspense>
          {!user && <SubscribeButton />}
          {user && <SettingsButton />}
          {user && user.email_verified == false && (
            <VerificationModal email={user.email} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
