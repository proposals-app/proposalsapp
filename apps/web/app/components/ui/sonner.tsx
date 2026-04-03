'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useAppTheme } from '@/app/components/providers/app-theme-provider';

const Toaster = ({ ...props }: ToasterProps) => {
  const { mode } = useAppTheme();

  return (
    <Sonner
      theme={mode}
      className='toaster group'
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
