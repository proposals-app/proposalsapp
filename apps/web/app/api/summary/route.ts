import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';
import {
  getBodyVersions,
  getFeed,
} from '@/app/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { Selectable, DiscoursePost } from '@proposalsapp/db-indexer';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const ollama = createOllama({
  baseURL: 'http://proposalsapp-ai:7869/api',
});

// --- Helper function to sanitize content (optional but recommended) ---
function sanitizeMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  // Basic sanitization: remove excessive newlines, trim whitespace.
  // You might want a more robust library (like DOMPurify if rendering HTML,
  // or specific markdown cleaners) depending on the source data's cleanliness.
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(req: Request) {
  const { prompt: groupId }: { prompt: string } = await req.json(); // Assuming 'prompt' is the groupId

  if (!groupId) {
    return new Response('Missing groupId', { status: 400 });
  }

  try {
    // 1. Fetch body versions
    const bodyVersions = await getBodyVersions(groupId, true);

    // 2. Fetch feed (comments)
    const feed = await getFeed(
      groupId,
      FeedFilterEnum.COMMENTS,
      FromFilterEnum.ALL
    );

    // --- Build the Enhanced Prompt ---

    let context = '## Context: Proposal Discussion Analysis\n\n';
    context += '### Proposal Details:\n';

    // Add the latest body version
    if (bodyVersions && bodyVersions.length > 0) {
      const latestBody = bodyVersions[bodyVersions.length - 1];
      context += `- **Title:** ${latestBody.title || 'N/A'}\n`;
      context += `- **Author:** ${latestBody.author_name || 'N/A'}\n`;
      if (latestBody.content) {
        // Limit proposal content length if it's very long to save tokens/focus
        const proposalContent = sanitizeMarkdown(latestBody.content);
        const truncatedContent =
          proposalContent.length > 3000
            ? proposalContent.substring(0, 3000) + '... (truncated)'
            : proposalContent;
        context += `\n**Proposal Content Summary:**\n\`\`\`\n${truncatedContent}\n\`\`\`\n`;
      } else {
        context += '\n**Proposal Content:** Not available.\n';
      }
    } else {
      context += 'Proposal details not found.\n';
    }

    // Add comments with usernames, sorted by createdAt
    context += '\n### Discussion Comments:\n';
    if (feed && feed.posts && feed.posts.length > 0) {
      // Sort posts by createdAt in ascending order (oldest first)
      const sortedPosts = feed.posts.sort(
        (a: Selectable<DiscoursePost>, b: Selectable<DiscoursePost>) => {
          if (a.createdAt && b.createdAt) {
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          } else if (a.createdAt) {
            return 1; // a comes after b (a has createdAt, b doesn't)
          } else if (b.createdAt) {
            return -1; // b comes after a (b has createdAt, a doesn't)
          } else {
            return 0; // both don't have createdAt, keep original order.  Shouldn't happen.
          }
        }
      );

      sortedPosts.forEach((post: Selectable<DiscoursePost>, index: number) => {
        // Basic check for potentially empty/low-value comments
        const commentText = sanitizeMarkdown(post.cooked);
        if (post.username && commentText && commentText.length > 10) {
          context += `**Comment ${index + 1} (User: ${post.username}):**\n${commentText}\n\n`;
        }
      });
      // Check if all comments were filtered out
      if (!context.includes('**Comment ')) {
        context += 'No substantial comments found.\n';
      }
    } else {
      context += 'No comments have been posted yet.\n';
    }

    // --- Define the Task for the AI ---

    const taskPrompt = `
## Task: Generate Discussion Insights

Based *only* on the **Proposal Details** and **Discussion Comments** provided above, generate a concise analysis focusing on the *development* and *dynamics* of the conversation. Your output should be in Markdown format and address the following:

1.  **Core Subject:** Briefly state the main topic or goal of the proposal being discussed.
2.  **Key Discussion Threads:** Identify 1-3 primary themes, questions, or points of contention emerging from the comments.
3.  **Discussion Flow & Evolution:**
    *   How is the conversation progressing? Is there convergence towards agreement, divergence into debate, or are people primarily seeking clarification?
    *   Are later comments building upon, challenging, or ignoring earlier ones? Note any significant shifts in focus or sentiment.
    *   Mention if the author's original points are being directly addressed or if the discussion has moved to related tangents.
4.  **Overall Impression:** Conclude with a single sentence summarizing the current state or trajectory of the discussion (e.g., "The discussion shows strong support but needs technical clarification," or "Significant disagreement exists regarding the core approach," or "Early stages, mostly clarifying questions being asked.").

**Constraints:**
*   Be concise and analytical. Aim for insights, not just a list of comments.
*   Focus strictly on the provided text. Do not invent information or opinions.
*   Maintain a neutral, objective tone.
*   Output MUST be in Markdown format.
*   DO NOT wrap the output in Markdown code blocks.
*   DO NOT MENTION ANYTHING ABOUT THE TASK INSTRUCTIONS.
*   DO NOT MENTION THIS IS A MARKDOWN SUMMARY.
`;

    // Combine context and task
    const fullPrompt = context + '\n---\n' + taskPrompt;

    // --- Stream the response ---
    const result = streamText({
      model: ollama('gemma3:4b', { numCtx: fullPrompt.length + 1024 }),
      system:
        'You are an AI assistant skilled at analyzing discussion text and providing insightful summaries in Markdown format.',
      prompt: fullPrompt,
      temperature: 0.3,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in AI summary generation:', error);
    // Provide a more informative error response
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(`Failed to generate summary: ${errorMessage}`, {
      status: 500,
    });
  }
}
