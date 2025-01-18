"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { format, toZonedTime } from "date-fns-tz";
import { formatNumberWithSuffix } from "@/lib/utils";
import { ProcessedResults } from "../actions";

interface ResultsChartProps {
  results: ProcessedResults;
}

export function ResultsChart({ results }: ResultsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const isRankedChoice = results.voteType === "ranked-choice";
    const isWeighted = results.voteType === "weighted";

    // Calculate cumulative data for each choice
    const cumulativeData: { [choice: number]: [string, number][] } = {};
    results.choices.forEach((_, choiceIndex) => {
      cumulativeData[choiceIndex] = [];
      let cumulative = 0;

      results.timeSeriesData.forEach((point) => {
        if (isWeighted) {
          // For weighted votes, use the normalized values directly
          cumulative += point.values[choiceIndex] || 0;
        } else {
          cumulative += point.values[choiceIndex] || 0;
        }
        cumulativeData[choiceIndex].push([point.timestamp, cumulative]);
      });
    });

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
            color: "#4b5563",
            type: "solid",
            width: 2,
          },
          data: [
            {
              yAxis: results.quorum,
              label: {
                formatter: () => {
                  // Use ECharts' text styling capabilities
                  if (results.quorum !== null)
                    return `{bold|${formatNumberWithSuffix(results.quorum)}} Quorum threshold`;
                  return "";
                },
                rich: {
                  bold: {
                    fontWeight: "bold",
                    color: "#4b5563",
                  },
                },
                position: "insideStartTop", // Position the label on the left
                fontSize: 12,
                backgroundColor: "#e5e7eb", // Background color
                borderColor: "#4b5563", // Border color
                borderWidth: 1, // Border width
                borderRadius: 12, // Rounded corners
                padding: [4, 8], // Padding
                offset: [-5, 15], // Move the label slightly above the line
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          let tooltipText = `<strong>${format(toZonedTime(new Date(params[0].axisValue), "UTC"), "MMM d, HH:mm")} UTC</strong><br/>`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        min: toZonedTime(new Date(results.proposal.timeStart), "UTC").getTime(),
        max:
          toZonedTime(new Date(results.proposal.timeEnd), "UTC").getTime() +
          5 * 60 * 1000,
        axisLabel: {
          formatter: (value: number) =>
            format(toZonedTime(new Date(value), "UTC"), "MMM d, HH:mm") +
            " UTC",
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
