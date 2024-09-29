import { fetchData } from "./actions";
import GroupingInterface from "./components/proposal-group";

export default async function MappingPage() {
  try {
    const { proposalGroups } = await fetchData();

    return (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-bold">Proposals Mapping</h1>
        <GroupingInterface initialGroups={proposalGroups} />
      </div>
    );
  } catch (error) {
    console.error("Error fetching proposal groups:", error);
    return (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-bold">Proposals Mapping</h1>
        <p>Error loading proposal groups. Please try again later.</p>
      </div>
    );
  }
}
