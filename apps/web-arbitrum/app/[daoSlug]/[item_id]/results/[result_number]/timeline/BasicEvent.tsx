import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
}

export function BasicEvent({ content, timestamp, url }: BasicEventProps) {
  return (
    <div className="relative mr-4 flex h-8 w-full items-center py-2"></div>
  );
}
