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
        'relative h-screen w-full snap-start snap-always overflow-hidden',
        className
      )}
      style={{ background }}
      {...props}
    >
      {children}
    </section>
  );
}
