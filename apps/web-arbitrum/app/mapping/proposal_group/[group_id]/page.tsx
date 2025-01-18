import { getGroupDetails } from "./actions";
import { ProposalAccordion, TopicAccordion, BackButton } from "./accordions";

export default async function ProposalGroupPage(props: {
  params: Promise<{ group_id: string }>;
}) {
  const params = await props.params;
  const groupDetails = await getGroupDetails(params.group_id);

  if (!groupDetails) {
    return <div>Group not found</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl rounded-lg border p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{groupDetails.name}</h1>
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Proposals</h2>
          <ProposalAccordion proposals={groupDetails.proposals} />
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">Discourse Topics</h2>
          <TopicAccordion topics={groupDetails.topics} />
        </div>

        <BackButton />
      </div>
    </div>
  );
}
