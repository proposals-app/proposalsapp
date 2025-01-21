import { ViewEnum } from '@/app/searchParams';
import * as Switch from '@radix-ui/react-switch';
import { ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';
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
        className='flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2
          text-sm font-bold shadow-lg transition-colors'
      >
        <div className='flex w-full justify-between'>
          <div className='flex items-center gap-4'>
            <Link href='#'>
              <ArrowUp className='h-8 w-8 rounded-full border p-1' />
            </Link>
            <div className='flex items-center gap-2 text-nowrap'>
              <Switch.Root
                id='changes'
                checked={diff}
                onCheckedChange={(checked) => setDiff(checked)}
                className='relative h-6 w-11 rounded-full bg-gray-300 data-[state=checked]:bg-blue-500'
              >
                <Switch.Thumb
                  className='block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-100
                    will-change-transform data-[state=checked]:translate-x-5'
                />
              </Switch.Root>
              <label htmlFor='changes' className='cursor-pointer'>
                Show changes
              </label>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={() => setVersion(Math.max(0, currentVersion - 1))}
              disabled={currentVersion === 0}
              className={`flex h-8 items-center justify-center rounded-md px-3 ${
                currentVersion === 0
                  ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                  : 'bg-gray-100 hover:bg-gray-200'
                  }`}
            >
              Previous
            </button>
            <div
              className='pointer-events-none flex h-8 items-center justify-center rounded-md bg-gray-100
                px-3'
            >
              Version {currentVersion + 1} of {totalVersions}
            </div>
            <button
              onClick={() =>
                setVersion(Math.min(totalVersions - 1, currentVersion + 1))
              }
              disabled={currentVersion === totalVersions - 1}
              className={`flex h-8 items-center justify-center rounded-md px-3 ${
                currentVersion === totalVersions - 1
                  ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                  : 'bg-gray-100 hover:bg-gray-200'
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
            <ArrowDown className='h-8 w-8 rounded-full border p-1 hover:bg-gray-100' />
          </div>
        </div>
      </div>
    </div>
  );
};
