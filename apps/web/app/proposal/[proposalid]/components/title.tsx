"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Title({
  title,
  daoImage,
}: {
  title: string;
  daoImage: string;
}) {
  const router = useRouter();
  return (
    <div
      data-testid="header"
      className={`flex gap-4 h-[96px] w-full items-center justify-start border border-x-0 border-t-0 border-[#545454] bg-black px-4 transition-all lg:px-10`}
    >
      <div
        className="cursor-pointer"
        onClick={() => {
          router.back();
        }}
      >
        <svg
          width="48px"
          height="48px"
          viewBox="0 0 1024 1024"
          fill="#FFFFFF"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-0.8 88.8l309.6 280z"
            fill=""
          />
        </svg>
      </div>
      <div className="border border-b-2 border-l-0 border-r-2 border-t-0">
        <Image
          className="duration-500 transition-all"
          loading="eager"
          priority={true}
          width={48}
          height={48}
          src={`${daoImage}.svg`}
          alt={title ?? "Unknown"}
        />
      </div>
      <div
        className={`max-h-[80%] font-extrabold text-white transition w-full text-left lg:text-start truncate text-ellipsis`}
      >
        {title}
      </div>
    </div>
  );
}
