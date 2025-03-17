'use client';

import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useQueryState, parseAsInteger, parseAsBoolean } from 'nuqs';
import { BodyVersionType } from '../../actions';
import CheckSvg from '@/public/assets/web/check.svg';
import React from 'react';

// Custom SelectContext to manage state
const SelectContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedValue: number;
  onSelectValue: (value: number) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
  selectedValue: 0,
  onSelectValue: () => {},
});

interface SelectProps {
  value: number;
  onValueChange: (value: number) => void;
  children: React.ReactNode;
}

const Select = ({ value, onValueChange, children }: SelectProps) => {
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

const SelectTrigger = ({
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
      className={`flex cursor-pointer items-center justify-between rounded-xs px-3 py-1.5 text-sm
        outline-none ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
    </button>
  );
};

const SelectContent = ({
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
      className={`dark:border-neutral-450 absolute z-[1999] mt-1 overflow-hidden rounded-xs border
        border-neutral-800 bg-white font-bold will-change-transform dark:bg-neutral-950
        ${className}`}
      role='listbox'
    >
      <div className='p-1'>{children}</div>
    </div>
  );
};

interface SelectItemProps {
  children: React.ReactNode;
  value: number;
}

const SelectItem = ({ children, value }: SelectItemProps) => {
  const { selectedValue, onSelectValue, setIsOpen } =
    React.useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      role='option'
      aria-selected={isSelected}
      className='relative flex w-48 cursor-pointer items-center py-2 pr-10 pl-2 text-sm
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

// Helper component to display the time with a tooltip
export function PostedRevisions({ versions }: { versions: BodyVersionType[] }) {
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(
    versions.length - 1
  );
  const [, setVersionQuery] = useQueryState(
    'version',
    parseAsInteger
      .withDefault(versions.length - 1)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  const handleVersionSelect = (index: number) => {
    setSelectedVersionIndex(index);
    setVersionQuery(index);
    setExpanded(true);
  };

  const latestVersion = versions[selectedVersionIndex];

  const relativeTime = formatDistanceToNow(new Date(latestVersion.createdAt), {
    addSuffix: true,
  });

  return (
    <div className='relative'>
      <Select value={selectedVersionIndex} onValueChange={handleVersionSelect}>
        <SelectTrigger aria-label='Select version'>
          <div className='dark:text-neutral-350 flex flex-col text-xs text-neutral-600'>
            <span>
              {latestVersion.type === 'topic'
                ? 'discourse revision'
                : latestVersion.type === 'onchain'
                  ? 'onchain revision'
                  : 'offchain revision'}
            </span>
            <span className='font-bold'>{relativeTime}</span>
          </div>
          <Image
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/edit-icon-posted-time.svg`}
            alt={''}
            width={24}
            height={24}
          />
        </SelectTrigger>
        <SelectContent>
          {versions.map((version, index) => (
            <SelectItem key={index} value={index}>
              {version.type === 'topic'
                ? `Discourse Version ${index + 1}`
                : version.type === 'onchain'
                  ? `Onchain Version ${index + 1}`
                  : `Offchain Version ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
