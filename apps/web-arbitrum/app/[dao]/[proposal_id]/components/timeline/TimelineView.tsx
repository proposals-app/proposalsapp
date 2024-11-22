"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
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
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = processTimelineData(
      initialData.result,
      initialData.groupDetails,
    );
    setTimelineItems(items);
  }, [initialData]);

  useEffect(() => {
    let lastVisibleItemIndex = -1;

    function handleScroll() {
      if (!contentRef.current) return;

      for (let i = timelineItems.length - 1; i > lastVisibleItemIndex; i--) {
        const itemRef = timelineRefs.current.get(i);
        if (itemRef && isElementInViewport(itemRef)) {
          lastVisibleItemIndex = i;
          break;
        }
      }

      const newCollapsedCards: CollapsibleCard[] = [];
      for (let i = 0; i < lastVisibleItemIndex; i++) {
        const item = timelineItems[i];
        if (item.type === "proposal" || item.type === "discussion") {
          newCollapsedCards.push({
            id: i,
            title: getTitleForItemType(item),
            timestamp: item.timestamp,
          });
        }
      }

      setCollapsedCards(newCollapsedCards);
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [timelineItems, timelineRefs]);

  const isElementInViewport = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom >= 0
    );
  };

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

  const handleCardClick = (id: number) => {
    const ref = timelineRefs.current.get(id);
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto w-full">
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
        <div className="relative space-y-6">
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

      {collapsedCards.length > 0 && (
        <div className="fixed left-4 right-4 top-16 z-50 space-y-2">
          {collapsedCards.map((card) => (
            <button
              key={card.id}
              className="animate-slide-in w-full rounded-lg border bg-white p-2 text-left shadow-md"
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

// CSS animations
const slideInAnimation = `
@keyframes slide-in {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
`;

// Inject the CSS animations into the document
const styleSheet = document.styleSheets[document.styleSheets.length - 1];
if (styleSheet && "insertRule" in styleSheet) {
  (styleSheet as any).insertRule(slideInAnimation, styleSheet.cssRules.length);
}
