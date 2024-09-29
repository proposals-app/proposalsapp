import { getGroupDetails } from "./actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";

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
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>{groupDetails.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold">Proposals</h2>
            <ul className="list-disc space-y-1 pl-5">
              {groupDetails.proposals.map((proposal) => (
                <li key={proposal.id}>
                  <Link
                    href={proposal.url}
                    target="_blank"
                    className="text-blue-500 hover:underline"
                  >
                    {proposal.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">Discourse Topics</h2>
            <ul className="list-disc space-y-1 pl-5">
              {groupDetails.topics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`${topic.discourseBaseUrl}/t/${topic.externalId}`}
                    target="_blank"
                    className="text-blue-500 hover:underline"
                  >
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Button asChild>
            <Link href="/mapping">Back to Mapping</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
