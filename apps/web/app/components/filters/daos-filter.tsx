"use client";

import { hotDaosType } from "@/app/actions";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export const DaosFilter = ({ hotDaos }: { hotDaos: hotDaosType }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedDaos = new URLSearchParams(searchParams.toString()).getAll(
    "dao",
  );
  const [hoveredDao, setHoveredDao] = useState<string | null>(null);

  useEffect(() => {
    const allHotDaosSelected = hotDaos.every((dao) =>
      selectedDaos.includes(dao.slug),
    );

    const params = new URLSearchParams(searchParams.toString());

    if (allHotDaosSelected) {
      params.delete("dao");
      router.push("?" + params.toString());
    }
  }, []);

  const toggleDaoQuery = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const existingValues = params.getAll(name);

      if (existingValues.includes(value)) {
        params.delete(name);
        existingValues
          .filter((v) => v !== value)
          .forEach((v) => params.append(name, v));
      } else {
        params.append(name, value);
      }

      return params.toString();
    },
    [searchParams],
  );

  return (
    <div className="grid max-w-fit grid-cols-6 items-center justify-center gap-3">
      {hotDaos.map((dao) => (
        <div
          className="h-[56px] w-[56px]"
          key={dao.id}
          onClick={() => {
            setHoveredDao(null);
            router.push("?" + toggleDaoQuery("dao", dao.slug));
          }}
          onMouseEnter={() => setHoveredDao(dao.slug)}
          onTouchStart={() => setHoveredDao(dao.slug)}
          onMouseLeave={() => setHoveredDao(null)}
          onTouchMove={() => setHoveredDao(null)}
        >
          <Image
            className={`${selectedDaos.includes(dao.slug) ? "bg-dark" : "border-2 border-gold bg-luna"} h-[56px] w-[56px] rounded-lg`}
            height={24}
            width={24}
            src={
              hoveredDao === dao.slug
                ? `/assets/project-logos/hot/${dao.slug}_hover.svg`
                : selectedDaos.includes(dao.slug)
                  ? `/assets/project-logos/hot/${dao.slug}_active.svg`
                  : `/assets/project-logos/hot/${dao.slug}_inactive.svg`
            }
            alt={dao.name}
          />
        </div>
      ))}
    </div>
  );
};
