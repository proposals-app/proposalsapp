"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { fetchItems, type fetchItemsType } from "../../actions";
import Item from "./item";

type ItemsProps = {
  searchParams?: { from: string; voted: string; proxy: string };
};

export function LoadMore({ searchParams }: ItemsProps) {
  const [items, setItems] = useState<fetchItemsType["proposals"]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const { ref, inView } = useInView();

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const loadMoreItems = async () => {
    await delay(1000);
    const nextPage = page + 1;
    const { proposals } = await fetchItems(
      false,
      nextPage,
      searchParams?.from ?? "any",
      searchParams?.voted ?? "any",
      searchParams?.proxy ?? "any",
    );

    if (proposals.length == 0) setHasMore(false);
    setItems((prevProducts) => [...prevProducts, ...proposals]);
    setPage(nextPage);
  };

  useEffect(() => {
    if (inView) {
      loadMoreItems();
    }
  }, [inView]);

  return (
    <>
      <ul>
        {items.map((item, index) => (
          <li className="pb-1" key={index}>
            <Item item={item} />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div
          className="text-white flex justify-center items-center p-4 col-span-1 sm:col-span-2 md:col-span-3"
          ref={ref}
        >
          Loading more
        </div>
      ) : (
        <div
          className="text-white flex justify-center items-center p-4 col-span-1 sm:col-span-2 md:col-span-3"
          ref={ref}
        >
          You reached the end
        </div>
      )}
    </>
  );
}
