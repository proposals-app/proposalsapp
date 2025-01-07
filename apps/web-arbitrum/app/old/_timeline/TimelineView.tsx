import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { TimelineItem } from "./TimelineItem";
import {
  DiscussionContent,
  ProcessedTimelineItem,
  ProposalContent,
} from "./types";
import { processTimelineData } from "./utils";
import { notFound } from "next/navigation";
import { GroupWithDataType } from "../../[daoSlug]/[item_id]/actions";

interface CollapsibleCard {
  id: number;
  title: string;
  timestamp: Date;
}

interface DetailsBarProps {
  groupData: GroupWithDataType | null;
}

export default function TimelineView({ groupData }: DetailsBarProps) {
  if (!groupData) {
    notFound();
  }

  const [timelineItems, setTimelineItems] = useState<ProcessedTimelineItem[]>(
    [],
  );
  const [collapsedCards, setCollapsedCards] = useState<CollapsibleCard[]>([]);
  const timelineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = processTimelineData(groupData.proposals, groupData.topics);
    setTimelineItems(items);
  }, [groupData]);

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
      <div className="sticky top-0 z-50 w-full border-b bg-white">
        <div className="mx-auto w-full max-w-[1920px]">
          {/* Main Header */}
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-semibold">
              {groupData.group?.name || "Ungrouped Item"}
            </h1>
          </div>

          {/* Collapsed Cards Section */}
          {collapsedCards.length > 0 && (
            <div className="flex flex-col flex-wrap gap-2 border-t bg-gray-50 px-4 py-2">
              {collapsedCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  {card.title}
                </button>
              ))}
            </div>
          )}
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
          </div>

          {/* Results Panel - Takes 1/3 of the space */}
          {/* <div className="w-1/3">
            <ResultsPanel proposals={groupData.proposals} />
          </div> */}
        </div>
      </div>
    </div>
  );
}
