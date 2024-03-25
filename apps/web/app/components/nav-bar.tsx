import { Button } from "@/shadcn/ui/button";
import Image from "next/image";

export const NavBar = () => {
  return (
    <div className="w-full flex flex-row justify-between items-center">
      <div className="w-fit animate-logo-rotate">
        <Image
          className="w-20 h-20 border-4 border-white rounded-xl bg-foreground"
          width={64}
          height={64}
          src="/assets/icons/web/logo.svg"
          alt={"proposals.app"}
        />
      </div>

      <Button className="self-start">Sign In</Button>
    </div>
  );
};
