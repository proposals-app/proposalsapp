import Link from "next/link";

export default async function GovernancePortal({ url }: { url: string }) {
  return (
    <div className="p-4 bg-[#121212] flex flex-col">
      <div
        className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start pb-2`}
      >
        Governance Portal
      </div>
      <Link
        href={url}
        target="_blank"
        suppressHydrationWarning
        className="flex flex-col p-2 gap-2 border border-b-2 border-l-0 border-r-2 border-t-0 break-all text-white whitespace-pre-line overflow-y-scroll"
      >
        {url}
      </Link>
    </div>
  );
}
