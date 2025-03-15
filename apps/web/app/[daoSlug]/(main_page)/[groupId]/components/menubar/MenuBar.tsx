'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { BodyViewBar } from './BodyViewBar';
import { CommentsViewBar } from './CommentsViewBar';
import { FullViewBar } from './FullViewBar';
import CheckSvg from '@/public/assets/web/check.svg';
import React, { useState, useRef, useEffect } from 'react';
import { BodyVersionType } from '../../actions';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';

// Custom SelectContext to manage state
const SelectContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedValue: string;
  onSelectValue: (value: string) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
  selectedValue: '',
  onSelectValue: () => {},
});

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

export const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider
      value={{
        isOpen,
        setIsOpen,
        selectedValue: value,
        onSelectValue: onValueChange,
      }}
    >
      <div className='relative'>{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext);

  return (
    <button
      type='button'
      aria-haspopup='listbox'
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={`flex h-8 cursor-pointer items-center justify-between rounded-xs px-3 text-sm
        outline-none ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
      <span className='ml-2'>
        <ChevronDownSvg width={24} height={24} className='opacity-70' />
      </span>
    </button>
  );
};

export const SelectValue = ({ children }: { children: React.ReactNode }) => {
  return <span>{children}</span>;
};

export const SelectContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={`dark:border-neutral-450 absolute z-[999] mt-1 overflow-hidden rounded-xs border
        border-neutral-800 bg-white p-1 shadow-lg will-change-transform
        dark:bg-neutral-950 ${className}`}
      role='listbox'
    >
      <div className='p-1'>{children}</div>
    </div>
  );
};

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
}

export const SharedSelectItem = ({ children, value }: SelectItemProps) => {
  const { selectedValue, onSelectValue, setIsOpen } =
    React.useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      role='option'
      aria-selected={isSelected}
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm
        text-neutral-800 transition-colors will-change-transform outline-none
        hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
      onClick={() => {
        onSelectValue(value);
        setIsOpen(false);
      }}
    >
      <span>{children}</span>
      {isSelected && (
        <span className='absolute right-2'>
          <CheckSvg
            className='fill-neutral-800 dark:fill-neutral-200'
            width={24}
            height={24}
          />
        </span>
      )}
    </div>
  );
};

export const voteFilters = [
  {
    value: VotesFilterEnum.ALL,
    label: 'with any ARB',
  },
  {
    value: VotesFilterEnum.FIFTY_THOUSAND,
    label: 'above 50k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_HUNDRED_THOUSAND,
    label: 'above 500k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_MILLION,
    label: 'above 5m ARB',
  },
];

export const feedFilters = [
  {
    value: FeedFilterEnum.COMMENTS_AND_VOTES,
    label: 'Comments and Votes',
  },
  {
    value: FeedFilterEnum.COMMENTS,
    label: 'Only Comments',
  },
  {
    value: FeedFilterEnum.VOTES,
    label: 'Only Votes',
  },
];

export enum ViewEnum {
  BODY = 'body',
  FULL = 'full',
  COMMENTS = 'comments',
}

interface MenuBarProps {
  bodyVersions: BodyVersionType[];
  currentVersion: number;
  expanded: boolean;
  diff: boolean;
}

export const MenuBar = ({
  bodyVersions,
  currentVersion,
  expanded,
  diff,
}: MenuBarProps) => {
  const [view, setView] = useState(ViewEnum.FULL);

  const includesProposals = bodyVersions.some(
    (version) => version.type === 'onchain' || version.type === 'offchain'
  );

  return (
    <div className='font-condensed flex w-full justify-center'>
      <FullViewBar
        view={view}
        setView={setView}
        includesProposals={includesProposals}
      />

      {view == ViewEnum.BODY && (
        <BodyViewBar
          bodyVersions={bodyVersions}
          currentVersion={currentVersion}
          view={view}
          setView={setView}
          expanded={expanded}
          diff={diff}
        />
      )}
      {view == ViewEnum.COMMENTS && (
        <CommentsViewBar
          view={view}
          setView={setView}
          includesProposals={includesProposals}
        />
      )}
    </div>
  );
};
