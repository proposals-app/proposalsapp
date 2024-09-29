import { getGroupDetails } from "./actions";
import Link from "next/link";

export default async function ProposalGroupPage({
  params,
}: {
  params: { group_id: string };
}) {
  const groupDetails = await getGroupDetails(params.group_id);

  if (!groupDetails) {
    return <div>Group not found</div>;
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">{groupDetails.name}</h1>

      <h2 className="mt-4 text-xl font-semibold">Proposals</h2>
      <ul className="list-disc pl-5">
        {groupDetails.proposals.map((proposal) => (
          <li key={proposal.id}>
            <Link href={proposal.url} className="text-blue-600 hover:underline">
              {proposal.name}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-4 text-xl font-semibold">Discourse Topics</h2>
      <ul className="list-disc pl-5">
        {groupDetails.topics.map((topic) => (
          <li key={topic.id}>
            {" "}
            <Link
              href={`${topic.discourseBaseUrl}/t/${topic.externalId}`}
              className="text-blue-600 hover:underline"
            >
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/mapping"
        className="mt-8 block text-blue-600 hover:underline"
      >
        Back to Mapping
      </Link>
    </div>
  );
}
