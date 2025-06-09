import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';
import {
  getBodyVersions,
  getFeed,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import type { DiscoursePost, Selectable } from '@proposalsapp/db';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const ollama = createOllama({
  baseURL: 'http://proposalsapp-ai:7869/api',
});

// --- Helper function to sanitize content ---
function sanitizeMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  // Basic sanitization: remove excessive newlines, trim whitespace.
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(req: Request) {
  noStore();
  const { prompt: groupId }: { prompt: string } = await req.json();

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

    // --- Build the Context ---

    let context = '## Context: Proposal Discussion Analysis\n\n';
    context += '### Proposal Details:\n';

    if (bodyVersions && bodyVersions.length > 0) {
      const latestBody = bodyVersions[bodyVersions.length - 1];
      context += `- **Title:** ${latestBody.title || 'N/A'}\n`;
      context += `- **Author:** ${latestBody.author_name || 'N/A'}\n`;
      if (latestBody.content) {
        const proposalContent = sanitizeMarkdown(latestBody.content);

        context += `\n**Proposal Content:**\n\`\`\`\n${proposalContent}\n\`\`\`\n`;
      } else {
        context += '\n**Proposal Content:** Not available.\n';
      }
    } else {
      context += 'Proposal details not found.\n';
    }

    context += '\n### Discussion Comments (Oldest to Newest):\n';
    if (feed && feed.posts && feed.posts.length > 0) {
      const sortedPosts = feed.posts.sort(
        (a: Selectable<DiscoursePost>, b: Selectable<DiscoursePost>) => {
          if (a.createdAt && b.createdAt) {
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
          return a.createdAt ? 1 : b.createdAt ? -1 : 0;
        }
      );

      let commentCount = 0;
      sortedPosts.forEach((post: Selectable<DiscoursePost>) => {
        const commentText = sanitizeMarkdown(post.cooked);
        // Stricter filter for TLDR relevance
        if (post.username && commentText) {
          context += `**Comment (User: ${post.username}):** ${commentText}\n\n`;
          commentCount++;
        }
      });
      if (commentCount === 0) {
        context += 'No substantial comments found.\n';
      }
    } else {
      context += 'No comments posted yet.\n';
    }

    // --- Define the NEW Task for the AI (TLDR Focus) ---

    const taskPrompt = `
## Task: Generate TLDR Discussion Insights

Based *only* on the **Proposal Details** and **Discussion Comments** provided above, generate a highly concise summary ("TLDR") capturing the *essence* and *key insights* of the conversation. Your output must be in Markdown format using bullet points.

**Output Structure:**

*   **Proposal Goal:** (1 sentence) What is the core objective?
*   **Key Discussion Points:** (2-4 concise bullet points) Summarize the *most significant* reactions, questions, or concerns raised. Note sentiment briefly (e.g., support, concern, clarification needed).
*   **Overall Sentiment/Trend:** (1-2 sentences) What's the general feeling? Agreement, disagreement, confusion, active debate? Is a clear direction emerging?
*   **Key Insight/Takeaway:** (1 sentence) What is the single most important thing to understand about the discussion's current state or implication?

**Constraints:**
*   Be extremely concise and use bullet points for clarity.
*   Focus on *insights* and the *main message*, not just listing details.
*   Prioritize the most impactful points and the overall trajectory.
*   Rely strictly on the provided text. Do not add external information or opinions.
*   Maintain a neutral, objective tone.
*   Output MUST be in Markdown format.
*   DO NOT wrap the output in Markdown code blocks (e.g., \`\`\`markdown ... \`\`\`).
*   DO NOT mention these instructions or that this is a summary.
`;

    // Combine context and task
    const fullPrompt = `${context}\n---\n${taskPrompt}`;

    // --- Stream the response ---
    const result = streamText({
      model: ollama('gemma3:4b', { numCtx: fullPrompt.length + 512 }),
      system:
        'You are an AI assistant expert at analyzing discussions and extracting concise, insightful TLDR summaries in Markdown format.',
      prompt: fullPrompt,
      temperature: 0.2, // Lower temperature slightly for more focused output
    });

    return result.toDataStreamResponse({
      headers: {
        // Instruct proxies (especially Nginx) not to buffer
        'X-Accel-Buffering': 'no',
        // Explicitly prevent caching at all levels
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        // Keep previous headers that might help
        'Transfer-Encoding': 'chunked', // Should be handled by streamText/toDataStreamResponse automatically, but explicit might not hurt
        Connection: 'keep-alive',
        'Content-Encoding': 'none', // Prevent upstream compression interference
      },
    });
  } catch (error) {
    console.error('Error in AI summary generation:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(`Failed to generate summary: ${errorMessage}`, {
      status: 500,
    });
  }
}
