import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
}

export function BasicEvent({ content, timestamp, url }: BasicEventProps) {
  return (
    <div className="relative flex w-full items-center py-2">
      <div className="flex w-full items-center justify-between rounded-full border bg-white px-4 py-1">
        <div className="absolute left-3 top-5 h-[7px] w-[7px] rounded-full border border-white bg-gray-500" />
        <div className="ml-4 text-sm">{content}</div>
        <Link href={url} target="_blank">
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
