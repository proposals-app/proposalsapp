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
      <LoadingTimeline />
    </div>
  );
}

export const LoadingTimeline = () => {
  return (
    <div
      className='fixed top-0 right-0 flex h-full min-w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full w-full'>
        <div
          className={`dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 origin-bottom
            translate-x-[1px] scale-y-100 bg-neutral-800 transition-transform duration-1000
            ease-in-out`}
        />

        <div className='flex h-full flex-col justify-between'>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className='opacity-100 transition-opacity duration-200 ease-in-out'
            >
              <div className='translate-x-0 transform transition-transform duration-500 ease-out'>
                <div className='relative my-1 mr-4 flex h-8 w-full items-center'>
                  <div
                    className='text-neutral-650 flex h-full w-full animate-pulse items-center justify-between
                      rounded-xs border border-neutral-300 bg-neutral-100 px-4 py-1
                      dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  >
                    <div className='ml-2 h-4 w-32 rounded bg-neutral-200 text-xs dark:bg-neutral-700'></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
