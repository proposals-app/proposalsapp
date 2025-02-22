import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";

type ProposalProps = {
  id: string;
  name: string;
  endAt: Date;
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
      className="flex w-full flex-row items-center gap-2 rounded-2xl bg-white p-2 shadow-xs transition-all duration-200 hover:shadow-md"
      href={proposal.url}
      target="_blank"
    >
      <div className="relative aspect-square max-h-[56px] w-full max-w-[56px] lg:max-h-[86px] lg:max-w-[86px]">
        <Image
          className="rounded-lg"
          src={`/${proposal.daoPicture}.svg`}
          alt={""}
          fill
          sizes="100vw"
          style={{
            objectFit: "contain",
          }}
        />
      </div>

      <div
        className={`w-full text-[18px] leading-[24px] text-ellipsis ${poppins.className}`}
      >
        {proposal.name.length < MAX_NAME_LENGTH
          ? proposal.name
          : proposal.name.slice(0, MAX_NAME_LENGTH - 3) + "..."}
      </div>
      <div className="min-w-[100px] text-center">
        {proposal.endAt.getTime() > new Date().getTime() ? (
          <div className={`${poppins.className} text-dark text-xl`}>
            open for
          </div>
        ) : (
          <div className={`${poppins.className} text-gold text-xl`}>closed</div>
        )}

        {proposal.endAt.getTime() > new Date().getTime() ? (
          <div className={`${poppinsBold.className} text-dark text-xl`}>
            {moment(proposal.endAt).fromNow(true)}
          </div>
        ) : (
          <div className={`${poppinsBold.className} text-gold text-xl`}>
            {moment(proposal.endAt).fromNow(true)}
            {" ago"}
          </div>
        )}
      </div>
    </Link>
  );
};
