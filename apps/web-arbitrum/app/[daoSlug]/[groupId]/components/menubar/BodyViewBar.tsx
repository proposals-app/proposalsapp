import { ViewEnum } from '@/app/searchParams';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
} from 'nuqs';

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
      className={`fixed bottom-0 z-50 flex w-full max-w-[90%] justify-center self-center px-4 pb-4
        transition-transform duration-300 md:max-w-[75%] lg:max-w-[48%] ${
        view === ViewEnum.BODY ? 'translate-y-0' : 'translate-y-full' }`}
    >
      <div
        className='border-neutral-350 flex w-full items-center justify-between gap-2 rounded-full
          border bg-white p-2 text-sm font-bold shadow-lg transition-colors
          dark:border-neutral-800 dark:bg-neutral-950'
      >
        <div className='flex w-full justify-between text-neutral-600 dark:text-neutral-200'>
          <div className='flex items-center gap-4'>
            <ArrowUp
              className='border-neutral-350 h-8 w-8 cursor-pointer rounded-full border bg-neutral-50 p-1
                hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                dark:hover:bg-neutral-700'
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            <div
              className='border-neutral-350 flex h-8 cursor-pointer items-center justify-start
                rounded-full border bg-neutral-50 px-4 pr-4 pl-1 text-sm transition-colors
                hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                dark:hover:bg-neutral-700'
            >
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
                    className='border-neutral-350 h-6 w-6 cursor-pointer appearance-none rounded-full border
                      bg-neutral-50 checked:border-neutral-400 dark:border-neutral-700
                      dark:bg-neutral-800'
                  />
                  {diff && (
                    <svg
                      width='12'
                      height='9'
                      viewBox='0 0 12 9'
                      fill='none'
                      xmlns='http://www.w3.org/2000/svg'
                      className='pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        fill-neutral-700 dark:fill-neutral-200'
                    >
                      <path d='M0.680398 4.75L1.54403 3.86364L4.54403 6.81818L10.7486 0.636363L11.6349 1.52273L4.54403 8.59091L0.680398 4.75Z' />
                    </svg>
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
              className={`flex h-8 items-center justify-center rounded-full border px-3 transition-colors
                ${
                currentVersion === 0
                    ? `cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400
                      dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600`
                    : `border-neutral-350 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700
                      dark:bg-neutral-800 dark:hover:bg-neutral-700`
                }`}
            >
              Previous
            </button>
            <div
              className='border-neutral-350 pointer-events-none flex h-8 items-center justify-center
                rounded-full border bg-neutral-50 px-3 dark:border-neutral-700
                dark:bg-neutral-800'
            >
              Version {currentVersion + 1} of {totalVersions}
            </div>
            <button
              onClick={() =>
                setVersion(Math.min(totalVersions - 1, currentVersion + 1))
              }
              disabled={currentVersion === totalVersions - 1}
              className={`flex h-8 items-center justify-center rounded-full border px-3 transition-colors
                ${
                currentVersion === totalVersions - 1
                    ? `cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400
                      dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600`
                    : `border-neutral-350 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700
                      dark:bg-neutral-800 dark:hover:bg-neutral-700`
                }`}
            >
              Next
            </button>
          </div>

          <div
            className='flex cursor-pointer flex-row items-center gap-4 text-nowrap hover:underline'
            onClick={() => {
              if (expanded) {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <div>Comments and Votes</div>
            <ArrowDown
              className='border-neutral-350 h-8 w-8 rounded-full border bg-neutral-50 p-1
                hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800
                dark:hover:bg-neutral-700'
            />
          </div>
        </div>
      </div>
    </div>
  );
};
