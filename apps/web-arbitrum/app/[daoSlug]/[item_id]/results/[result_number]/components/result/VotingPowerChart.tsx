"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { format } from "date-fns";
import { formatNumberWithSuffix } from "@/lib/utils";

interface VotingPowerChartProps {
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export const VotingPowerChart = ({
  proposal,
  votes,
}: VotingPowerChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize the ECharts instance
    const chart = echarts.init(chartRef.current);

    // Group votes by choice and accumulate voting power over time
    const choices = proposal.choices as string[];
    const dataByChoice: { [key: number]: { time: Date; power: number }[] } = {};

    // Initialize data structure for each choice
    choices.forEach((_, index) => {
      dataByChoice[index] = [];
    });

    // Sort votes by timestamp (handle null values)
    const sortedVotes = [...votes].sort((a, b) => {
      const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
      const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
      return timeA - timeB;
    });

    // Accumulate voting power over time for each choice
    sortedVotes.forEach((vote) => {
      const choiceIndex = vote.choice as number;
      const votingPower = Number(vote.votingPower);
      const timestamp = vote.timeCreated
        ? new Date(vote.timeCreated)
        : new Date();

      if (!dataByChoice[choiceIndex]) {
        dataByChoice[choiceIndex] = [];
      }

      // Get the last entry for this choice
      const lastEntry =
        dataByChoice[choiceIndex][dataByChoice[choiceIndex].length - 1];
      const cumulativePower = lastEntry
        ? lastEntry.power + votingPower
        : votingPower;

      // Add the new cumulative point
      dataByChoice[choiceIndex].push({
        time: timestamp,
        power: cumulativePower,
      });
    });

    // Prepare the series data for the chart
    const series: echarts.LineSeriesOption[] = choices.map((choice, index) => ({
      name: choice,
      type: "line",
      data: dataByChoice[index].map((entry) => [
        format(entry.time, "yyyy-MM-dd HH:mm"),
        entry.power,
      ]),
      smooth: true,
      lineStyle: {
        width: 2,
      },
      showSymbol: false, // Hide dots on the line
    }));

    // Set the chart options
    const options: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const hoveredTime = new Date(params[0].axisValue).getTime(); // The time the user is hovering over
          let tooltipText = `<strong>${new Date(hoveredTime).toLocaleString()}</strong><br/>`;

          // Iterate through each series to find the closest data point
          series.forEach((s) => {
            const seriesData = s.data as [string, number][]; // Data points for this series
            let closestPoint: [string, number] | null = null;
            let closestDistance = Infinity;

            // Find the closest data point to the hovered time
            seriesData.forEach((point) => {
              const pointTime = new Date(point[0]).getTime();
              const distance = Math.abs(pointTime - hoveredTime);

              if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = point;
              }
            });

            const seriesName = s.name;

            // Add the closest point to the tooltip
            if (closestPoint) {
              tooltipText += `
                      <div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                        <span>${seriesName}: ${formatNumberWithSuffix(closestPoint[1])}</span>
                      </div>`;
            }
          });

          return tooltipText;
        },
      },
      xAxis: {
        type: "time",
        name: "Time",
        axisLabel: {
          formatter: (value: number) => format(new Date(value), "MMM d, HH:mm"),
        },
      },
      yAxis: {
        type: "value",
        nameLocation: "middle",
        nameGap: 30,
      },
      legend: {
        data: choices,
        bottom: 0,
      },
      series,
      grid: {
        left: "10%",
        right: "10%",
        bottom: "15%",
        containLabel: true,
      },
    };

    // Set the options and render the chart
    chart.setOption(options);

    // Handle window resize
    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [proposal, votes]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
};
