import { Button } from "@/shadcn/ui/button";
import { Manjari } from "next/font/google";
import Link from "next/link";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

export const SettingsButton = () => {
  return (
    <Link
      className="text-[24px] leading-[32px] lg:leading-[46px]"
      href={"/settings"}
    >
      <Button
        className={`${manjari.className} block h-[42px] w-fit rounded-lg border-2 border-gold bg-luna text-center text-gold lg:h-[56px]`}
      >
        <p className="text-[24px] leading-[32px] lg:leading-[46px]">settings</p>
      </Button>
    </Link>
  );
};
