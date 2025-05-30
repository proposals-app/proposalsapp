import Image from 'next/image';
import { formatNumberWithSuffix } from '@/lib/utils';

interface ArbitrumSummaryHeaderProps {
  activeGroupsCount: number;
  totalProposalsCount: number;
  totalTopicsCount: number;
  tokenPrice: number | null;
  totalVp: number | null;
  treasuryBalance: number | null;
}

export function ArbitrumSummaryHeader({
  activeGroupsCount,
  totalProposalsCount,
  totalTopicsCount,
  tokenPrice,
  totalVp,
  treasuryBalance,
}: ArbitrumSummaryHeaderProps) {
  const DAO_PICTURE_PATH = 'assets/project-logos/arbitrum';

  interface MetricItem {
    value: number;
    label: string;
    colorClass: string;
    bgClass: string;
    format: (v: number) => string | number;
  }

  const primaryMetrics: MetricItem[] = [
    {
      value: activeGroupsCount,
      label: 'Active',
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-50 dark:bg-green-900/20',
      format: (v: number) => v.toString(),
    },
    {
      value: totalProposalsCount,
      label: 'Proposals',
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-50 dark:bg-amber-900/20',
      format: (v: number) => v.toString(),
    },
    {
      value: totalTopicsCount,
      label: 'Discussions',
      colorClass: 'text-sky-800 dark:text-sky-200',
      bgClass: 'bg-sky-100 dark:bg-sky-800/50',
      format: (v: number) => v.toString(),
    },
  ];

  const financialMetrics: MetricItem[] = [
    {
      value: totalVp ?? 0,
      label: 'Voting Power',
      colorClass: 'text-[#28A0F0]/90', // Arbitrum blue
      bgClass: 'bg-[#28A0F0]/5 dark:bg-[#28A0F0]/10',
      format: (v: number) => `${formatNumberWithSuffix(v)} ARB`,
    },
    {
      value: treasuryBalance ?? 0,
      label: 'Treasury',
      colorClass: 'text-[#28A0F0]/90', // Arbitrum blue
      bgClass: 'bg-[#28A0F0]/5 dark:bg-[#28A0F0]/10',
      format: (v: number) => `$${formatNumberWithSuffix(v)}`,
    },
    {
      value: tokenPrice ?? 0,
      label: 'ARB Price',
      colorClass: 'text-[#28A0F0]/90', // Arbitrum blue
      bgClass: 'bg-[#28A0F0]/5 dark:bg-[#28A0F0]/10',
      format: (v: number) => `$${v.toFixed(2)}`,
    },
  ];

  const renderMetric = (metric: MetricItem) => (
    <div
      className={`flex h-full flex-col items-center justify-center p-4 text-center ${metric.bgClass}`}
    >
      {metric.value !== null ? (
        <span className={`font-semibold sm:text-lg ${metric.colorClass}`}>
          {metric.format(metric.value)}
        </span>
      ) : (
        <span className='font-semibold text-neutral-700 sm:text-lg dark:text-neutral-300'>
          N/A
        </span>
      )}

      <span className='dark:text-neutral-350 mt-1 text-xs font-medium text-neutral-600 sm:text-sm'>
        {metric.label}
      </span>
    </div>
  );

  return (
    <div className='mb-8 overflow-hidden rounded-xs border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800/50'>
      {/* Mobile layout */}
      <div className='block md:hidden'>
        {/* Header with profile picture */}
        <div className='p-6'>
          <div className='flex flex-row items-center space-x-4'>
            <div className='relative flex h-12 w-12 items-center justify-center rounded-full p-4'>
              <Image
                src={`/${DAO_PICTURE_PATH}.svg`}
                alt='Arbitrum'
                fill={true}
                className='dark:hidden'
              />
              <Image
                src={`/${DAO_PICTURE_PATH}_dark.svg`}
                alt='Arbitrum'
                fill={true}
                className='hidden dark:block'
              />
            </div>

            <div className='flex-1'>
              <h1 className='text-xl font-bold text-[#28A0F0] dark:text-[#3fcbff]'>
                Arbitrum DAO
              </h1>
              <p className='text-xm mt-1.5 text-neutral-500 dark:text-neutral-400'>
                Governance discussions and proposals
              </p>
            </div>
          </div>
        </div>

        {/* Primary metrics row */}
        <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
          {primaryMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`${index !== 0 ? 'border-l border-neutral-200 dark:border-neutral-700' : ''}`}
            >
              {renderMetric(metric)}
            </div>
          ))}
        </div>

        {/* Financial metrics row */}
        <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
          {financialMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`${index !== 0 ? 'h-full border-l border-neutral-200 dark:border-neutral-700' : 'h-full'}`}
            >
              {renderMetric(metric)}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop layout (hidden on mobile) */}
      <div className='hidden md:block'>
        <div className='grid grid-cols-5 grid-rows-3'>
          {/* Profile picture, name and description (spans col 1-3, rows 1-2) */}
          <div className='col-span-3 row-span-2 p-6'>
            <div className='flex flex-row items-center space-x-8'>
              <div className='relative flex h-16 w-16 items-center justify-center rounded-full p-4'>
                <Image
                  src={`/${DAO_PICTURE_PATH}.svg`}
                  alt='Arbitrum'
                  fill={true}
                  className='dark:hidden'
                />
                <Image
                  src={`/${DAO_PICTURE_PATH}_dark.svg`}
                  alt='Arbitrum'
                  fill={true}
                  className='hidden dark:block'
                />
              </div>

              <div className='flex-1'>
                <h1 className='text-3xl font-bold text-[#28A0F0] dark:text-[#3fcbff]'>
                  Arbitrum DAO
                </h1>
                <p className='mt-1.5 text-sm text-neutral-500 dark:text-neutral-400'>
                  Governance discussions and proposals
                </p>
              </div>
            </div>
          </div>

          {/* Column 4 is empty and auto-adjusts - no border */}
          <div className='col-start-4 col-end-5 row-span-3'></div>

          {/* Financial metrics in column 5 */}
          <div className='col-start-5 col-end-6 row-start-1 row-end-2 border-b border-l border-neutral-200 dark:border-neutral-700'>
            {renderMetric(financialMetrics[0])} {/* Token Price */}
          </div>
          <div className='col-start-5 col-end-6 row-start-2 row-end-3 border-b border-l border-neutral-200 dark:border-neutral-700'>
            {renderMetric(financialMetrics[1])} {/* Voting Power */}
          </div>
          <div className='col-start-5 col-end-6 row-start-3 row-end-4 border-l border-neutral-200 dark:border-neutral-700'>
            {renderMetric(financialMetrics[2])} {/* Treasury */}
          </div>

          {/* Primary metrics in row 3, columns 1-3 */}
          <div className='col-start-1 col-end-2 row-start-3 row-end-4 border-t border-r border-neutral-200 dark:border-neutral-700'>
            {renderMetric(primaryMetrics[0])} {/* Active */}
          </div>
          <div className='col-start-2 col-end-3 row-start-3 row-end-4 border-t border-r border-neutral-200 dark:border-neutral-700'>
            {renderMetric(primaryMetrics[1])} {/* Proposals */}
          </div>
          <div className='col-start-3 col-end-4 row-start-3 row-end-4 border-t border-r border-neutral-200 dark:border-neutral-700'>
            {renderMetric(primaryMetrics[2])} {/* Discussions */}
          </div>
        </div>
      </div>
    </div>
  );
}
