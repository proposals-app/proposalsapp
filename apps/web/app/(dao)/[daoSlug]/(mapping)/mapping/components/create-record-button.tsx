'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { callMappingApi } from '../api-client';
import { Button } from './ui';

export function CreateRecordButton({
  operation,
  children,
}: {
  operation: 'groups.create' | 'delegates.create';
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      type='button'
      variant='primary'
      fullWidth
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        try {
          await callMappingApi({ operation });
          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Mapping request failed'
          );
        } finally {
          setIsPending(false);
        }
      }}
    >
      {isPending ? 'Creating…' : children}
    </Button>
  );
}
