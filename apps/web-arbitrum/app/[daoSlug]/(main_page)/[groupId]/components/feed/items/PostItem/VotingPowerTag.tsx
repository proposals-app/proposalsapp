import { formatNumberWithSuffix } from '@/lib/utils';

export async function VotingPowerTag({ vp }: { vp: number }) {
  return (
    <div>
      {vp && (
        <div className='text-neutral-650 flex w-fit gap-4 rounded-sm border border-neutral-300 bg-neutral-100 p-0.5 px-2 text-xs'>
          {formatNumberWithSuffix(vp)} ARB
        </div>
      )}
    </div>
  );
}
