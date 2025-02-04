import { formatNumberWithSuffix } from '@/lib/utils';

export async function VotingPowerTag({ vp }: { vp: number }) {
  return (
    <div>
      {vp && (
        <div
          className='border-neutral-350 text-neutral-650 dark:text-neutral-350 flex w-fit gap-4
            rounded-sm border bg-neutral-100 p-0.5 px-2 text-xs dark:border-neutral-600
            dark:bg-neutral-900'
        >
          {formatNumberWithSuffix(vp)} ARB
        </div>
      )}
    </div>
  );
}
