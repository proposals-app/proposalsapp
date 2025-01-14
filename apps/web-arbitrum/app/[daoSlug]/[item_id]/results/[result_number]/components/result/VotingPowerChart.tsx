"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { format } from "date-fns";
import { formatNumberWithSuffix } from "@/lib/utils";
import { ProcessedResults, ProposalMetadata } from "./../actions";

interface VotingPowerChartProps {
  results: ProcessedResults;
}

export function VotingPowerChart({ results }: VotingPowerChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const metadata = results.proposal.metadata as ProposalMetadata;
    const isRankedChoice = metadata.voteType === "ranked-choice";

    // Calculate cumulative data for each choice
    const cumulativeData: { [choice: number]: [string, number][] } = {};
    if (!isRankedChoice) {
      results.choices.forEach((_, choiceIndex) => {
        cumulativeData[choiceIndex] = [];
        let cumulative = 0;

        results.timeSeriesData.forEach((point) => {
          cumulative += point.values[choiceIndex] || 0;
          cumulativeData[choiceIndex].push([point.timestamp, cumulative]);
        });
      });
    }

    // Get last known values for sorting
    const lastKnownValues: { [choice: number]: number } = {};
    results.choices.forEach((_, choiceIndex) => {
      if (isRankedChoice) {
        // For ranked-choice, use the raw values from the last time series point
        const lastPoint =
          results.timeSeriesData[results.timeSeriesData.length - 1];
        lastKnownValues[choiceIndex] = lastPoint?.values[choiceIndex] || 0;
      } else {
        // For other vote types, use the cumulative values
        const choiceData = cumulativeData[choiceIndex];
        lastKnownValues[choiceIndex] =
          choiceData.length > 0 ? choiceData[choiceData.length - 1][1] : 0;
      }
    });

    // Sort choices by voting power
    const explicitOrder = ["For", "Abstain"];
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
      results.choices.indexOf(choice),
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
        if (choice === "Against") {
          zIndex = 3; // Highest z-index
        } else if (choice === "For") {
          zIndex = 2; // Middle z-index
        } else if (choice === "Abstain") {
          zIndex = 1; // Lowest z-index
        } else {
          zIndex = 0; // Default for other choices
        }

        return {
          name: choice,
          type: "line",
          stack: shouldStack ? "QuorumTotal" : undefined,
          lineStyle: {
            width: shouldStack ? 0 : 2,
            color: color,
          },
          showSymbol: false,
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
            ? results.timeSeriesData.map((point) => [
                point.timestamp,
                point.values[choiceIndex] || 0,
              ])
            : cumulativeData[choiceIndex],
          z: zIndex,
        };
      },
    );

    // Add the "Total" series for ranked-choice voting
    let totalSeriesMaxValue = 0;
    if (isRankedChoice) {
      const totalSeriesData = results.timeSeriesData.map((point) => {
        const totalValue =
          (point.values as Record<string | number, number>)[
            "Winning threshold"
          ] || 0;
        totalSeriesMaxValue = Math.max(totalSeriesMaxValue, totalValue); // Track the max value of the Total series
        return [point.timestamp, totalValue];
      });

      const totalSeries: echarts.SeriesOption = {
        name: "Winning threshold",
        type: "line",
        lineStyle: {
          width: 2,
          color: "#6B7280", // Grey color for the total series
          type: "dashed", // Make the line dashed
        },
        showSymbol: false,
        emphasis: {
          itemStyle: {
            color: "#6B7280",
            borderColor: "#6B7280",
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
        name: "Quorum",
        type: "line",
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: {
            color: "#F43F5E",
            type: "solid",
            width: 2,
          },
          data: [
            {
              yAxis: results.quorum,
              label: {
                formatter: `${formatNumberWithSuffix(results.quorum)} Quorum threshold`,
                position: "insideEndTop",
                fontSize: 12,
                fontWeight: "bold",
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
      results.quorum || 0,
    );
    const yAxisMax = roundToGoodValue(maxVotingValue * 1.1);

    const options: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          let tooltipText = `<strong>${format(new Date(params[0].axisValue), "MMM d, HH:mm")}</strong><br/>`;
          params.forEach((param: any) => {
            if (param.seriesName !== "Quorum") {
              tooltipText += `
                <div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;"></span>
                  <span>${param.seriesName}: ${formatNumberWithSuffix(param.value[1])}</span>
                </div>`;
            }
          });
          return tooltipText;
        },
      },
      xAxis: {
        type: "time",
        min: new Date(results.proposal.timeStart).getTime(),
        max: new Date(results.proposal.timeEnd).getTime(),
        axisLabel: {
          formatter: (value: number) => format(new Date(value), "MMM d, HH:mm"),
        },
      },
      yAxis: {
        type: "value",
        max: yAxisMax,
        axisLabel: {
          formatter: (value: number) => formatNumberWithSuffix(value),
        },
      },
      series,
      grid: {
        left: "10%",
        right: "10%",
        bottom: "15%",
        containLabel: true,
      },
    };

    chart.setOption(options);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [results]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
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
