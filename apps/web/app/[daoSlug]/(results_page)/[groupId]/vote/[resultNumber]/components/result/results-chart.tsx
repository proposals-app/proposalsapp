'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { format, toZonedTime } from 'date-fns-tz';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';
import { ProcessedResults } from '@/lib/results_processing';
import { useTheme } from 'next-themes';
import superjson, { SuperJSONResult } from 'superjson';

interface ResultsChartProps {
  results: SuperJSONResult;
}

export function ResultsChart({ results }: ResultsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const deserializedResults: ProcessedResults = superjson.deserialize(results);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!deserializedResults.timeSeriesData) return;

    const themeColors = {
      axisLabel: theme == 'dark' ? 'var(--neutral-300)' : 'var(--neutral-500)',
      gridLine: theme == 'dark' ? 'var(--neutral-600)' : 'var(--neutral-300)',
      axisLine: theme == 'dark' ? 'var(--neutral-600)' : 'var(--neutral-300)',
      quorumLine: theme == 'dark' ? 'var(--neutral-50)' : 'var(--neutral-900)',
      quorumLabel: {
        text: theme == 'dark' ? 'var(--neutral-800)' : 'var(--neutral-50)',
        background:
          theme == 'dark' ? 'var(--neutral-200)' : 'var(--neutral-600)',
        border: theme == 'dark' ? 'var(--neutral-50)' : 'var(--neutral-900)',
      },
      tooltip: {
        background: theme == 'dark' ? '#27272A' : '#FFFFFF', // neutral-800 : white
        border: theme == 'dark' ? '#3F3F46' : '#E4E4E7', // neutral-700 : neutral-200
        text: theme == 'dark' ? '#F4F4F5' : '#27272A', // neutral-100 : neutral-800
      },
    };

    const chart = echarts.init(chartRef.current, null, { renderer: 'svg' });

    const isRankedChoice = deserializedResults.voteType === 'ranked-choice';

    // Calculate cumulative data for each choice
    const cumulativeData: { [choice: number]: [Date, number][] } = {};

    deserializedResults.choices.forEach((_, choiceIndex) => {
      cumulativeData[choiceIndex] = [];
      let cumulative = 0;

      deserializedResults.timeSeriesData?.forEach((point) => {
        const value = point.values[choiceIndex] || 0;
        cumulative += value;
        cumulativeData[choiceIndex].push([point.timestamp, cumulative]);
      });
    });

    // Get last known values for sorting
    const lastKnownValues: { [choice: number]: number } = {};
    deserializedResults.choices.forEach((_, choiceIndex) => {
      if (isRankedChoice) {
        // For ranked-choice, use the raw values from the last time series point
        const lastPoint =
          deserializedResults.timeSeriesData?.[
            deserializedResults.timeSeriesData.length - 1
          ];
        lastKnownValues[choiceIndex] = lastPoint?.values[choiceIndex] || 0;
      } else {
        // For other vote types, use the cumulative values
        const choiceData = cumulativeData[choiceIndex];
        lastKnownValues[choiceIndex] =
          choiceData.length > 0 ? choiceData[choiceData.length - 1][1] : 0;
      }
    });

    // Sort choices by voting power
    const explicitOrder = ['For', 'Abstain'];
    const sortedChoices = [...deserializedResults.choices].sort((a, b) => {
      const indexA = explicitOrder.indexOf(a);
      const indexB = explicitOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return (
        lastKnownValues[deserializedResults.choices.indexOf(b)] -
        lastKnownValues[deserializedResults.choices.indexOf(a)]
      );
    });

    const sortedChoiceIndices = sortedChoices.map((choice) =>
      deserializedResults.choices.indexOf(choice)
    );

    // Create series for each choice
    const series: echarts.SeriesOption[] = sortedChoiceIndices
      .map((choiceIndex) => {
        const choice = deserializedResults.choices[choiceIndex];
        const color = deserializedResults.choiceColors[choiceIndex];
        const shouldStack =
          deserializedResults.quorumChoices.includes(choiceIndex) &&
          deserializedResults.quorum !== null;

        let zIndex;
        if (choice === 'Against') {
          zIndex = 3;
        } else if (choice === 'For') {
          zIndex = 2;
        } else if (choice === 'Abstain') {
          zIndex = 1;
        } else {
          zIndex = 0;
        }

        // Get the data points for this choice with proper typing
        const seriesData: [Date, number][] = isRankedChoice
          ? deserializedResults.timeSeriesData?.map((point) => [
              point.timestamp,
              point.values[choiceIndex] || 0,
            ]) || []
          : cumulativeData[choiceIndex] || [];

        // Get the last value for extrapolation
        const lastPoint =
          seriesData.length > 0 ? seriesData[seriesData.length - 1] : null;
        const lastValue = lastPoint ? lastPoint[1] : 0;
        const lastTimestamp = lastPoint ? lastPoint[0] : null;

        // Create main series
        const mainSeries: echarts.SeriesOption = {
          name: choice,
          type: 'line',
          step: 'end',
          stack: shouldStack ? 'QuorumTotal' : undefined,
          lineStyle: {
            width: 2,
            color: color,
            opacity: 1,
          },
          showSymbol: false,
          itemStyle: {
            color: color,
            opacity: 0.9,
          },
          emphasis: {
            itemStyle: {
              color: color,
              borderColor: color,
            },
          },
          areaStyle: shouldStack
            ? {
                opacity: 0.9,
                color: color,
              }
            : undefined,
          data: seriesData,
          z: zIndex,
        };

        // Only create extrapolated series if we have data points
        if (lastPoint && lastTimestamp) {
          // Create extrapolated series
          const extrapolatedSeries: echarts.SeriesOption = {
            name: `${choice} (projected)`,
            type: 'line',
            step: 'end',
            stack: shouldStack ? 'QuorumTotalExtrapolated' : undefined,
            lineStyle: {
              width: 2,
              color: color,
              type: 'dashed',
              opacity: 0.25,
            },
            showSymbol: false,
            itemStyle: {
              color: color,
              opacity: 0.25,
            },
            areaStyle: shouldStack
              ? {
                  opacity: 0.175,
                  color: color,
                }
              : undefined,
            data: [
              [lastTimestamp, lastValue],
              [deserializedResults.proposal.endAt, lastValue],
            ],
            z: zIndex - 0.1,
          };

          return [mainSeries, extrapolatedSeries];
        }

        return [mainSeries];
      })
      .flat();

    // Add the "Total" series for ranked-choice voting
    let totalSeriesMaxValue = 0;
    if (isRankedChoice) {
      const totalSeriesData = deserializedResults.timeSeriesData.map(
        (point) => {
          const totalValue =
            (point.values as Record<string | number, number>)[
              'Winning threshold'
            ] || 0;
          totalSeriesMaxValue = Math.max(totalSeriesMaxValue, totalValue); // Track the max value of the Total series
          return [point.timestamp, totalValue];
        }
      );

      const totalSeries: echarts.SeriesOption = {
        name: 'Winning threshold',
        type: 'line',
        lineStyle: {
          width: 2,
          color: '#6B7280', // Grey color for the total series
          type: 'dashed', // Make the line dashed
        },
        showSymbol: false,
        emphasis: {
          itemStyle: {
            color: '#6B7280',
            borderColor: '#6B7280',
          },
        },
        data: totalSeriesData,
        z: 0, // Default z-index
      };
      series.push(totalSeries);
    }

    // Add quorum line if needed
    if (deserializedResults.quorum !== null) {
      series.push({
        name: 'Quorum',
        type: 'line',
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: themeColors.quorumLine,
            type: 'solid',
            width: 2,
          },
          data: [
            {
              yAxis: deserializedResults.quorum,
              label: {
                formatter: () => {
                  if (deserializedResults.quorum !== null)
                    return `{bold|${formatNumberWithSuffix(deserializedResults.quorum)}} Quorum needed`;
                  return '';
                },
                color: themeColors.quorumLabel.text,
                rich: {
                  bold: {
                    fontWeight: 'bold',
                  },
                },
                position: 'insideStartTop',
                fontSize: 12,
                backgroundColor: themeColors.quorumLabel.background,
                borderColor: themeColors.quorumLabel.border,
                borderWidth: 1,
                borderRadius: 2,
                padding: [4, 8],
                offset: [-4, 15],
              },
            },
          ],
        },
      });
    }

    // Calculate y-axis max
    const maxVotingValue = Math.max(
      ...Object.values(lastKnownValues),
      totalSeriesMaxValue, // Include the max value from the Total series
      deserializedResults.quorum || 0
    );
    const yAxisMax = roundToGoodValue(maxVotingValue * 1.1);

    const options: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: themeColors.tooltip.background,
        borderColor: themeColors.tooltip.border,
        textStyle: {
          color: themeColors.tooltip.text,
        },
      },
      xAxis: {
        type: 'time',
        min: new Date(
          deserializedResults.proposal.startAt.getTime() -
            (deserializedResults.proposal.endAt.getTime() -
              deserializedResults.proposal.startAt.getTime()) *
              0.01
        ),
        max: new Date(
          deserializedResults.proposal.endAt.getTime() +
            (deserializedResults.proposal.endAt.getTime() -
              deserializedResults.proposal.startAt.getTime()) *
              0.01
        ),
        axisLabel: {
          // Remove the original x-axis labels
          show: false,
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: themeColors.axisLine,
          },
        },
      },
      yAxis: {
        type: 'value',
        max: yAxisMax,
        axisLabel: {
          color: themeColors.axisLabel,
          formatter: (value: number) => formatNumberWithSuffix(value),
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: themeColors.axisLine,
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: themeColors.gridLine,
          },
        },
      },
      series,
      grid: {
        left: '0%',
        right: '0%',
        bottom: 8,
        top: 8,
        containLabel: true,
      },
    };

    chart.setOption(options);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [
    deserializedResults.timeSeriesData,
    deserializedResults.choices,
    deserializedResults.choiceColors,
    deserializedResults.proposal.startAt,
    deserializedResults.proposal.endAt,
    deserializedResults.quorum,
    deserializedResults.quorumChoices,
    deserializedResults.voteType,
    deserializedResults.votes,
    theme,
  ]);

  return (
    <div className='flex flex-col'>
      <div ref={chartRef} className='h-[400px] w-full' />
      <div className='flex w-full justify-between pl-2'>
        <div className='mt-2 text-center'>
          <p className='text-sm font-bold text-neutral-500 dark:text-neutral-300'>
            {format(
              toZonedTime(
                new Date(deserializedResults.proposal.startAt),
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ),
              'MMM d'
            )}
          </p>
          <p className='text-sm text-neutral-500 dark:text-neutral-300'>
            at{' '}
            {format(
              toZonedTime(
                new Date(deserializedResults.proposal.startAt),
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ),
              'h:mm a'
            )}
          </p>
        </div>
        <div className='mt-1 text-center'>
          <p className='text-sm font-bold text-neutral-500 dark:text-neutral-300'>
            {format(
              toZonedTime(
                new Date(deserializedResults.proposal.endAt),
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ),
              'MMM d'
            )}
          </p>
          <p className='text-sm text-neutral-500 dark:text-neutral-300'>
            at{' '}
            {format(
              toZonedTime(
                new Date(deserializedResults.proposal.endAt),
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ),
              'h:mm a'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to round up to the nearest "good" value
const roundToGoodValue = (value: number): number => {
  const exponent = Math.floor(Math.log10(value)); // Get the magnitude of the number
  const magnitude = Math.pow(10, exponent); // Get the base magnitude (e.g., 10, 100, 1000)
  const normalized = value / magnitude; // Normalize the value to the base magnitude

  // Define rounding increments based on the normalized value
  if (normalized <= 1.5) {
    return 1.5 * magnitude;
  } else if (normalized <= 2) {
    return 2 * magnitude;
  } else if (normalized <= 2.5) {
    return 2.5 * magnitude;
  } else if (normalized <= 3) {
    return 3 * magnitude;
  } else if (normalized <= 4) {
    return 4 * magnitude;
  } else if (normalized <= 5) {
    return 5 * magnitude;
  } else if (normalized <= 7.5) {
    return 7.5 * magnitude;
  } else {
    return 10 * magnitude;
  }
};

export function LoadingChart() {
  return (
    <div className='flex h-[380px] w-full items-center justify-center'>
      <div className='w-full space-y-4'>
        {/* Chart area placeholder */}
        <div className='relative h-[320px] w-full'>
          {/* Y-axis labels */}
          <div className='absolute top-0 left-0 flex h-full w-16 flex-col justify-between py-4'>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700'
              />
            ))}
          </div>

          {/* Chart grid lines */}
          <div className='absolute inset-0 ml-16'>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='border-b border-neutral-200 dark:border-neutral-700'
                style={{ height: `${100 / 5}%` }}
              />
            ))}
          </div>

          {/* Loading lines */}
          <div className='absolute inset-0 mt-4 ml-16 flex flex-col justify-around'>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='h-1 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700'
                style={{
                  opacity: 1 - i * 0.2,
                  width: `${100 - i * 15}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* X-axis labels */}
        <div className='flex justify-between pl-16'>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className='h-4 w-8 animate-pulse rounded bg-neutral-200 sm:w-20 dark:bg-neutral-700'
            />
          ))}
        </div>
      </div>
    </div>
  );
}
