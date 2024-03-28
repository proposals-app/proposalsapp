import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";

type ProposalProps = {
  id: string;
  name: string;
  timeEnd: Date;
  daoPicture: string | null;
};

const poppins = Poppins({
  weight: "300",
  subsets: ["latin"],
});

const poppinsBold = Poppins({
  weight: "600",
  subsets: ["latin"],
});

moment.updateLocale("en", {
  relativeTime: {
    future: "open for %s",
    past: "closed %s ago",
    s: "a few seconds",
    ss: "%d seconds",
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    w: "a week",
    ww: "%d weeks",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },
});

const MAX_NAME_LENGTH = 120;

export const ProposalItem = ({ proposal }: { proposal: ProposalProps }) => {
  return (
    <Link
      className="h-24 w-full flex flex-row items-center hover:bg-accent bg-white rounded-lg p-2 gap-4"
      href={`/proposal/${proposal.id}`}
    >
      <div className="min-h-20 min-w-20">
        <Image
          className="rounded-md"
          height={80}
          width={80}
          src={`/${proposal.daoPicture}.svg`}
          alt={""}
        />
      </div>
      <div className={`w-full text-ellipsis text-lg ${poppins.className}`}>
        {proposal.name.length < MAX_NAME_LENGTH
          ? proposal.name
          : proposal.name.slice(0, MAX_NAME_LENGTH - 3) + "..."}
      </div>
      <div className="min-w-32 text-center">
        <div className={`${poppins.className}`}>
          {proposal.timeEnd.getTime() > new Date().getTime()
            ? "open for"
            : "closed"}
        </div>
        <div className={`${poppinsBold.className}`}>
          {moment(proposal.timeEnd).fromNow(true)}
          {proposal.timeEnd.getTime() > new Date().getTime() ? "" : " ago"}
        </div>
      </div>
    </Link>
  );
};
