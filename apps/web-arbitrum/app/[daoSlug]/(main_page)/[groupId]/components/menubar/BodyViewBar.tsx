import { ViewEnum } from '@/app/searchParams';
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
} from 'nuqs';
import Image from 'next/image';

export const BodyViewBar = ({ totalVersions }: { totalVersions: number }) => {
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum))
      .withDefault(ViewEnum.FULL)
      .withOptions({ shallow: false })
  );

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false).withOptions({ shallow: false })
  );

  const [diff, setDiff] = useQueryState(
    'diff',
    parseAsBoolean.withDefault(false).withOptions({ shallow: false })
  );

  const [version, setVersion] = useQueryState(
    'version',
    parseAsInteger.withOptions({ shallow: false })
  );

  const currentVersion = version ?? 0;

  return (
    <div
      className={`fixed bottom-0 z-50 mt-4 min-w-4xl self-center px-4 pb-4 transition-opacity
        duration-300 ${view === ViewEnum.BODY ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='flex w-full items-center justify-between gap-2 border bg-white p-2 text-sm
          font-bold shadow-lg dark:border-neutral-700 dark:bg-neutral-800
          dark:text-neutral-200'
      >
        <div className='flex w-full justify-between'>
          <div className='flex items-center gap-4'>
            {/* <ArrowUp
              className='h-8 w-8 cursor-pointer rounded-full p-1 hover:bg-neutral-100
                dark:hover:bg-neutral-700'
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            /> */}

            <div className='flex h-8 cursor-pointer items-center justify-start gap-2 px-3'>
              <label
                htmlFor='changes'
                className='flex cursor-pointer items-center gap-2'
              >
                <div className='relative flex items-start'>
                  <input
                    type='checkbox'
                    id='changes'
                    checked={diff}
                    onChange={(e) => setDiff(e.target.checked)}
                    className='h-6 w-6 cursor-pointer appearance-none'
                  />
                  {diff ? (
                    <Image
                      src='/assets/web/checkbox_check.svg'
                      alt=''
                      width={24}
                      height={24}
                    />
                  ) : (
                    <Image
                      src='/assets/web/checkbox_nocheck.svg'
                      alt=''
                      width={24}
                      height={24}
                    />
                  )}
                </div>
                Show changes
              </label>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={() => setVersion(Math.max(0, currentVersion - 1))}
              disabled={currentVersion === 0}
              className={`flex h-8 items-center justify-center px-3 text-sm ${
                currentVersion === 0
                  ? `cursor-not-allowed bg-neutral-50 text-neutral-400 dark:bg-neutral-800
                    dark:text-neutral-600`
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
            >
              <Image
                className='-rotate-90'
                src='/assets/web/arrow.svg'
                alt=''
                width={24}
                height={24}
              />
            </button>
            <div className='flex h-8 items-center justify-center gap-2 text-sm'>
              Version {currentVersion + 1} of {totalVersions}
            </div>
            <button
              onClick={() =>
                setVersion(Math.min(totalVersions - 1, currentVersion + 1))
              }
              disabled={currentVersion === totalVersions - 1}
              className={`flex h-8 items-center justify-center px-3 text-sm ${
                currentVersion === totalVersions - 1
                  ? `cursor-not-allowed bg-neutral-50 text-neutral-400 dark:bg-neutral-800
                    dark:text-neutral-600`
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <Image
                className='rotate-90'
                src='/assets/web/arrow.svg'
                alt=''
                width={24}
                height={24}
              />
            </button>
          </div>

          <button
            className='flex cursor-pointer items-center gap-4 hover:underline'
            onClick={() => {
              if (expanded) {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <Image
              className='rotate-180'
              src='/assets/web/arrow.svg'
              alt=''
              width={24}
              height={24}
            />
            <div>Comments and Votes</div>
          </button>
        </div>
      </div>
    </div>
  );
};
