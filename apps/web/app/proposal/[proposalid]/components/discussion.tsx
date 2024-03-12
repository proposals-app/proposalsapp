import Image from "next/image";
import { unfurlUrl } from "../actions";
import Link from "next/link";

export default async function Discussion({ url }: { url: string }) {
  const unfurl = await unfurlUrl(url);

  if (unfurl)
    return (
      <div className="p-4 bg-[#121212] flex flex-col">
        <div
          className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start`}
        >
          Discussion
        </div>
        <Link
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col p-2 gap-2 border border-b-2 border-l-0 border-r-2 border-t-0 break-all"
        >
          <div className="flex flex-row gap-2">
            <Image
              src={unfurl.imageSrc}
              alt={unfurl.title}
              width={64}
              height={64}
            />
            <div suppressHydrationWarning className="text-white">
              {unfurl.title}
            </div>
          </div>

          <div suppressHydrationWarning className="text-white">
            {unfurl.description}
          </div>
          <div className="text-white">🌐 {url}</div>
        </Link>
      </div>
    );
}
