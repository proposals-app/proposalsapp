"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shadcn/ui/accordion";
import { Button } from "@/shadcn/ui/button";
import { Badge } from "@/shadcn/ui/badge";
import { Card, CardContent } from "@/shadcn/ui/card";
import { ScrollArea } from "@/shadcn/ui/scroll-area";
import { Separator } from "@/shadcn/ui/separator";
import { CalendarIcon, ExternalLinkIcon, UserIcon } from "lucide-react";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";

type ProposalType = Selectable<Proposal> & {
  votes: Selectable<Vote>[];
  indexerVariant: string | null;
};

export function ProposalAccordion({
  proposals = [],
}: {
  proposals: ProposalType[];
}) {
  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {proposals.map((proposal: ProposalType) => {
        const validVotes = proposal.votes.filter(
          (vote): vote is Selectable<Vote> => vote !== null,
        );
        const sortedVotes = [...validVotes].sort((a, b) => {
          const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
          const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
          return timeB - timeA;
        });

        return (
          <AccordionItem
            key={proposal.id}
            value={proposal.id}
            className="rounded-lg border"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex w-full items-center gap-2">
                <Badge>Proposal</Badge>
                <Badge
                  variant="outline"
                  className={
                    proposal.indexerVariant === "SNAPSHOT_PROPOSALS"
                      ? "bg-yellow-100 dark:bg-yellow-800"
                      : "bg-green-100 dark:bg-green-800"
                  }
                >
                  {proposal.indexerVariant}
                </Badge>
                <span className="flex-1 text-left">{proposal.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={proposal.url} target="_blank">
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <h3 className="mb-2 font-semibold">Choices</h3>
                  <pre className="rounded-md bg-muted p-2 text-sm">
                    {JSON.stringify(proposal.choices, null, 2)}
                  </pre>
                </CardContent>
              </Card>

              <h3 className="mb-4 font-semibold">Votes</h3>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-4">
                  {sortedVotes.map((vote: Selectable<Vote>) => (
                    <Card key={vote.id}>
                      <CardContent className="pt-6">
                        <div className="mb-2 flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {vote.timeCreated
                              ? new Date(vote.timeCreated).toLocaleString()
                              : "Unknown time"}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {vote.voterAddress}
                            </span>
                          </div>
                          <Separator />
                          <div>
                            <span className="text-sm font-medium">Choice:</span>
                            <pre className="mt-1 rounded-md bg-muted p-2 text-sm">
                              {JSON.stringify(vote.choice, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Power:</span>
                            <span className="ml-2 text-sm">
                              {vote.votingPower}
                            </span>
                          </div>
                          {vote.reason && (
                            <div>
                              <span className="text-sm font-medium">
                                Reason:
                              </span>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {vote.reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function TopicAccordion({ topics }: { topics: any[] }) {
  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {topics.map((topic) => {
        const sortedPosts = [...topic.posts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        return (
          <AccordionItem
            key={topic.id}
            value={topic.id}
            className="rounded-lg border"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex w-full items-center gap-2">
                <Badge variant="secondary">Discussion</Badge>
                <Badge
                  variant="outline"
                  className="bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                >
                  {topic.discourseBaseUrl}
                </Badge>
                <span className="flex-1 text-left">{topic.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`${topic.discourseBaseUrl}/t/${topic.externalId}`}
                    target="_blank"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ScrollArea className="h-[500px] rounded-md border p-4">
                <div className="space-y-4">
                  {sortedPosts.map((post: any) => (
                    <Card key={post.id}>
                      <CardContent className="pt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            <span className="font-medium">{post.username}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            {new Date(post.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Separator className="mb-4" />
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {post.cooked.length > 500 ? (
                            <>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: post.cooked.substring(0, 500) + "...",
                                }}
                              />
                              <Button
                                variant="link"
                                asChild
                                className="mt-2 h-auto p-0"
                              >
                                <Link
                                  href={`${topic.discourseBaseUrl}/t/${topic.externalId}/${post.postNumber}`}
                                  target="_blank"
                                >
                                  Read more
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <div
                              dangerouslySetInnerHTML={{ __html: post.cooked }}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function BackButton() {
  return (
    <Button variant="outline" asChild className="mb-4">
      <Link href="/mapping">← Back to Mapping</Link>
    </Button>
  );
}
