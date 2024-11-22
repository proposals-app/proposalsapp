"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { TimelineItem } from "./TimelineItem";
import { ProcessedTimelineItem } from "./types";
import { processTimelineData } from "./utils";

interface Props {
  initialData: {
    result: {
      dao: any;
      group: any;
    };
    groupDetails: any;
  };
}

export default function TimelineView({ initialData }: Props) {
  const [timelineItems, setTimelineItems] = useState<ProcessedTimelineItem[]>(
    [],
  );
  const timelineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = processTimelineData(
      initialData.result,
      initialData.groupDetails,
    );
    setTimelineItems(items);
  }, [initialData]);

  return (
    <Card className="mx-auto w-full">
      <CardHeader ref={headerRef}>
        <div className="flex items-center justify-between">
          <CardTitle>
            {initialData.result.group?.name || "Ungrouped Item"}
          </CardTitle>
          <Button asChild>
            <Link href="/">Back to Proposals</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent ref={contentRef}>
        <div className="space-y-6">
          {timelineItems.map((item, index) => (
            <div
              key={index}
              ref={(el) => {
                if (el) timelineRefs.current.set(index, el);
              }}
              className="timeline-card"
            >
              <TimelineItem item={item} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
