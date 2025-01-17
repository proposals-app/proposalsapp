"use client";

import { notFound } from "next/navigation";
import { BodiesDataType, GroupWithDataType } from "../../actions";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { Card } from "@/shadcn/ui/card";

interface StickyHeaderProps {
  bodies: BodiesDataType;
  group: GroupWithDataType;
  version: number;
}

export function StickyHeader({ bodies, group, version }: StickyHeaderProps) {
  if (!group || !bodies) {
    notFound();
  }

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const title = bodies[version].title;
  const authorPicture = bodies[version].author_picture;
  const authorName = bodies[version].author_name;

  return (
    <Card
      className={`fixed left-0 right-0 top-0 z-10 h-20 bg-background shadow-md transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex h-full w-full items-center px-6 lg:px-24">
        <div className="flex flex-row items-center gap-4 md:pl-10 lg:pl-20">
          <Avatar className="h-10 w-10">
            <AvatarImage src={authorPicture} />
            <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </div>
    </Card>
  );
}
