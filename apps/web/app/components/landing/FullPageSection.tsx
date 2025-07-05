import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FullPageSectionProps {
  children: ReactNode;
  className?: string;
  background?: string;
  'data-theme'?: string;
}

export function FullPageSection({
  children,
  className,
  background,
  ...props
}: FullPageSectionProps) {
  return (
    <section
      className={cn(
        'relative w-full snap-start snap-always overflow-hidden',
        // Use custom viewport height for Safari compatibility
        'h-screen-safe',
        className
      )}
      style={{ background }}
      {...props}
    >
      {children}
    </section>
  );
}
