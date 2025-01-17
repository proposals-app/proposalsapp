import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { ArrowLeft } from "lucide-react";

interface ResultsHeaderProps {
  authorName: string;
  authorPicture: string;
  proposalName: string;
  daoSlug: string;
  itemId: string;
}

export function Header({
  authorName,
  authorPicture,
  proposalName,
  daoSlug,
  itemId,
}: ResultsHeaderProps) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 ml-24 flex h-20 items-center gap-4 bg-background px-6 shadow-md">
      <Link
        href={`/${daoSlug}/${itemId}`}
        className="flex items-center gap-2 rounded-full bg-muted px-3 py-2"
        prefetch={true}
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Back</span>
      </Link>

      <div className="flex items-center gap-2">
        <Avatar className="h-10 w-10">
          <AvatarImage src={authorPicture} alt={authorName} />
          <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <h1 className="text-lg font-bold">{proposalName}</h1>
      </div>
    </div>
  );
}
