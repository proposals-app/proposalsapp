import Image from "next/image";
import { SubscribeButton } from "./auth/subscribe";
import Link from "next/link";
import { validateRequest } from "@/lib/auth";
import { Suspense } from "react";

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
        <Suspense>{!user && <SubscribeButton />}</Suspense>
      </div>
    </div>
  );
}
