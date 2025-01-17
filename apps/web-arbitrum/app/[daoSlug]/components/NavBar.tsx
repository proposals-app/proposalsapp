import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/shadcn/ui/avatar";
import { cn } from "@/shadcn/lib/utils";

interface NavBarProps {
  dao: {
    name: string;
    picture: string;
  };
  daoSlug: string;
}

export function NavBar({ daoSlug, dao }: NavBarProps) {
  return (
    <div className="fixed left-0 top-0 z-20 flex min-h-screen flex-col items-center bg-muted p-4">
      <Link href={`/${daoSlug}`}>
        <Avatar className="h-16 w-16 rounded-none">
          <AvatarImage src={`/${dao.picture}_large.png`} alt={dao.name} />
          <AvatarFallback>{dao.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </Link>
    </div>
  );
}
