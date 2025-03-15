import { BodyLoading } from './components/body/Body';
import { FeedLoading } from './components/feed/Feed';
import { LoadingMenuBar } from './components/menubar/LoadingMenuBar';

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
