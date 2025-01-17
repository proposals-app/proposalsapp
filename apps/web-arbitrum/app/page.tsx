import { PostHogIdentifier } from './providers/posthog-identifier';

export default async function Home(props: {
  searchParams: Promise<{
    state: string;
    dao: string | string[];
  }>;
}) {
  return (
    <div className='flex w-full flex-col items-center p-8'>
      <PostHogIdentifier />

      <h2 className='text-xl font-semibold'>workin on it</h2>
    </div>
  );
}
