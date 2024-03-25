import { getGuestProposals } from "@/app/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/ui/table";
import { StateFilterEnum } from "../filters/state-filter";
import Image from "next/image";
import moment from "moment";

export const ProposalsTable = async ({
  searchParams,
}: {
  searchParams: {
    state: string;
    dao: string | string[];
  };
}) => {
  const proposals = await getGuestProposals(
    searchParams.state as StateFilterEnum,
    searchParams.dao,
    0,
  );

  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">DAO</TableHead>
          <TableHead className="w-full">Proposal Title</TableHead>
          <TableHead className="w-20">Deadline</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => (
          <TableRow key={proposal.id}>
            <TableCell className="p-0">
              <Image
                width={42}
                height={42}
                src={`/${proposal.daoPicture}.svg`}
                alt={""}
              ></Image>
            </TableCell>
            <TableCell>{proposal.name}</TableCell>
            <TableCell className="min-w-32">
              {moment(proposal.timeEnd).fromNow()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
