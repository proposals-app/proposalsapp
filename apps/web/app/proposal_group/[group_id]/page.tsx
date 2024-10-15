import { getGroupDetails } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { ProposalAccordion, TopicAccordion, BackButton } from "./accordions";

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
    <Card className="mx-auto w-full">
      <CardHeader>
        <CardTitle>{groupDetails.name}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
