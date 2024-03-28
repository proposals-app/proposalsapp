import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { useSession } from "../session-provider";
import { Avatar, AvatarFallback } from "@/shadcn/ui/avatar";
import { Button } from "@/shadcn/ui/button";
import { useRouter } from "next/navigation";

export const Profile = () => {
  const { user } = useSession();
  const router = useRouter();

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Avatar>
          <AvatarFallback className="cursor-default">
            {user?.email.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="w-full flex flex-row justify-end">
          <Button
            onClick={() => {
              signOut().then(() => router.refresh());
            }}
          >
            Sign Out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
