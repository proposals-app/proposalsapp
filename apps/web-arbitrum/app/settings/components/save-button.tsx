import { Button } from "@/shadcn/ui/button";
import { Manjari } from "next/font/google";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

export const SaveButton = ({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) => {
  return (
    <Button
      disabled={disabled}
      className={`${manjari.className} block h-[42px] w-fit rounded-lg border-2 border-gold bg-luna text-center text-gold lg:h-[56px]`}
      onClick={onClick}
    >
      <p className="text-[24px] leading-[32px] lg:leading-[46px]">
        save settings
      </p>
    </Button>
  );
};
