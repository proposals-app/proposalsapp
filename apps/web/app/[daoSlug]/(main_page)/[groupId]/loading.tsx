import { BodyLoading, LoadingBodyHeader } from './components/body/body';
import { FeedLoading } from './components/feed/feed';
import { LoadingMenuBar } from './components/menubar/loading-menu-bar';

export default function Loading() {
  return (
    <div className='flex w-full flex-col items-center px-4 md:pt-10 md:pr-96'>
      <div className='flex w-full max-w-3xl flex-col gap-4 overflow-visible'>
        <LoadingBodyHeader />
        <BodyLoading />
        <LoadingMenuBar />
        <FeedLoading />
      </div>
    </div>
  );
}
