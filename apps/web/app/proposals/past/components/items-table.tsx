import Image from "next/image";
import { Suspense } from "react";
import { fetchItems } from "../../actions";
import Item from "./item";
import { LoadMore } from "./load-more";

type ItemsProps = {
  from: string;
  voted: string;
  proxy: string;
};

export default async function ItemsTable(searchParams: ItemsProps) {
  let { proposals } = await fetchItems(
    false,
    0,
    searchParams?.from ?? "all",
    searchParams?.voted ?? "any",
    searchParams?.proxy ?? "any",
  );

  return (
    <Suspense>
      <div className="pt-4">
        <div className="hidden h-[56px] flex-row items-center justify-between bg-black text-white lg:flex">
          <div className="flex flex-row items-center">
            <div className="w-[240px] items-center pl-[16px]">
              <div className="flex gap-1">
                <div>DAO</div>
              </div>
            </div>
            <div className="items-center">
              <div className="flex gap-1">
                <div>Proposal Title</div>
              </div>
            </div>
          </div>
          <div className="flex flex-row items-center">
            <div className="w-[340px] items-center font-normal">
              <div className="flex gap-1">
                <div>Ended on</div>
                <Image
                  loading="eager"
                  priority={true}
                  width={24}
                  height={24}
                  src={"/assets/icons/web/sort-discending.svg"}
                  alt="ends-in"
                />
              </div>
            </div>
            <div className=" w-[200px] items-center text-center font-normal">
              <div className="flex justify-center gap-1">
                <div>Vote status</div>
              </div>
            </div>
          </div>
        </div>

        <ul className="pt-1">
          {proposals.map((item, index) => (
            <li className="pb-1" key={index}>
              <Item item={item} />
            </li>
          ))}
        </ul>
        <LoadMore searchParams={searchParams} />
      </div>
    </Suspense>
  );
}
