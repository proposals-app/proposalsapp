import { ViewEnum } from '@/app/searchParams';
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
} from 'nuqs';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import NextSvg from '@/public/assets/web/next.svg';
import PreviousSvg from '@/public/assets/web/previous.svg';
import FirstSvg from '@/public/assets/web/first.svg';
import LastSvg from '@/public/assets/web/last.svg';
import CheckboxCheck from '@/public/assets/web/checkbox_check.svg';
import CheckboxNocheck from '@/public/assets/web/checkbox_nocheck.svg';

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
    parseAsInteger
      .withDefault(totalVersions - 1)
      .withOptions({ shallow: false })
  );

  const currentVersion = version ?? 0;

  return (
    <div
      className={`fixed bottom-0 z-50 mt-4 min-w-4xl self-center px-4 pb-4 transition-opacity
        duration-300 ${view === ViewEnum.BODY ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
          rounded-xs border border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
          font-bold text-neutral-800 transition-colors dark:bg-neutral-950
          dark:fill-neutral-200 dark:text-neutral-200'
      >
        <div className='flex w-full justify-between'>
          <div className='flex items-center gap-4'>
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
                    <CheckboxCheck
                      className='absolute inset-0'
                      width={24}
                      height={24}
                    />
                  ) : (
                    <CheckboxNocheck
                      className='absolute inset-0'
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
              onClick={() => setVersion(0)}
              disabled={currentVersion === 0}
              className={`flex h-8 items-center justify-center px-1 text-sm ${
                currentVersion === 0 ? 'cursor-not-allowed' : '' }`}
            >
              <FirstSvg
                className={`${currentVersion === 0 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                width={24}
                height={24}
              />
            </button>

            <button
              onClick={() => setVersion(Math.max(0, currentVersion - 1))}
              disabled={currentVersion === 0}
              className={`flex h-8 items-center justify-center px-1 text-sm ${
                currentVersion === 0 ? 'cursor-not-allowed' : '' }`}
            >
              <PreviousSvg
                className={`${currentVersion === 0 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                width={24}
                height={24}
              />
            </button>
            <div className='flex h-8 w-32 items-center justify-center gap-2 text-sm'>
              Version {currentVersion + 1} of {totalVersions}
            </div>

            <button
              onClick={() =>
                setVersion(Math.min(totalVersions - 1, currentVersion + 1))
              }
              disabled={currentVersion === totalVersions - 1}
              className={`flex h-8 items-center justify-center px-1 text-sm ${
                currentVersion === totalVersions - 1 ? 'cursor-not-allowed' : '' }`}
            >
              <NextSvg
                className={`${currentVersion === totalVersions - 1 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                width={24}
                height={24}
              />
            </button>
            <button
              onClick={() => setVersion(totalVersions - 1)}
              disabled={currentVersion === totalVersions - 1}
              className={`flex h-8 items-center justify-center px-1 text-sm ${
                currentVersion === totalVersions - 1 ? 'cursor-not-allowed' : '' }`}
            >
              <LastSvg
                className={`${currentVersion === totalVersions - 1 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
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
            <ArrowSvg className='rotate-180' width={24} height={24} />
            <div>Comments and Votes</div>
          </button>
        </div>
      </div>
    </div>
  );
};
