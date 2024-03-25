import moment from "moment";
import Image from "next/image";

type ProposalProps = {
  id: string;
  name: string;
  timeEnd: Date;
  daoPicture: string | null;
};

export const ProposalItem = ({ proposal }: { proposal: ProposalProps }) => {
  return (
    <div className="w-full flex flex-row">
      <div className="w-16">
        <Image
          width={42}
          height={42}
          src={`/${proposal.daoPicture}.svg`}
          alt={""}
        />
      </div>
      <div className="w-full">{proposal.name}</div>
      <div className="min-w-32 text-end">
        {moment(proposal.timeEnd).fromNow()}
      </div>
    </div>
  );
};
