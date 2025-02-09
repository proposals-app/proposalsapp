'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { format, toZonedTime } from 'date-fns-tz';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';
import { DelegateInfo } from '../actions';
import { ProcessedResults } from '@/lib/results_processing';
import { useTheme } from 'next-themes';

interface ResultsChartProps {
  results: ProcessedResults;
  delegateMap: Map<string, DelegateInfo>;
}

const ACCUMULATE_VOTING_POWER_THRESHOLD = 50000;

export function ResultsChart({ results, delegateMap }: ResultsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!chartRef.current) return;
    if (!results.timeSeriesData) return;

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

    const isRankedChoice = results.voteType === 'ranked-choice';

    // Calculate cumulative data for each choice
    const cumulativeData: { [choice: number]: [Date, number][] } = {};

    results.choices.forEach((_, choiceIndex) => {
      cumulativeData[choiceIndex] = [];
      let cumulative = 0;

      results.timeSeriesData?.forEach((point) => {
        const value = point.values[choiceIndex] || 0;
        cumulative += value;
        cumulativeData[choiceIndex].push([point.timestamp, cumulative]);
      });
    });

    // Get last known values for sorting
    const lastKnownValues: { [choice: number]: number } = {};
    results.choices.forEach((_, choiceIndex) => {
      if (isRankedChoice) {
        // For ranked-choice, use the raw values from the last time series point
        const lastPoint =
          results.timeSeriesData?.[results.timeSeriesData.length - 1];
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
    const sortedChoices = [...results.choices].sort((a, b) => {
      const indexA = explicitOrder.indexOf(a);
      const indexB = explicitOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return (
        lastKnownValues[results.choices.indexOf(b)] -
        lastKnownValues[results.choices.indexOf(a)]
      );
    });

    const sortedChoiceIndices = sortedChoices.map((choice) =>
      results.choices.indexOf(choice)
    );

    // Create series for each choice
    const series: echarts.SeriesOption[] = sortedChoiceIndices.map(
      (choiceIndex) => {
        const choice = results.choices[choiceIndex];
        const color = results.choiceColors[choiceIndex];
        const shouldStack =
          results.quorumChoices.includes(choiceIndex) &&
          results.quorum !== null;

        let zIndex: number;
        if (choice === 'Against') {
          zIndex = 3; // Highest z-index
        } else if (choice === 'For') {
          zIndex = 2; // Middle z-index
        } else if (choice === 'Abstain') {
          zIndex = 1; // Lowest z-index
        } else {
          zIndex = 0; // Default for other choices
        }

        const significantPoints: [Date, number][] = [];
        let cumulativeValue = 0;
        results.timeSeriesData?.forEach((point) => {
          const value = point.values[choiceIndex] || 0;
          cumulativeValue += value;
          if (
            value >= ACCUMULATE_VOTING_POWER_THRESHOLD &&
            !significantPoints.find(
              (sigPoint) => sigPoint[0] === point.timestamp
            )
          ) {
            significantPoints.push([point.timestamp, cumulativeValue]);
          }
        });

        return {
          name: choice,
          type: 'line',
          step: 'end',
          stack: shouldStack ? 'QuorumTotal' : undefined,
          lineStyle: {
            width: shouldStack ? 0 : 2,
            color: color,
          },
          showSymbol: false, // Show symbols for significant points

          // symbol: (data) => {
          //   const isSignificant = significantPoints.find(
          //     (sigPoint) => sigPoint[0] === data[0]
          //   );
          //   return isSignificant ? 'square' : 'none';
          // },
          // symbolSize(value) {
          //   const selectedDate = new Date(value[0]);

          //   const timeSeriesPoint = results.votes?.find(
          //     (point) => point.createdAt.getTime() === selectedDate.getTime()
          //   );

          //   const votingPower = timeSeriesPoint?.votingPower ?? 0;

          //   // Use a power function to amplify the differences
          //   const baseSize = 1; // Minimum size
          //   const scalingFactor = 0.2; // Adjust this factor to control the scaling
          //   const size = baseSize + Math.pow(votingPower, scalingFactor);

          //   return size;
          // },
          itemStyle: {
            color: () => {
              return color;
            },
          },
          emphasis: {
            itemStyle: {
              color: color,
              borderColor: color,
            },
          },
          areaStyle: shouldStack
            ? {
                opacity: 0.8,
                color: color,
              }
            : undefined,
          data: isRankedChoice
            ? results.timeSeriesData?.map((point) => [
                point.timestamp,
                point.values[choiceIndex] || 0,
              ])
            : cumulativeData[choiceIndex],
          z: zIndex,
        };
      }
    );

    // Add the "Total" series for ranked-choice voting
    let totalSeriesMaxValue = 0;
    if (isRankedChoice) {
      const totalSeriesData = results.timeSeriesData.map((point) => {
        const totalValue =
          (point.values as Record<string | number, number>)[
            'Winning threshold'
          ] || 0;
        totalSeriesMaxValue = Math.max(totalSeriesMaxValue, totalValue); // Track the max value of the Total series
        return [point.timestamp, totalValue];
      });

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
    if (results.quorum !== null) {
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
              yAxis: results.quorum,
              label: {
                formatter: () => {
                  if (results.quorum !== null)
                    return `{bold|${formatNumberWithSuffix(results.quorum)}} Quorum needed`;
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
      results.quorum || 0
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const selectedDate = new Date(params.value[0]);

          // Get the data point that contains metadata
          const timeSeriesPoint = results.votes?.find(
            (point) => point.createdAt.getTime() === selectedDate.getTime()
          );

          let tooltipText = `<strong>${format(selectedDate, 'MMM d, HH:mm:ss')} UTC</strong><br/>`;

          // Add large vote information if available
          if (timeSeriesPoint) {
            const delegate = delegateMap.get(timeSeriesPoint.voterAddress);
            const voterName = delegate?.ens || timeSeriesPoint.voterAddress;

            tooltipText += `
              <div class='w-fit whitespace-nowrap flex flex-col'>
                <span>Voter: ${voterName}</span>
                <span>Power: ${formatNumberWithSuffix(timeSeriesPoint.votingPower)}</span>
                <div class='max-w-sm break-words whitespace-normal'>
                  <span>Choice: ${timeSeriesPoint.choiceText}</span>
                </div>
              </div>
            `;
          }

          return tooltipText;
        },
      },
      xAxis: {
        type: 'time',
        min: results.proposal.startAt,
        max: results.proposal.endAt,
        axisLabel: {
          color: themeColors.axisLabel,
          formatter: (value: number) => {
            const zonedDate = toZonedTime(new Date(value), 'UTC');
            const formattedDate = format(zonedDate, 'MMM d');
            const formattedTime = format(zonedDate, 'h:mm a').toLowerCase();

            return `{bold|${formattedDate}} at\n${formattedTime} UTC`;
          },
          hideOverlap: true,
          rich: {
            bold: {
              fontWeight: 'bold',
            },
          },
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
        bottom: '15%',
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
  }, [results, delegateMap, theme]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
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
    <div className='flex h-[400px] w-full items-center justify-center'>
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
        <div className='flex justify-between px-16'>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className='h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700'
            />
          ))}
        </div>
      </div>
    </div>
  );
}
