import { format } from 'date-fns';
import Link from 'next/link';
import ExternalLinkIcon from '@/public/assets/web/icons/external-link.svg';
import OnchainIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainIcon from '@/public/assets/web/icons/offchain.svg';
import type { DelegateInfo } from '../actions';
import superjson, { type SuperJSONResult } from 'superjson';
import type { ProcessedResults } from '@/lib/results_processing';

interface ResultsTitleProps {
  results: SuperJSONResult;
  onChain: boolean;
  publisher: DelegateInfo | null;
  governor: {
    id: string;
    daoId: string;
    name: string | null;
    enabled: boolean;
    portalUrl: string | null;
  } | null;
}

export function ResultsTitle({
  results,
  onChain,
  publisher,
  governor,
}: ResultsTitleProps) {
  const deserializedResults: ProcessedResults = superjson.deserialize(results);

  return (
    <div className='flex h-28 flex-col gap-2'>
      <div className='text-2xl font-bold'>
        {deserializedResults.proposal.name}
      </div>
      <div className='flex items-center gap-2 text-xs'>
        <div>
          Published {onChain ? 'onchain' : 'offchain'} by{' '}
          <span className='font-bold'>
            {publisher?.ens ?? publisher?.address}
          </span>{' '}
          at{' '}
          <span className='font-bold'>
            {format(deserializedResults.proposal.createdAt, 'MMM d, yyyy')}
          </span>
        </div>
        <Link
          className='flex items-center gap-1 rounded-xs bg-neutral-100 px-1 dark:bg-neutral-800'
          href={deserializedResults.proposal.url}
          target='_blank'
        >
          {onChain ? (
            <OnchainIcon
              width={24}
              height={24}
              alt={'Go to governor'}
              className='fill-neutral-800 dark:fill-neutral-200'
            />
          ) : (
            <OffchainIcon
              width={24}
              height={24}
              alt={'Go to governor'}
              className='fill-neutral-800 dark:fill-neutral-200'
            />
          )}
          <div className='font-bold text-neutral-800 dark:text-neutral-200'>
            {governor?.name ?? 'Unknown Governor'}
          </div>
          <ExternalLinkIcon
            width={24}
            height={24}
            alt={'Go to governor'}
            className='fill-neutral-400'
          />
        </Link>
      </div>
    </div>
  );
}
