'use client';

import CheckSvg from '@/public/assets/web/check.svg';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useContext,
} from 'react';

// Custom SelectContext to manage state
const SelectContext = createContext<{
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  selectedValue: string | number; // Allow both string and number values
  onSelectValue: (value: string | number) => void; // Allow both string and number values
}>({
  isOpen: false,
  setIsOpen: () => {},
  selectedValue: '',
  onSelectValue: () => {},
});

interface SelectProps {
  value: string | number; // Allow both string and number values
  onValueChange: (value: string | number) => void; // Allow both string and number values
  children: ReactNode;
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

interface SelectTriggerProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  withChevron?: boolean; // Optional prop to control chevron display
}

export const SelectTrigger = ({
  children,
  className = '',
  'aria-label': ariaLabel,
  withChevron = true,
}: SelectTriggerProps) => {
  const { isOpen, setIsOpen } = useContext(SelectContext);

  return (
    <button
      type='button'
      aria-haspopup='listbox'
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={`flex h-8 cursor-pointer items-center justify-between rounded-xs px-3 text-sm outline-none ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
      {withChevron && (
        <span className='ml-2'>
          <ChevronDownSvg width={24} height={24} className='opacity-70' />
        </span>
      )}
    </button>
  );
};

export const SelectValue = ({ children }: { children: ReactNode }) => {
  return <span>{children}</span>;
};

interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export const SelectContent = ({
  children,
  className = '',
}: SelectContentProps) => {
  const { isOpen, setIsOpen } = useContext(SelectContext);
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

  // Prevent body scroll when dropdown is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className='fixed inset-0 z-[2998] bg-black/50 sm:hidden'
        onClick={() => setIsOpen(false)}
      />

      <div
        ref={contentRef}
        className={`dark:border-neutral-450 absolute z-[2999] min-w-48 overflow-hidden border border-neutral-800 bg-white will-change-transform dark:bg-neutral-950 ${className} fixed inset-x-4 bottom-4 mt-0 sm:absolute sm:inset-auto sm:bottom-auto sm:mt-1`}
        role='listbox'
      >
        <div className='max-h-[50vh] overflow-auto p-1 sm:max-h-none'>
          {children}
        </div>
      </div>
    </>
  );
};

interface SelectItemProps {
  children: ReactNode;
  value: string | number; // Allow both string and number values
}

export const SelectItem = ({ children, value }: SelectItemProps) => {
  const { selectedValue, onSelectValue, setIsOpen } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      role='option'
      aria-selected={isSelected}
      className={`group relative flex cursor-pointer items-center py-3 pr-10 pl-4 text-base font-bold text-neutral-800 will-change-transform outline-none hover:bg-neutral-100 sm:py-2 sm:pl-2 sm:text-sm dark:text-neutral-200 dark:hover:bg-neutral-800`} // Adjusted styles for mobile and desktop
      onClick={() => {
        onSelectValue(value);
        setIsOpen(false);
      }}
    >
      <span>{children}</span>
      {isSelected && (
        <span className='absolute right-2'>
          <CheckSvg
            className='fill-neutral-800 group-hover:fill-neutral-900 dark:fill-neutral-200 dark:group-hover:fill-neutral-100'
            width={24}
            height={24}
          />
        </span>
      )}
    </div>
  );
};
