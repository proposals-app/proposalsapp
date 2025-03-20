import { BodyLoading } from './components/body/body';
import { FeedLoading } from './components/feed/feed';
import { LoadingMenuBar } from './components/menubar/loading-menu-bar';

export default function Loading() {
  return (
    <div className='flex w-full flex-col items-center pt-10 pr-96'>
      <div className='flex w-full max-w-3xl flex-col overflow-visible'>
        <BodyLoading />
        <LoadingMenuBar />
        <FeedLoading />
      </div>
    </div>
  );
}
