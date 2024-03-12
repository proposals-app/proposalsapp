"use client";

import { usePathname, useRouter } from 'next/navigation'
import { useState } from "react";

const tabs: { id: number; name: string; link: string }[] = [
  {
    id: 0,
    name: "Active Proposals",
    link: "/proposals/active",
  },
  {
    id: 1,
    name: "Past Proposals",
    link: "/proposals/past",
  },
];

export default function Tabs() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTabId, setActiveTabId] = useState(
    tabs.find((tab) => pathname?.includes(tab.link))?.id || 0,
  );

  const handleTabClick = (id: number, link: string) => {
    setActiveTabId(id);
    router.push(link);
  };

  return (
    <div className="flex w-full flex-row gap-10 overflow-x-auto overflow-y-hidden leading-[36px]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`${
              isActive
                ? "text-white text-[36px] font-bold cursor-pointer"
                : "text-[#808080] text-[36px] font-light cursor-pointer hover:text-[#8c8c8c]"
            }`}
            onClick={() => handleTabClick(tab.id, tab.link)}
          >
            {tab.name}
          </div>
        );
      })}
    </div>
  );
}
