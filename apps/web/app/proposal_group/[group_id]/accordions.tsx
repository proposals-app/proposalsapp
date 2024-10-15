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
      {proposals.map((proposal) => (
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
            <h3 className="mb-2">Votes:</h3>
            <ul className="list-disc pl-5">
              {proposal.votes.map((vote: any) => (
                <li key={vote.id}>
                  Timestamp: {vote.timeCreated}, Address: {vote.voterAddress},
                  Choice: {JSON.stringify(vote.choice)}, Power:{" "}
                  {vote.votingPower}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
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
            <ul className="list-disc pl-5">
              {topic.posts.map((post: any) => (
                <li key={post.id}>
                  User: {post.username}, Content:{" "}
                  {post.cooked.substring(0, 100)}...
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
