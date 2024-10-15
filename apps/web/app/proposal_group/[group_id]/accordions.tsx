"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shadcn/ui/accordion";
import { Button } from "@/shadcn/ui/button";

export function ProposalAccordion({ proposals }: { proposals: any[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {proposals.map((proposal) => {
        const sortedVotes = [...proposal.votes].sort(
          (a, b) => b.votingPower - a.votingPower,
        );

        return (
          <AccordionItem key={proposal.id} value={proposal.id}>
            <AccordionTrigger>
              <Link
                href={proposal.url}
                target="_blank"
                className="text-blue-500 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {proposal.name}
              </Link>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mb-2 font-semibold">
                Choices: {JSON.stringify(proposal.choices)}
              </div>
              <h3 className="mb-2 font-semibold">Votes:</h3>
              <ul className="space-y-2 text-sm">
                {sortedVotes.map((vote: any) => (
                  <li key={vote.id} className="rounded-md bg-gray-100 p-2">
                    <span className="font-medium">Timestamp:</span>{" "}
                    {vote.timeCreated}
                    <br />
                    <span className="font-medium">Address:</span>{" "}
                    {vote.voterAddress}
                    <br />
                    <span className="font-medium">Choice:</span>{" "}
                    {JSON.stringify(vote.choice)}
                    <br />
                    <span className="font-medium">Power:</span>{" "}
                    {vote.votingPower}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function TopicAccordion({ topics }: { topics: any[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {topics.map((topic) => (
        <AccordionItem key={topic.id} value={topic.id}>
          <AccordionTrigger>
            <Link
              href={`${topic.discourseBaseUrl}/t/${topic.externalId}`}
              target="_blank"
              className="text-blue-500 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {topic.title}
            </Link>
          </AccordionTrigger>
          <AccordionContent>
            <h3 className="mb-2 font-semibold">Posts:</h3>
            <ul className="space-y-4">
              {topic.posts.map((post: any) => (
                <li
                  key={post.id}
                  className="rounded-lg bg-gray-100 p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center">
                    <span className="mr-2 font-medium text-gray-700">
                      User:
                    </span>
                    <span>{post.username}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Content:</span>
                    <p className="mt-1 leading-relaxed text-gray-800">
                      {post.cooked.length > 500
                        ? post.cooked.substring(0, 500) + "..."
                        : post.cooked}
                    </p>
                    {post.cooked.length > 500 && (
                      <Link
                        href={`${topic.discourseBaseUrl}/t/${topic.externalId}/${post.postNumber}`}
                        target="_blank"
                        className="mt-2 inline-block text-sm text-blue-500 hover:underline"
                      >
                        Read more
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function BackButton() {
  return (
    <Button asChild>
      <Link href="/mapping">Back to Mapping</Link>
    </Button>
  );
}
