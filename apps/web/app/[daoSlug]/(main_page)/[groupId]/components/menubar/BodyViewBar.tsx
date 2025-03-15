'use client';

import { parseAsBoolean, parseAsInteger, useQueryState } from 'nuqs';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import NextSvg from '@/public/assets/web/next.svg';
import PreviousSvg from '@/public/assets/web/previous.svg';
import FirstSvg from '@/public/assets/web/first.svg';
import LastSvg from '@/public/assets/web/last.svg';
import CheckboxCheck from '@/public/assets/web/checkbox_check.svg';
import CheckboxNocheck from '@/public/assets/web/checkbox_nocheck.svg';
import { BodyVersionType, VersionType } from '../../actions';
import { ViewEnum } from './MenuBar';
import { useOptimistic, useTransition } from 'react';

interface BodyViewBarProps {
  bodyVersions: BodyVersionType[];
  currentVersion: number;
  view: ViewEnum;
  setView: (view: ViewEnum) => void;
  expanded: boolean;
  diff: boolean;
}

export const BodyViewBar = ({
  bodyVersions,
  currentVersion,
  view,
  setView,
  expanded,
  diff,
}: BodyViewBarProps) => {
  const totalVersions = bodyVersions.length;
  const versionTypes: VersionType[] = bodyVersions.map((body) => body.type);
  const [isExpandedPending, startTransitionExpanded] = useTransition();
  const [isDiffPending, startTransitionDiff] = useTransition();
  const [isVersionPending, startTransitionVersion] = useTransition();

  const [optimisticExpanded, setOptimisticExpanded] = useOptimistic(
    expanded,
    (currentExpanded, newExpanded: boolean) => newExpanded
  );

  const [optimisticDiff, setOptimisticDiff] = useOptimistic(
    diff,
    (currentDiff, newDiff: boolean) => newDiff
  );

  const [optimisticVersion, setOptimisticVersion] = useOptimistic(
    currentVersion,
    (currentVersionOptimistic, newVersion: number) => newVersion
  );

  const [, setExpandedQuery] = useQueryState(
    'expanded',
    parseAsBoolean
      .withDefault(false)
      .withOptions({ shallow: false, startTransition: startTransitionExpanded })
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
      className={`fixed bottom-0 z-50 mt-4 min-w-4xl self-center px-4 pb-4
        ${view === ViewEnum.BODY ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className='dark:border-neutral-450 flex w-full items-center justify-between gap-2
          rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm
          font-bold text-neutral-800 dark:bg-neutral-950 dark:fill-neutral-200
          dark:text-neutral-200'
      >
        <div className='flex w-full justify-between'>
          <div className='flex items-center gap-4'>
            <button
              className='flex cursor-pointer items-center gap-4 hover:underline'
              onClick={() => {
                if (optimisticExpanded) {
                  startTransitionExpanded(() => {
                    setOptimisticExpanded(false);
                    setExpandedQuery(false);
                    setView(ViewEnum.FULL);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  });
                }
              }}
            >
              <ArrowSvg width={24} height={24} />
            </button>

            <div className='flex h-8 cursor-pointer items-center justify-start gap-2 px-3'>
              <label
                htmlFor='changes'
                className='flex cursor-pointer items-center gap-2'
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
            >
              <PreviousSvg
                className={`${optimisticVersion === 0 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                width={24}
                height={24}
              />
            </button>
            <div className='flex h-8 w-full items-center justify-center gap-2 text-sm'>
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
            >
              <LastSvg
                className={`${optimisticVersion === totalVersions - 1 ? 'fill-neutral-300 dark:fill-neutral-600' : ''}`}
                width={24}
                height={24}
              />
            </button>
          </div>

          <button
            className='flex cursor-pointer items-center gap-4 hover:underline'
            onClick={() => {
              if (optimisticExpanded) {
                startTransitionExpanded(() => {
                  setOptimisticExpanded(false);
                  setExpandedQuery(false);
                  setView(ViewEnum.FULL);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                });
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
