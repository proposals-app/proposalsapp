"use client";

import { Button } from "@/shadcn/ui/button";
import { Manjari } from "next/font/google";
import { useRouter } from "next/navigation";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

export const BackButton = () => {
  const router = useRouter();

  const handleBack = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <Button
      onClick={handleBack}
      className={`${manjari.className} block h-[42px] w-fit rounded-lg border-2 border-gold bg-luna text-center text-gold lg:h-[56px]`}
    >
      <span className="text-[24px] leading-[32px] lg:leading-[46px]">
        {"< back"}
      </span>
    </Button>
  );
};
