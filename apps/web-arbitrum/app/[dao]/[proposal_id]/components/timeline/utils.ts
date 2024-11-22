import { Selectable, Vote } from "@proposalsapp/db";
import { ProcessedTimelineItem } from "./types";

export function processTimelineData(
  result: any,
  groupDetails: any,
): ProcessedTimelineItem[] {
  const timeline: ProcessedTimelineItem[] = [];

  // Add the main proposal/topic first
  if (result.proposal) {
    timeline.push({
      type: "proposal",
      timestamp: new Date(result.proposal.timeCreated),
      content: result.proposal,
    });
  }

  if (result.topic) {
    timeline.push({
      type: "discussion",
      timestamp: new Date(result.topic.createdAt),
      content: result.topic,
    });
  }

  // Add related proposals and their votes
  if (groupDetails?.proposals) {
    groupDetails.proposals.forEach((relatedProposal: any) => {
      if (relatedProposal.id !== result.proposal?.id) {
        timeline.push({
          type: "proposal",
          timestamp: new Date(relatedProposal.timeCreated),
          content: relatedProposal,
        });
      }

      // Process votes
      const allVotes = relatedProposal.votes
        .filter((v: any) => v !== null && v.timeCreated && v.votingPower)
        .map((vote: any) => ({
          ...vote,
          // Ensure choice is always an array
          choice: Array.isArray(vote.choice) ? vote.choice : [vote.choice],
          votingPower: parseFloat(vote.votingPower),
          timestampMs: new Date(vote.timeCreated).getTime(),
        }));

      if (allVotes.length === 0) return;

      // Get top 10 votes by voting power
      const topVotes = [...allVotes]
        .sort((a: any, b: any) => b.votingPower - a.votingPower)
        .slice(0, 10);

      // Get remaining votes
      const remainingVotes = allVotes.filter(
        (vote: Selectable<Vote>) => !topVotes.some((tv) => tv.id === vote.id),
      );

      // Sort top votes chronologically
      topVotes.sort((a: any, b: any) => a.timestampMs - b.timestampMs);

      // Create time windows between top votes
      for (let i = 0; i < topVotes.length; i++) {
        const currentVote = topVotes[i];
        const nextVote = topVotes[i + 1];

        // Add the current top vote
        timeline.push({
          type: "vote",
          timestamp: new Date(currentVote.timestampMs),
          content: {
            ...currentVote,
            proposalName: relatedProposal.name,
            choiceNames: relatedProposal.choices || {}, // Add this line
            votingPower: currentVote.votingPower.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
        });

        // If there's a next vote, aggregate votes that happened between current and next
        if (nextVote) {
          const votesInWindow = remainingVotes.filter(
            (vote: any) =>
              vote.timestampMs > currentVote.timestampMs &&
              vote.timestampMs < nextVote.timestampMs,
          );

          if (votesInWindow.length > 0) {
            // Group votes in this window by choice
            const aggregatedVotes = votesInWindow.reduce(
              (acc: any, vote: any) => {
                const choice = vote.choice.toString();
                if (!acc[choice]) {
                  acc[choice] = {
                    choice,
                    count: 0,
                    totalVotingPower: 0,
                  };
                }
                acc[choice].count++;
                acc[choice].totalVotingPower += vote.votingPower;
                return acc;
              },
              {},
            );

            timeline.push({
              type: "aggregated_votes",
              timestamp: new Date(
                (currentVote.timestampMs + nextVote.timestampMs) / 2,
              ),
              content: {
                proposalName: relatedProposal.name,
                votes: Object.values(aggregatedVotes).map((agg: any) => ({
                  choice: agg.choice,
                  count: agg.count,
                  votingPower: agg.totalVotingPower.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }),
                })),
                totalVotes: votesInWindow.length,
                totalVotingPower: votesInWindow
                  .reduce((sum: number, v: any) => sum + v.votingPower, 0)
                  .toLocaleString(undefined, { maximumFractionDigits: 2 }),
              },
            });
          }
        }
      }

      // Handle remaining votes after the last top vote
      const votesAfterLast = remainingVotes.filter(
        (vote: any) =>
          vote.timestampMs > topVotes[topVotes.length - 1].timestampMs,
      );

      if (votesAfterLast.length > 0) {
        const aggregatedVotes = votesAfterLast.reduce((acc: any, vote: any) => {
          const choice = vote.choice.toString();
          if (!acc[choice]) {
            acc[choice] = {
              choice,
              count: 0,
              totalVotingPower: 0,
            };
          }
          acc[choice].count++;
          acc[choice].totalVotingPower += vote.votingPower;
          return acc;
        }, {});

        timeline.push({
          type: "aggregated_votes",
          timestamp: new Date(
            votesAfterLast.reduce(
              (sum: number, vote: any) => sum + vote.timestampMs,
              0,
            ) / votesAfterLast.length,
          ),
          content: {
            proposalName: relatedProposal.name,
            votes: Object.values(aggregatedVotes).map((agg: any) => ({
              choice: agg.choice,
              count: agg.count,
              votingPower: agg.totalVotingPower.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            })),
            totalVotes: votesAfterLast.length,
            totalVotingPower: votesAfterLast
              .reduce((sum: number, v: any) => sum + v.votingPower, 0)
              .toLocaleString(undefined, { maximumFractionDigits: 2 }),
          },
        });
      }
    });
  }

  // Add related topics and posts
  if (groupDetails?.topics) {
    groupDetails.topics.forEach((topic: any) => {
      if (topic.posts && topic.posts.length > 0) {
        const sortedPosts = topic.posts
          .filter((p: any) => p !== null)
          .sort(
            (a: any, b: any) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

        // First post is discussion
        timeline.push({
          type: "discussion",
          timestamp: new Date(sortedPosts[0].createdAt),
          content: {
            ...sortedPosts[0],
            topicTitle: topic.title,
            discourseBaseUrl: topic.discourseBaseUrl,
          },
        });

        // Rest are regular posts
        sortedPosts.slice(1).forEach((post: any) => {
          timeline.push({
            type: "post",
            timestamp: new Date(post.createdAt),
            content: {
              ...post,
              topicTitle: topic.title,
              discourseBaseUrl: topic.discourseBaseUrl,
            },
          });
        });
      }
    });
  }

  // Sort by timestamp, newest first
  const sortedTimeline = timeline.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );

  // Find the first discussion or proposal
  let firstDiscussionOrProposalIndex = sortedTimeline.findIndex(
    (item) => item.type === "discussion" || item.type === "proposal",
  );

  if (
    firstDiscussionOrProposalIndex !== -1 &&
    firstDiscussionOrProposalIndex !== 0
  ) {
    // Move the first discussion or proposal to the first position
    const firstDiscussionOrProposal = sortedTimeline.splice(
      firstDiscussionOrProposalIndex,
      1,
    )[0];
    sortedTimeline.unshift(firstDiscussionOrProposal);
  }

  return sortedTimeline;
}
