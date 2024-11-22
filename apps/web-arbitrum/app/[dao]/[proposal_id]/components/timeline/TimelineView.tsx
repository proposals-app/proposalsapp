"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { TimelineItem } from "./TimelineItem";
import {
  DiscussionContent,
  ProcessedTimelineItem,
  ProposalContent,
} from "./types";
import { processTimelineData } from "./utils";

interface CollapsibleCard {
  id: number;
  title: string;
  timestamp: Date;
}

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
  const [collapsedCards, setCollapsedCards] = useState<CollapsibleCard[]>([]);
  const timelineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = processTimelineData(
      initialData.result,
      initialData.groupDetails,
    );
    setTimelineItems(items);
  }, [initialData]);

  const isElementInViewport = useCallback((el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom >= 0
    );
  }, []);

  const getTitleForItemType = useCallback(
    (item: ProcessedTimelineItem): string => {
      if (item.type === "proposal") {
        return (item.content as ProposalContent).name;
      } else if (item.type === "discussion") {
        return (
          (item.content as DiscussionContent).topicTitle ||
          (item.content as DiscussionContent).title ||
          "Discussion"
        );
      }
      return "";
    },
    [],
  );

  // Memoize the function to calculate collapsed cards
  const calculateCollapsedCards = useCallback(
    (items: ProcessedTimelineItem[]) => {
      let lastVisibleItemIndex = -1;

      for (let i = items.length - 1; i > lastVisibleItemIndex; i--) {
        const itemRef = timelineRefs.current.get(i);
        if (itemRef && isElementInViewport(itemRef)) {
          lastVisibleItemIndex = i;
          break;
        }
      }

      const newCollapsedCards: CollapsibleCard[] = [];
      for (let i = 0; i < lastVisibleItemIndex; i++) {
        const item = items[i];
        if (item.type === "proposal" || item.type === "discussion") {
          newCollapsedCards.push({
            id: i,
            title: getTitleForItemType(item),
            timestamp: item.timestamp,
          });
        }
      }

      return newCollapsedCards;
    },
    [isElementInViewport, getTitleForItemType],
  );

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      // Calculate collapsed cards only when needed
      setCollapsedCards(calculateCollapsedCards(timelineItems));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [timelineItems, calculateCollapsedCards]);

  const handleCardClick = useCallback((id: number) => {
    const ref = timelineRefs.current.get(id);
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Use useMemo to memoize the list of items rendered
  const renderTimelineItems = useMemo(() => {
    return timelineItems.map((item, index) => (
      <div
        key={index}
        ref={(el) => {
          if (el) timelineRefs.current.set(index, el);
        }}
        className="timeline-card"
      >
        <TimelineItem item={item} />
      </div>
    ));
  }, [timelineItems]);

  return (
    <div className="mx-auto w-full">
      <CardHeader>
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
        <div className="relative space-y-6">{renderTimelineItems}</div>
      </CardContent>

      {collapsedCards.length > 0 && (
        <div className="fixed left-4 right-4 top-16 z-50 space-y-2">
          {collapsedCards.map((card) => (
            <button
              key={card.id}
              className="w-full rounded-lg border bg-white p-2 text-left shadow-md"
              onClick={() => handleCardClick(card.id)}
            >
              {card.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
