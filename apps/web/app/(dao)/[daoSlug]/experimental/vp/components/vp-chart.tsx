'use client';

import { format, toZonedTime } from 'date-fns-tz';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';
import superjson, { type SuperJSONResult } from 'superjson';
import type { VoterRankData, VpRankingReturnType } from '../actions';
import { SkeletonChart } from '@/app/components/ui/skeleton';

interface VpChartProps {
  chartData: SuperJSONResult;
}

// Helper function to format address or ENS
function formatVoterName(voter: VoterRankData): string {
  if (voter.ens) {
    return voter.ens;
  }
  if (voter.voterAddress) {
    return `${voter.voterAddress.slice(0, 6)}...${voter.voterAddress.slice(
      -4
    )}`;
  }
  return 'Unknown Voter';
}

export function VpChart({ chartData }: VpChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const deserializedData: VpRankingReturnType =
    superjson.deserialize(chartData);

  useEffect(() => {
    if (!chartRef.current || !deserializedData?.voters?.length) return;

    const getCookie = (name: string): string | undefined => {
      if (typeof document === 'undefined') return undefined;
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

    const themeColors = {
      axisLabel: theme === 'dark' ? '#ced6da' : '#637783', // neutral-300 : neutral-500
      splitLine: theme === 'dark' ? '#374249' : '#e1e6e9', // neutral-700 : neutral-200
      axisLine: theme === 'dark' ? '#47555d' : '#ced6da', // neutral-600 : neutral-300
      tooltip: {
        background: theme === 'dark' ? '#14181a' : '#f9fafb', // neutral-900 : neutral-50
        border: theme === 'dark' ? '#374249' : '#e1e6e9', // neutral-700 : neutral-200
        text: theme === 'dark' ? '#f4f5f6' : '#21272b', // neutral-100 : neutral-800
      },
      textStyle: theme === 'dark' ? '#F1EBE7' : '#14181A', // Generic text
    };

    const chart = echarts.init(chartRef.current, null, { renderer: 'svg' });

    const seriesList: echarts.SeriesOption[] = deserializedData.voters.map(
      (voter) => {
        // Map ranks to [index, rank] for categorical x-axis
        const dataPoints = voter.ranks.map((rank, index) => [index, rank]);

        return {
          name: formatVoterName(voter),
          type: 'line',
          smooth: true, // Make lines smooth
          symbol: 'circle', // Optional: add symbols for points
          symbolSize: 6, // Size of symbols
          emphasis: {
            focus: 'series',
          },
          endLabel: {
            show: true,
            formatter: '{a}', // Display series name (voter name)
            distance: 15, // Adjust distance from line end
            color: themeColors.textStyle,
            fontSize: 12, // Smaller font for end labels
          },
          lineStyle: {
            width: 3, // Slightly thinner lines
          },
          data: dataPoints,
          // Connect null data points (optional, depends on desired look)
          connectNulls: true,
        };
      }
    );

    // Format timestamps for the x-axis labels
    const formattedTimestamps = deserializedData.timestamps.map((ts) =>
      format(
        toZonedTime(
          new Date(ts),
          Intl.DateTimeFormat().resolvedOptions().timeZone
        ),
        'MMM d' // Format like "Jul 20"
      )
    );

    const option: echarts.EChartsOption = {
      title: {
        left: 'center',
        textStyle: {
          color: themeColors.textStyle,
        },
      },
      grid: {
        left: 40, // Increased left margin for rank labels
        right: 140, // Increased right margin for end labels
        bottom: 50, // Increased bottom margin for date labels
        containLabel: false, // Allow labels to go outside grid
      },
      xAxis: {
        type: 'category',
        splitLine: {
          show: true, // Show vertical grid lines
          lineStyle: {
            color: themeColors.splitLine,
          },
        },
        axisLabel: {
          margin: 15, // Space between label and axis
          fontSize: 12,
          color: themeColors.axisLabel,
        },
        axisLine: {
          lineStyle: {
            color: themeColors.axisLine,
          },
        },
        boundaryGap: false, // No gap at the ends
        data: formattedTimestamps,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          margin: 15,
          fontSize: 12,
          formatter: '#{value}',
          color: themeColors.axisLabel,
        },
        axisLine: {
          show: true, // Show Y axis line
          lineStyle: {
            color: themeColors.axisLine,
          },
        },
        splitLine: {
          lineStyle: {
            color: themeColors.splitLine,
          },
        },
        inverse: true, // Rank 1 at the top
        interval: 1, // Show every rank
        min: 1,
        max: 20, // Limit to top 10 ranks
      },
      series: seriesList,
      animationDuration: 800, // Faster animation
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [deserializedData]); // Add theme dependency

  return (
    <div ref={chartRef} style={{ width: '100%', height: '600px' }} /> // Ensure container has dimensions
  );
}

export function LoadingChart() {
  return <SkeletonChart />;
}
