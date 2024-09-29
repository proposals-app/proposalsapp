import { fetchData, ProposalGroupItem } from "./actions";
import GroupingInterface from "./components/proposal-group";

interface ProposalGroup {
  id: string;
  name: string;
  items: ProposalGroupItem[];
}

export default async function MappingPage() {
  const { proposalGroups } = await fetchData();

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Proposals Mapping</h1>
      <GroupingInterface initialGroups={proposalGroups} />
    </div>
  );
}
