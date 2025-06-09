'use client';

import ArrowSvg from '@/public/assets/web/icons/arrow-up.svg';
import CheckboxCheck from '@/public/assets/web/icons/checkbox-checked.svg';
import CheckboxNocheck from '@/public/assets/web/icons/checkbox-unchecked.svg';
import FirstSvg from '@/public/assets/web/icons/chevron-double-left.svg';
import LastSvg from '@/public/assets/web/icons/chevron-double-right.svg';
import PreviousSvg from '@/public/assets/web/icons/chevron-left.svg';
import NextSvg from '@/public/assets/web/icons/chevron-right.svg';
import { parseAsBoolean, parseAsInteger, useQueryState } from 'nuqs';
import { useOptimistic, useTransition } from 'react';
import type { BodyVersionType, VersionType } from '../../actions';
import { ViewEnum } from './menu-bar';

interface BodyViewBarProps {
  bodyVersions: BodyVersionType[];
  currentVersion: number;
  view?: ViewEnum;
  setView: (view: ViewEnum) => void;
  diff: boolean;
  includesProposals: boolean;
}

export const BodyViewBar = ({
  bodyVersions,
  currentVersion,
  view: _view,
  setView,
  diff,
  includesProposals,
}: BodyViewBarProps) => {
  const totalVersions = bodyVersions.length;
  const versionTypes: VersionType[] = bodyVersions.map((body) => body.type);

  const [, startTransitionDiff] = useTransition();
  const [, startTransitionVersion] = useTransition();

  const [optimisticDiff, setOptimisticDiff] = useOptimistic(
    diff,
    (currentDiff, newDiff: boolean) => newDiff
  );

  const [optimisticVersion, setOptimisticVersion] = useOptimistic(
    currentVersion,
    (currentVersionOptimistic, newVersion: number) => newVersion
  );

  const [expanded, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false).withOptions({ shallow: true })
  );

  const [, setDiffQuery] = useQueryState(
    'diff',
    parseAsBoolean
      .withDefault(false)
      .withOptions({ shallow: false, startTransition: startTransitionDiff })
  );

  const [, setVersionQuery] = useQueryState(
    'version',
    parseAsInteger
      .withDefault(currentVersion)
      .withOptions({ shallow: false, startTransition: startTransitionVersion })
  );

  const currentType = versionTypes[optimisticVersion];
  const versionTypeText =
    currentType === 'topic'
      ? 'Discourse Topic Version'
      : currentType === 'onchain'
        ? 'Onchain Proposal Version'
        : 'Offchain Proposal Version';

  return (
    <div
      className={`fixed ${includesProposals ? 'bottom-20' : 'bottom-0'} mt-4 w-full max-w-4xl self-center px-4 pb-4 sm:bottom-0 sm:px-2 ${_view === ViewEnum.BODY ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className='dark:border-neutral-450 flex w-full flex-col items-stretch justify-between gap-2 rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm font-bold text-neutral-800 md:flex-row md:items-center dark:bg-neutral-950 dark:fill-neutral-200 dark:text-neutral-200'>
        <div className='flex w-full flex-row justify-between gap-2'>
          <div className='flex w-auto items-center justify-start sm:pl-2'>
            <button
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                setExpanded(!expanded);
                setView(ViewEnum.FULL);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label='Show comments and votes'
            >
              <ArrowSvg width={24} height={24} />
            </button>

            <div className='flex h-8 cursor-pointer items-center justify-start gap-2 px-3'>
              <label
                htmlFor='changes'
                className='flex cursor-pointer items-center gap-2 text-sm'
              >
                <div className='relative flex items-start'>
                  <input
                    type='checkbox'
                    id='changes'
                    checked={optimisticDiff}
                    onChange={(e) => {
                      startTransitionDiff(() => {
                        setOptimisticDiff(e.target.checked);
                        setDiffQuery(e.target.checked);
                      });
                    }}
                    className='h-6 w-6 cursor-pointer appearance-none'
                  />
                  {optimisticDiff ? (
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

          <div className='hidden w-auto items-center justify-end sm:flex'>
            {' '}
            {/* Hidden on small screens */}
            <div className='flex items-center gap-2'>
              <button
                onClick={() => {
                  startTransitionVersion(() => {
                    setOptimisticVersion(0);
                    setVersionQuery(0);
                  });
                }}
                disabled={optimisticVersion === 0}
                className={`flex h-8 items-center justify-center px-1 text-sm ${
                  optimisticVersion === 0
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
                aria-label='Go to first version'
              >
                <FirstSvg
                  className={`${optimisticVersion === 0 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                  width={24}
                  height={24}
                />
              </button>

              <button
                onClick={() => {
                  startTransitionVersion(() => {
                    setOptimisticVersion(Math.max(0, optimisticVersion - 1));
                    setVersionQuery(Math.max(0, optimisticVersion - 1));
                  });
                }}
                disabled={optimisticVersion === 0}
                className={`flex h-8 items-center justify-center px-1 text-sm ${
                  optimisticVersion === 0
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
                aria-label='Go to previous version'
              >
                <PreviousSvg
                  className={`${optimisticVersion === 0 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                  width={24}
                  height={24}
                />
              </button>
              <div className='flex h-8 items-center justify-center gap-2 text-sm'>
                {versionTypeText} {optimisticVersion + 1} of {totalVersions}
              </div>

              <button
                onClick={() => {
                  startTransitionVersion(() => {
                    setOptimisticVersion(
                      Math.min(totalVersions - 1, optimisticVersion + 1)
                    );
                    setVersionQuery(
                      Math.min(totalVersions - 1, optimisticVersion + 1)
                    );
                  });
                }}
                disabled={optimisticVersion === totalVersions - 1}
                className={`flex h-8 items-center justify-center px-1 text-sm ${
                  optimisticVersion === totalVersions - 1
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
                aria-label='Go to next version'
              >
                <NextSvg
                  className={`${optimisticVersion === totalVersions - 1 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                  width={24}
                  height={24}
                />
              </button>
              <button
                onClick={() => {
                  startTransitionVersion(() => {
                    setOptimisticVersion(totalVersions - 1);
                    setVersionQuery(totalVersions - 1);
                  });
                }}
                disabled={optimisticVersion === totalVersions - 1}
                className={`flex h-8 items-center justify-center px-1 text-sm ${
                  optimisticVersion === totalVersions - 1
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
                aria-label='Go to last version'
              >
                <LastSvg
                  className={`${optimisticVersion === totalVersions - 1 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                  width={24}
                  height={24}
                />
              </button>
            </div>
          </div>

          <button
            className='order-2 flex cursor-pointer items-center gap-4 hover:underline sm:pr-2'
            onClick={() => {
              setExpanded(!expanded);
              setView(ViewEnum.FULL);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label='Show comments and votes'
          >
            <ArrowSvg className='rotate-180' width={24} height={24} />
            <div className='text-sm'>Comments and Votes</div>
          </button>
        </div>
      </div>
    </div>
  );
};
