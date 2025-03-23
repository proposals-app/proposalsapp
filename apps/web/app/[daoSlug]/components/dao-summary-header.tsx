import Image from 'next/image';
import { formatNumberWithSuffix } from '@/lib/utils';

interface DaoSummaryHeaderProps {
  daoName: string;
  daoSlug: string;
  activeGroupsCount: number;
  totalProposalsCount: number;
  totalTopicsCount: number;
  tokenPrice: number | null;
  marketCap: number | null;
  treasuryBalance: number | null;
}

export function DaoSummaryHeader({
  daoName,
  daoSlug,
  activeGroupsCount,
  totalProposalsCount,
  totalTopicsCount,
  tokenPrice,
  marketCap,
  treasuryBalance,
}: DaoSummaryHeaderProps) {
  const DAO_PICTURE_PATH = 'assets/project-logos/arbitrum';

  const primaryMetrics = [
    {
      value: activeGroupsCount,
      label: 'Active',
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-50 dark:bg-green-900/20',
      format: (v: number) => v,
    },
    {
      value: totalProposalsCount,
      label: 'Proposals',
      colorClass: 'text-blue-700 dark:text-blue-400',
      bgClass: 'bg-blue-50 dark:bg-blue-900/20',
      format: (v: number) => v,
    },
    {
      value: totalTopicsCount,
      label: 'Discussions',
      colorClass: 'text-neutral-800 dark:text-neutral-200',
      bgClass: 'bg-neutral-100 dark:bg-neutral-800/50',
      format: (v: number) => v,
    },
  ];

  const financialMetrics = [
    {
      value: tokenPrice,
      label: 'Token Price',
      colorClass: 'text-purple-700 dark:text-purple-400',
      bgClass: 'bg-purple-50 dark:bg-purple-900/20',
      format: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      value: marketCap,
      label: 'Market Cap',
      colorClass: 'text-orange-700 dark:text-orange-400',
      bgClass: 'bg-orange-50 dark:bg-orange-900/20',
      format: (v: number) => `$${formatNumberWithSuffix(v)}`,
    },
    {
      value: treasuryBalance,
      label: 'Treasury',
      colorClass: 'text-teal-700 dark:text-teal-400',
      bgClass: 'bg-teal-50 dark:bg-teal-900/20',
      format: (v: number) => `$${formatNumberWithSuffix(v)}`,
    },
  ];

  return (
    <div className='mb-8 overflow-hidden border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800/50'>
      <div className='flex w-full flex-row'>
        {/* Left side - Main content and primary metrics */}
        <div className='flex w-full flex-col content-between justify-between'>
          {/* Header content */}
          <div className='p-6'>
            <div className='flex flex-row items-center space-y-0 space-x-8'>
              <div className='relative flex h-20 w-20 items-center justify-center rounded-full border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800'>
                <Image
                  src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}.svg`}
                  alt={daoName || daoSlug}
                  width={64}
                  height={64}
                  className='dark:hidden'
                />
                <Image
                  src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}_dark.svg`}
                  alt={daoName || daoSlug}
                  width={64}
                  height={64}
                  className='hidden dark:block'
                />
              </div>

              <div className='flex-1'>
                <h1 className='text-2xl font-bold text-neutral-800 sm:text-3xl dark:text-neutral-100'>
                  {daoName || daoSlug}
                </h1>
                <p className='mt-1.5 text-sm text-neutral-500 dark:text-neutral-400'>
                  Governance discussions and proposals
                </p>
              </div>
            </div>
          </div>

          {/* Primary metrics */}
          <div className='flex w-full items-start'>
            <div className='mt-auto border-t border-r border-neutral-200 dark:border-neutral-700'>
              <div className='flex divide-x divide-neutral-200 dark:divide-neutral-700'>
                {primaryMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={`flex w-1/3 flex-1 flex-col items-center justify-center p-4 text-center ${metric.bgClass}`}
                  >
                    {metric.value !== null ? (
                      <span
                        className={`text-lg font-bold ${metric.colorClass}`}
                      >
                        {metric.format(metric.value)}
                      </span>
                    ) : (
                      <span className='text-lg font-bold text-neutral-700 dark:text-neutral-300'>
                        N/A
                      </span>
                    )}
                    <span className='mt-1 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400'>
                      {metric.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Financial metrics */}
        <div className='flex flex-col divide-y divide-neutral-200 border-l border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700'>
          {financialMetrics.map((metric) => (
            <div
              key={metric.label}
              className={`flex h-1/3 flex-1 flex-col items-center justify-center p-4 ${metric.bgClass}`}
            >
              {metric.value !== null ? (
                <span className={`text-lg font-bold ${metric.colorClass}`}>
                  {metric.format(metric.value)}
                </span>
              ) : (
                <span className='text-lg font-bold text-neutral-700 dark:text-neutral-300'>
                  N/A
                </span>
              )}
              <span className='mt-1 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400'>
                {metric.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
