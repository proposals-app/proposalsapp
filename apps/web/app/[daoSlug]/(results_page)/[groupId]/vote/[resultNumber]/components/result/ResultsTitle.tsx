import { format } from 'date-fns';
import Link from 'next/link';
import ExternalLinkIcon from '@/public/assets/web/arrow_external_link.svg';
import OnchainIcon from '@/public/assets/web/onchain.svg';
import OffchainIcon from '@/public/assets/web/offchain.svg';
import { DelegateInfo } from '../actions';

interface ResultsTitleProps {
  processedResults: {
    proposal: {
      name: string;
      createdAt: Date;
      url: string;
    };
  };
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
  processedResults,
  onChain,
  publisher,
  governor,
}: ResultsTitleProps) {
  return (
    <div className='flex h-28 flex-col gap-2'>
      <div className='text-2xl font-bold'>{processedResults.proposal.name}</div>
      <div className='flex items-center gap-2 text-xs'>
        <div>
          Published {onChain ? 'onchain' : 'offchain'} by{' '}
          <span className='font-bold'>
            {publisher?.ens ?? publisher?.address}
          </span>{' '}
          at{' '}
          <span className='font-bold'>
            {format(processedResults.proposal.createdAt, 'MMM d, yyyy')}
          </span>
        </div>
        <Link
          className='flex items-center gap-1 rounded-xs bg-neutral-100 px-1 dark:bg-neutral-800'
          href={processedResults.proposal.url}
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
