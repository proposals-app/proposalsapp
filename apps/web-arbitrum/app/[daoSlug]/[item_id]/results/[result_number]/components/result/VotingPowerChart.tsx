"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { format, addHours, startOfHour } from "date-fns";
import { formatNumberWithSuffix } from "@/lib/utils";

interface ProposalMetadata {
  quorumChoices?: number[];
}

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

    const chart = echarts.init(chartRef.current);
    const choices = proposal.choices as string[];
    const metadata = proposal.metadata as ProposalMetadata;
    const quorumChoices = metadata.quorumChoices || [];

    // Sort votes by timestamp
    const sortedVotes = [...votes].sort((a, b) => {
      const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
      const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
      return timeA - timeB;
    });

    // Find start and end times
    const startTime =
      sortedVotes.length > 0
        ? startOfHour(new Date(sortedVotes[0].timeCreated!))
        : startOfHour(new Date());
    const endTime =
      sortedVotes.length > 0
        ? startOfHour(
            addHours(
              new Date(sortedVotes[sortedVotes.length - 1].timeCreated!),
              1,
            ),
          )
        : startOfHour(addHours(new Date(), 1));

    // Create hourly intervals
    const hourlyData: {
      [hour: string]: { [choice: number]: number };
    } = {};

    // Initialize all hours with zero values
    let currentHour = startTime;
    while (currentHour <= endTime) {
      const hourKey = format(currentHour, "yyyy-MM-dd HH:mm");
      hourlyData[hourKey] = {};
      choices.forEach((_, index) => {
        hourlyData[hourKey][index] = 0;
      });
      currentHour = addHours(currentHour, 1);
    }

    // Aggregate votes by hour
    sortedVotes.forEach((vote) => {
      const voteTime = startOfHour(new Date(vote.timeCreated!));
      const hourKey = format(voteTime, "yyyy-MM-dd HH:mm");
      const choiceIndex = vote.choice as number;
      const votingPower = Number(vote.votingPower);

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = {};
      }
      if (!hourlyData[hourKey][choiceIndex]) {
        hourlyData[hourKey][choiceIndex] = 0;
      }
      hourlyData[hourKey][choiceIndex] += votingPower;
    });

    // Convert to cumulative values and fill gaps
    const timePoints = Object.keys(hourlyData).sort();
    const cumulativeData: { [choice: number]: [string, number][] } = {};

    choices.forEach((_, choiceIndex) => {
      cumulativeData[choiceIndex] = [];
      let cumulative = 0;

      timePoints.forEach((timePoint) => {
        cumulative += hourlyData[timePoint][choiceIndex] || 0;
        cumulativeData[choiceIndex].push([timePoint, cumulative]);
      });
    });

    // Define gradient colors for the series
    const gradientColors = [
      ["#80FFA5", "#00DDFF"],
      ["#00DDFF", "#37A2FF"],
      ["#37A2FF", "#FF0087"],
      ["#FF0087", "#FFBF00"],
      ["#FFBF00", "#80FFA5"],
    ];

    // Create series
    const series: echarts.SeriesOption[] = choices.map((choice, index) => ({
      name: choice,
      type: "line",
      stack: quorumChoices.includes(index) ? "QuorumTotal" : undefined,
      lineStyle: {
        width: 0,
      },
      showSymbol: false,
      areaStyle: {
        opacity: 0.8,
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          {
            offset: 0,
            color: gradientColors[index % gradientColors.length][0],
          },
          {
            offset: 1,
            color: gradientColors[index % gradientColors.length][1],
          },
        ]),
      },
      data: cumulativeData[index],
    }));

    // Add quorum line if proposal has quorum
    if (proposal.quorum) {
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
              yAxis: Number(proposal.quorum),
              label: {
                formatter: `${formatNumberWithSuffix(proposal.quorum)} Quorum threshold`,
                position: "insideEndTop",
                fontSize: 12,
                fontWeight: "bold",
              },
            },
          ],
        },
      });
    }

    const options: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          let tooltipText = `<strong>${format(new Date(params[0].axisValue), "MMM d, HH:mm")}</strong><br/>`;

          params.forEach((param: any) => {
            if (param.seriesName !== "Quorum") {
              tooltipText += `
                <div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
                  <span>${param.seriesName}: ${formatNumberWithSuffix(param.value[1])}</span>
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
      yAxis: [
        {
          type: "value",
          nameLocation: "middle",
          nameGap: 30,
        },
      ],
      legend: {
        data: [...choices],
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

    chart.setOption(options);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [proposal, votes]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
};
