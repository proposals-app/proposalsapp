"use client";

import { hotDaosType } from "@/app/actions";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export const DaosFilter = ({ hotDaos }: { hotDaos: hotDaosType }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedDaos = searchParams.getAll("dao");
  const [hoveredDao, setHoveredDao] = useState<string | null>(null);

  useEffect(() => {
    const allHotDaosSelected = hotDaos.every((dao) =>
      selectedDaos.includes(dao.slug),
    );

    if (allHotDaosSelected) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("dao");
      router.push("?" + params.toString());
    }
  }, [hotDaos, selectedDaos, searchParams, router]);

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
    <div className="grid w-full grid-cols-6 items-center justify-center gap-3 lg:grid-cols-12">
      {hotDaos.map((dao) => {
        const isSelected = selectedDaos.includes(dao.slug);
        const isHovered = hoveredDao === dao.slug;
        const imgSrc = isHovered
          ? `/assets/project-logos/hot/${dao.slug}_hover.svg`
          : isSelected
            ? `/assets/project-logos/hot/${dao.slug}_active.svg`
            : `/assets/project-logos/hot/${dao.slug}_inactive.svg`;

        return (
          <div
            className="relative aspect-square max-h-[56px] w-full max-w-[56px] lg:max-h-[86px] lg:max-w-[86px]"
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
              className={`rounded-lg ${
                isSelected ? "bg-dark" : "border-2 border-gold bg-luna"
              }`}
              src={imgSrc}
              alt={dao.name}
              layout="fill"
              objectFit="contain"
            />
          </div>
        );
      })}
    </div>
  );
};
