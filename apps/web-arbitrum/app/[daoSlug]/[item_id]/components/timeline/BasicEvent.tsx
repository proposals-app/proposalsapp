import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
}

export function BasicEvent({ content, timestamp, url }: BasicEventProps) {
  return (
    <div className="flex w-full items-center justify-between rounded-full border bg-white px-2 py-1">
      <div className="text-sm">{content}</div>
      <Link href={url} target="_blank">
        <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
