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
import { ResultsPanel } from "../results/ResultsPanel";

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
    <div className="min-h-screen w-full bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center px-4">
          <h1 className="text-xl font-semibold">
            {initialData.result.group?.name || "Ungrouped Item"}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1920px] px-4 py-6">
        <div className="flex gap-8">
          {/* Timeline Section - Takes 2/3 of the space */}
          <div className="w-2/3">
            <div ref={contentRef} className="relative space-y-4">
              {renderTimelineItems}
            </div>

            {/* Collapsed Cards */}
            {/* {collapsedCards.length > 0 && (
              <div className="fixed left-4 right-4 top-20 z-40 space-y-2 lg:left-[calc((100%-1920px)/2+1rem)]">
                {collapsedCards.map((card) => (
                  <button
                    key={card.id}
                    className="w-full rounded-lg border bg-white p-2 text-left shadow-md transition-colors hover:bg-gray-50"
                    onClick={() => handleCardClick(card.id)}
                  >
                    {card.title}
                  </button>
                ))}
              </div>
            )} */}
          </div>

          {/* Results Panel - Takes 1/3 of the space */}
          <div className="w-1/3">
            <ResultsPanel groupDetails={initialData.groupDetails} />
          </div>
        </div>
      </div>
    </div>
  );
}
