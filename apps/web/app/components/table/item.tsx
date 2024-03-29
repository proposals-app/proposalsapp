import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";

type ProposalProps = {
  id: string;
  name: string;
  timeEnd: Date;
  daoPicture: string | null;
  url: string;
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

const MAX_NAME_LENGTH = 100;

export const ProposalItem = ({ proposal }: { proposal: ProposalProps }) => {
  return (
    <Link
      className="h-36 lg:h-24 w-full flex flex-row items-center shadow-sm hover:shadow-md bg-white rounded-2xl p-2 gap-4 transition-all duration-200"
      href={proposal.url}
      target="_blank"
    >
      <div className="min-h-20 min-w-20 rounded-lg">
        <Image
          className="rounded-md"
          height={80}
          width={80}
          src={`/${proposal.daoPicture}.svg`}
          alt={""}
        />
      </div>
      <div className={`w-full text-ellipsis text-2xl ${poppins.className} `}>
        {proposal.name.length < MAX_NAME_LENGTH
          ? proposal.name
          : proposal.name.slice(0, MAX_NAME_LENGTH - 3) + "..."}
      </div>
      <div className="min-w-40 text-center">
        {proposal.timeEnd.getTime() > new Date().getTime() ? (
          <div className={`${poppins.className} text-dark text-xl`}>
            open for
          </div>
        ) : (
          <div className={`${poppins.className} text-gold text-xl`}>closed</div>
        )}

        {proposal.timeEnd.getTime() > new Date().getTime() ? (
          <div className={`${poppinsBold.className} text-dark text-xl`}>
            {moment(proposal.timeEnd).fromNow(true)}
          </div>
        ) : (
          <div className={`${poppinsBold.className} text-gold text-xl`}>
            {moment(proposal.timeEnd).fromNow(true)}
            {" ago"}
          </div>
        )}
      </div>
    </Link>
  );
};
