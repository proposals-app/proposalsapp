'use client';

import { formatNumberWithSuffix } from '@/lib/utils';
import { format, toZonedTime } from 'date-fns-tz';
import * as echarts from 'echarts';
import { useEffect, useMemo, useRef } from 'react';
import type { ProcessedResults } from '@/lib/results_processing';
import superjson, { type SuperJSONResult } from 'superjson';
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { SkeletonChart } from '@/app/components/ui/skeleton';

interface ResultsChartProps {
  results: SuperJSONResult;
}

// Helper function to round up to the nearest "good" value
const roundToGoodValue = (value: number): number => {
  if (value <= 0) return 10; // Handle zero or negative input gracefully
  const exponent = Math.floor(Math.log10(value)); // Get the magnitude of the number
  const magnitude = Math.pow(10, exponent); // Get the base magnitude (e.g., 10, 100, 1000)
  const normalized = value / magnitude; // Normalize the value to the base magnitude

  // Define rounding increments based on the normalized value
  if (normalized <= 1.5) return 1.5 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 3) return 3 * magnitude;
  if (normalized <= 4) return 4 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  if (normalized <= 7.5) return 7.5 * magnitude;
  return 10 * magnitude; // Equivalent to 1 * magnitude * 10
};

export function ResultsChart({ results }: ResultsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Memoize deserialized results to prevent unnecessary re-calculations if the SuperJSONResult object reference remains the same
  // Note: This might not be strictly necessary if the parent component ensures `results` prop stability,
  // but it adds a layer of robustness against potential re-renders.
  const deserializedResults: ProcessedResults = useMemo(
    () => superjson.deserialize(results),
    [results]
  );

  useEffect(() => {
    if (!chartRef.current) return;
    if (!deserializedResults.timeSeriesData) return;

    // Function to get cookie value by name
    const getCookie = (name: string): string | undefined => {
      if (typeof document === 'undefined') return undefined; // Guard for SSR or environments without document
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
          return cookieValue;
        }
      }
      return undefined;
    };

    const themeModeCookie = getCookie('theme-mode');
    const theme: 'dark' | 'light' =
      themeModeCookie === 'light' ? 'light' : 'dark';

    // Helper function to get computed style - ensure documentElement exists
    const getStyle = (property: string): string => {
      if (typeof document === 'undefined' || !document.documentElement)
        return ''; // Guard for SSR
      return getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim();
    };

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

    // Initialize ECharts instance
    const chart = echarts.init(chartRef.current, null, { renderer: 'svg' });

    const isRankedChoice = deserializedResults.voteType === 'ranked-choice';

    // Calculate cumulative data for non-ranked-choice votes
    const cumulativeData: { [choice: number]: [Date, number][] } = {};
    if (!isRankedChoice) {
      deserializedResults.choices.forEach((_, choiceIndex) => {
        cumulativeData[choiceIndex] = [];
        let cumulative = 0;
        // Ensure timeSeriesData exists before iterating
        deserializedResults.timeSeriesData?.forEach((point) => {
          const value = point.values[choiceIndex] || 0;
          cumulative += value;
          // Ensure timestamp is a valid Date object
          if (
            point.timestamp instanceof Date &&
            !isNaN(point.timestamp.getTime())
          ) {
            cumulativeData[choiceIndex].push([point.timestamp, cumulative]);
          }
        });
        // Sort cumulative data by timestamp just in case source data wasn't sorted
        cumulativeData[choiceIndex].sort(
          (a, b) => a[0].getTime() - b[0].getTime()
        );
      });
    }

    // Get last known values for sorting choices
    const lastKnownValues: { [choice: number]: number } = {};
    deserializedResults.choices.forEach((_, choiceIndex) => {
      const lastPoint =
        deserializedResults.timeSeriesData?.[
          deserializedResults.timeSeriesData.length - 1
        ];
      if (isRankedChoice) {
        lastKnownValues[choiceIndex] = lastPoint?.values[choiceIndex] || 0;
      } else {
        const choiceData = cumulativeData[choiceIndex];
        lastKnownValues[choiceIndex] =
          choiceData.length > 0 ? choiceData[choiceData.length - 1][1] : 0;
      }
    });

    // Sort choices: Explicitly order 'For', 'Abstain', then sort remaining by last known value descending
    const forExists = deserializedResults.choices.includes('For');
    const sortedChoices = [...deserializedResults.choices].sort((a, b) => {
      const indexA = deserializedResults.choices.indexOf(a);
      const indexB = deserializedResults.choices.indexOf(b);

      // Special handling for 'Abstain' when 'For' is missing
      if (!forExists) {
        if (a === 'Abstain') return 1; // Move 'Abstain' down relative to anything else
        if (b === 'Abstain') return -1; // Move 'Abstain' down relative to anything else
        // If neither is 'Abstain', proceed to value sort
      }

      // Standard explicit order ('For', 'Abstain') when 'For' exists
      if (forExists) {
        const explicitOrder = ['For', 'Abstain'];
        const explicitIndexA = explicitOrder.indexOf(a);
        const explicitIndexB = explicitOrder.indexOf(b);

        if (explicitIndexA !== -1 && explicitIndexB !== -1) {
          return explicitIndexA - explicitIndexB; // Both are explicit, sort by their order
        }
        if (explicitIndexA !== -1) return -1; // a is explicit, b is not; a comes first
        if (explicitIndexB !== -1) return 1; // b is explicit, a is not; b comes first
        // If neither is explicitly ordered, proceed to value sort
      }

      // Fallback: Sort remaining by value descending (applies if not handled above)
      return lastKnownValues[indexB] - lastKnownValues[indexA];
    });

    const sortedChoiceIndices = sortedChoices.map((choice) =>
      deserializedResults.choices.indexOf(choice)
    );

    const proposalStartTime = new Date(deserializedResults.proposal.startAt);
    const proposalEndTime = new Date(deserializedResults.proposal.endAt);

    // Create series for each choice
    const series: echarts.SeriesOption[] = sortedChoiceIndices
      .map((choiceIndex) => {
        const choice = deserializedResults.choices[choiceIndex];
        const color = deserializedResults.choiceColors[choiceIndex];
        const shouldStack =
          deserializedResults.quorumChoices.includes(choiceIndex) &&
          deserializedResults.quorum !== null;

        let zIndex;
        if (choice === 'Against') zIndex = 3;
        else if (choice === 'For') zIndex = 2;
        else if (choice === 'Abstain') zIndex = 1;
        else zIndex = 0;

        // Get the data points for this choice
        let seriesData: [Date, number][] = isRankedChoice
          ? deserializedResults.timeSeriesData
              ?.map((point): [Date, number] | null => {
                // Ensure timestamp is valid before mapping
                if (
                  point.timestamp instanceof Date &&
                  !isNaN(point.timestamp.getTime())
                ) {
                  return [point.timestamp, point.values[choiceIndex] || 0];
                }
                return null;
              })
              .filter((p): p is [Date, number] => p !== null) || [] // Filter out nulls
          : cumulativeData[choiceIndex] || [];

        // Prepend the starting point at 0, ensuring it's a valid Date
        if (
          proposalStartTime instanceof Date &&
          !isNaN(proposalStartTime.getTime())
        ) {
          seriesData = [[proposalStartTime, 0], ...seriesData];
        }

        // Get the last *actual* data point (ignoring the prepended start point if no other data exists)
        const lastActualPoint =
          seriesData.length > 1 ? seriesData[seriesData.length - 1] : null;
        const lastValue = lastActualPoint ? lastActualPoint[1] : 0;
        const lastTimestamp = lastActualPoint ? lastActualPoint[0] : null;

        // Create main series
        const mainSeries: echarts.SeriesOption = {
          name: choice,
          type: 'line',
          step: 'end',
          stack: shouldStack ? 'QuorumTotal' : undefined,
          lineStyle: { width: 2, color, opacity: 1 },
          showSymbol: false,
          itemStyle: { color, opacity: 0.9 },
          emphasis: { itemStyle: { color, borderColor: color } },
          areaStyle: shouldStack ? { opacity: 0.9, color } : undefined,
          data: seriesData,
          z: zIndex,
        };

        const seriesResult: echarts.SeriesOption[] = [mainSeries];

        // Only create extrapolated series if:
        // 1. There is at least one actual data point (seriesData.length > 1).
        // 2. The last data point's timestamp is valid.
        // 3. The last data point's timestamp is strictly BEFORE the proposal end time.
        if (
          lastTimestamp &&
          lastTimestamp instanceof Date &&
          !isNaN(lastTimestamp.getTime()) &&
          proposalEndTime instanceof Date &&
          !isNaN(proposalEndTime.getTime()) &&
          lastTimestamp.getTime() < proposalEndTime.getTime() // Compare time values
        ) {
          const extrapolatedSeries: echarts.SeriesOption = {
            name: `${choice} (projected)`,
            type: 'line',
            step: 'end',
            stack: shouldStack ? 'QuorumTotalExtrapolated' : undefined, // Use a different stack
            lineStyle: {
              width: 2,
              color,
              type: 'dashed',
              opacity: 0.25,
            },
            showSymbol: false,
            itemStyle: { color, opacity: 0.25 },
            areaStyle: shouldStack ? { opacity: 0.175, color } : undefined,
            data: [
              [lastTimestamp, lastValue],
              [proposalEndTime, lastValue], // Extrapolate to proposal end time
            ],
            tooltip: { show: false }, // Don't show tooltip for extrapolated part
            z: zIndex - 0.1, // Ensure it's drawn slightly behind the main line
          };
          seriesResult.push(extrapolatedSeries);
        }

        return seriesResult;
      })
      .flat();

    // Add the "Winning threshold" series for ranked-choice voting
    let totalSeriesMaxValue = 0;
    if (isRankedChoice && deserializedResults.timeSeriesData) {
      let totalSeriesData = deserializedResults.timeSeriesData
        .map((point): [Date, number] | null => {
          const totalValue =
            (point.values as Record<string | number, number>)[
              'Winning threshold'
            ] || 0;
          // Ensure timestamp is valid before mapping
          if (
            point.timestamp instanceof Date &&
            !isNaN(point.timestamp.getTime())
          ) {
            totalSeriesMaxValue = Math.max(totalSeriesMaxValue, totalValue);
            return [point.timestamp, totalValue];
          }
          return null;
        })
        .filter((p): p is [Date, number] => p !== null); // Filter out nulls

      // Prepend the starting point at 0 for total series
      if (
        proposalStartTime instanceof Date &&
        !isNaN(proposalStartTime.getTime())
      ) {
        totalSeriesData = [[proposalStartTime, 0], ...totalSeriesData];
      }

      const totalSeries: echarts.SeriesOption = {
        name: 'Winning threshold',
        type: 'line',
        step: 'end', // Ensure threshold line also uses step: 'end'
        lineStyle: {
          width: 2,
          color:
            theme === 'dark'
              ? getStyle('--neutral-400')
              : getStyle('--neutral-700'),
          type: 'dashed',
        },
        showSymbol: false,
        emphasis: {
          itemStyle: {
            color:
              theme === 'dark'
                ? getStyle('--neutral-400')
                : getStyle('--neutral-700'),
            borderColor:
              theme === 'dark'
                ? getStyle('--neutral-400')
                : getStyle('--neutral-700'),
          },
        },
        data: totalSeriesData,
        z: 0, // Lower z-index
      };
      series.push(totalSeries);
    }

    // Add quorum line if needed
    if (deserializedResults.quorum !== null && deserializedResults.quorum > 0) {
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
                formatter: `{bold|${formatNumberWithSuffix(deserializedResults.quorum as number)}} Quorum needed`,
                color: themeColors.quorumLabel.text,
                rich: { bold: { fontWeight: 'bold' } },
                position: 'insideStartTop',
                fontSize: 12,
                backgroundColor: themeColors.quorumLabel.background,
                borderColor: themeColors.quorumLabel.border,
                borderWidth: 1,
                borderRadius: 2,
                padding: [4, 8],
                offset: [-4, 15], // Fine-tune offset if needed
              },
            },
          ],
        },
        tooltip: { show: false }, // Hide tooltip for markLine
      });
    }

    // Calculate y-axis max
    const maxVotingValue = Math.max(
      ...Object.values(lastKnownValues),
      totalSeriesMaxValue, // Include the max value from the Total series (if applicable)
      deserializedResults.quorum || 0 // Include quorum value
    );
    const yAxisMax = roundToGoodValue(maxVotingValue * 1.1); // Add 10% padding

    const options: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross', // Use crosshairs
          lineStyle: { color: themeColors.axisLabel },
          label: { show: false },
        },
        backgroundColor: themeColors.tooltip.background,
        borderColor: themeColors.tooltip.border,
        borderWidth: 1,
        textStyle: { color: themeColors.tooltip.text, fontSize: 12 },
        // Custom formatter to exclude extrapolated series and format values
        formatter: (
          params: TooltipComponentFormatterCallbackParams
        ): string => {
          type TooltipSeriesData = {
            color: string;
            value: number;
          };

          // ECharts can pass a single object or an array, standardize to array
          const paramsArray = Array.isArray(params) ? params : [params];

          if (paramsArray.length === 0 || !paramsArray[0]?.value) return '';

          // Assuming value is [timestamp, number] or similar
          const firstValueArray = paramsArray[0].value as unknown[];
          const pointTime =
            firstValueArray[0] instanceof Date
              ? firstValueArray[0]
              : new Date(firstValueArray[0] as number | string);

          if (isNaN(pointTime.getTime())) return ''; // Invalid date

          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const zonedTime = toZonedTime(pointTime, timeZone);
          const formattedDate = format(zonedTime, 'MMM d, yyyy, h:mm:ss a zzz');

          let tooltipHtml = `<div style="font-size: 10px; color: ${themeColors.axisLabel}; margin-bottom: 4px;">${formattedDate}</div>`;

          // Use a Map to store the first valid data point found for each unique series name
          const uniqueSeriesData = new Map<string, TooltipSeriesData>();

          // Populate the map, respecting the order within params only to get the *first* instance
          paramsArray.forEach((item) => {
            // Basic check for expected structure
            if (
              typeof item.seriesName === 'string' &&
              item.value &&
              typeof item.color === 'string' &&
              !item.seriesName.includes('(projected)') &&
              item.seriesName !== 'Quorum' &&
              !uniqueSeriesData.has(item.seriesName) // Add only if not already present
            ) {
              const valueArray = item.value as unknown[];
              // Check if the second element (the actual value) is a number
              if (valueArray.length > 1 && typeof valueArray[1] === 'number') {
                uniqueSeriesData.set(item.seriesName, {
                  color: item.color,
                  value: valueArray[1], // Value is the second element
                });
              }
            }
          });

          // Iterate through the explicitly sorted choices to build the tooltip HTML
          sortedChoices.forEach((choiceName: string) => {
            const data = uniqueSeriesData.get(choiceName);

            if (data) {
              const color = data.color;
              const value = data.value; // Already known to be number from map type
              const formattedValue = formatNumberWithSuffix(value);
              tooltipHtml += `
                                <div style="display: flex; align-items: center; margin-top: 2px;">
                                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; margin-right: 6px;"></span>
                                  <span>${choiceName}:</span>
                                  <span style="font-weight: bold; margin-left: auto; padding-left: 10px;">${formattedValue}</span>
                                </div>
                              `;
            }
            // If no data found for a choice in the map (e.g., value is 0 at this point), it won't be added.
          });

          return tooltipHtml;
        },
      },
      xAxis: {
        type: 'time',
        axisLabel: { show: false }, // Keep x-axis labels hidden as per original design
        axisLine: { show: true, lineStyle: { color: themeColors.axisLine } },
        axisTick: { show: false }, // Hide ticks for cleaner look
      },
      yAxis: {
        type: 'value',
        min: 0, // Ensure y-axis starts from 0
        max: yAxisMax,
        axisLabel: {
          color: themeColors.axisLabel,
          formatter: (value: number) => formatNumberWithSuffix(value),
          fontSize: 10, // Slightly smaller font size
          hideOverlap: true, // Hide labels if they overlap
        },
        axisLine: { show: true }, // Hide y-axis line for cleaner look
        splitLine: {
          show: true,
          lineStyle: { color: themeColors.gridLine, type: 'dashed' },
        }, // Dashed grid lines
        nameGap: 0, // Reduce gap if needed
        boundaryGap: [0, 0.05], // Small padding at the top
      },
      series,
      grid: {
        left: '0%',
        right: '0%',
        bottom: 8,
        top: 8,
        containLabel: true,
      },
      animationDuration: 300, // Faster animation
    };

    chart.setOption(options);

    // Resize observer for better handling of element resize
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
    // Ensure all dependencies derived from props or external state are included.
    // Basic types (string, number, boolean) usually don't need explicit listing if derived from listed objects/arrays.
  }, [deserializedResults]);

  // Display start/end times below the chart
  const renderTime = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null; // Invalid date
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const zonedTime = toZonedTime(date, timeZone);
      return (
        <div className='mt-1 text-center'>
          <p className='text-xs font-medium text-neutral-500 dark:text-neutral-400'>
            {format(zonedTime, 'MMM d')}
          </p>
          <p className='text-xs text-neutral-500 dark:text-neutral-400'>
            at {format(zonedTime, 'h:mm a')}
          </p>
        </div>
      );
    } catch (e) {
      console.error('Error formatting date:', e);
      return null;
    }
  };

  return (
    <div className='flex flex-col'>
      {/* Chart container */}
      <div ref={chartRef} className='h-[360px] w-full' />

      {/* Time labels container */}
      <div className='flex w-full justify-between px-2 sm:px-4'>
        {renderTime(deserializedResults.proposal.startAt)}
        {renderTime(deserializedResults.proposal.endAt)}
      </div>
    </div>
  );
}

// --- Loading Chart Component (Unchanged from original) ---

export function LoadingChart() {
  return <SkeletonChart />;
}
