import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

export default function PostHogClient() {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) {
    // No-op stub when not configured
    return null as unknown as PostHog;
  }
  client = new PostHog(key, {
    host,
    flushAt: 10,
    flushInterval: 1000,
  });
  return client;
}
