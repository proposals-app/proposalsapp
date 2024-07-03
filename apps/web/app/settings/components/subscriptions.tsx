"use client";

import { hotDaosType } from "@/app/actions";
import { CheckIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export const SubscriptionsSettings = ({
  hotDaos,
}: {
  hotDaos: hotDaosType;
}) => {
  const [selectedDaos, setSelectedDaos] = useState([
    ...hotDaos.map((d) => d.slug),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[24px] leading-[36px]">your favorite DAOs</p>
      <div className="grid w-full grid-flow-row grid-cols-4 gap-4 lg:grid-cols-12">
        {hotDaos.map((dao) => (
          <div
            className="relative h-[80px] w-[80px]"
            key={dao.id}
            onClick={() => {
              if (selectedDaos.includes(dao.slug)) {
                let filtered = selectedDaos.filter((d) => d != dao.slug);
                setSelectedDaos([...filtered]);
              } else {
                setSelectedDaos([...selectedDaos, dao.slug]);
              }
            }}
          >
            {selectedDaos.includes(dao.slug) && (
              <CheckIcon className="absolute -right-[8px] -top-[8px] h-[32px] w-[32px] rounded-full bg-green-500 text-white" />
            )}
            <Image
              className={`${selectedDaos.includes(dao.slug) ? "bg-dark" : "border-2 border-gold bg-luna"} rounded`}
              height={80}
              width={80}
              alt={dao.name}
              src={
                selectedDaos.includes(dao.slug)
                  ? `/assets/project-logos/hot/${dao.slug}_active.svg`
                  : `/assets/project-logos/hot/${dao.slug}_inactive.svg`
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};
