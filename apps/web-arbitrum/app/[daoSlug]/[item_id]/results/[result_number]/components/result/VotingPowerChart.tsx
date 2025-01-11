"use client";

import React, { useEffect, useRef, useState } from "react";
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

const getColorForChoice = (choice: string): string => {
  const lowerCaseChoice = choice.toLowerCase();

  // Check if choice starts with any of the positive vote indicators
  if (/^(for|yes|yae)/.test(lowerCaseChoice)) {
    return "#10B981"; // Green
  }

  // Check if choice starts with any of the negative vote indicators
  if (/^(against|no|nay)/.test(lowerCaseChoice)) {
    return "#EF4444"; // Red
  }

  // Check for abstain
  if (lowerCaseChoice === "abstain") {
    return "#F59E0B"; // Yellow
  }

  // Fixed color palette for other choices
  const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#6EE7B7"];

  // Create a simple hash from the choice string
  const hash = Array.from(lowerCaseChoice).reduce(
    (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
    0,
  );

  // Use the absolute value of hash to get a valid index
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

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

    const sortedVotes = [...votes].sort((a, b) => {
      const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
      const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
      return timeA - timeB;
    });

    const startTime = startOfHour(new Date(proposal.timeStart));
    const lastVoteTime =
      sortedVotes.length > 0
        ? startOfHour(
            new Date(sortedVotes[sortedVotes.length - 1].timeCreated!),
          )
        : startTime;

    const hourlyData: { [hour: string]: { [choice: number]: number } } = {};

    let currentHour = startTime;
    while (currentHour <= lastVoteTime) {
      const hourKey = format(currentHour, "yyyy-MM-dd HH:mm");
      hourlyData[hourKey] = {};
      choices.forEach((_, index) => {
        hourlyData[hourKey][index] = 0;
      });
      currentHour = addHours(currentHour, 1);
    }

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

    const lastKnownValues: { [choice: number]: number } = {};
    choices.forEach((_, choiceIndex) => {
      const choiceData = cumulativeData[choiceIndex];
      if (choiceData.length > 0) {
        lastKnownValues[choiceIndex] = choiceData[choiceData.length - 1][1];
      } else {
        lastKnownValues[choiceIndex] = 0;
      }
    });

    const explicitOrder = ["For", "Abstain"];
    const sortedChoices = [...choices].sort((a, b) => {
      const indexA = explicitOrder.indexOf(a);
      const indexB = explicitOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      return (
        lastKnownValues[choices.indexOf(b)] -
        lastKnownValues[choices.indexOf(a)]
      );
    });

    const sortedChoiceIndices = sortedChoices.map((choice) =>
      choices.indexOf(choice),
    );

    const series: echarts.SeriesOption[] = sortedChoiceIndices.map(
      (originalIndex) => {
        const choice = choices[originalIndex];
        const color = getColorForChoice(choice);
        const isQuorumChoice = quorumChoices.includes(originalIndex);
        return {
          name: choice,
          type: "line",
          stack: isQuorumChoice ? "QuorumTotal" : undefined,
          lineStyle: {
            width: isQuorumChoice ? 0 : 2,
            color: color,
          },
          showSymbol: false,
          emphasis: {
            itemStyle: {
              color: color,
              borderColor: color,
            },
          },
          areaStyle: isQuorumChoice
            ? {
                opacity: 0.8,
                color: color,
              }
            : undefined,
          data: cumulativeData[originalIndex],
        };
      },
    );

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

    const maxVotingValue = Math.max(
      ...timePoints.map((timePoint) => {
        const quorumStackSum = quorumChoices.reduce((sum, choiceIndex) => {
          const choiceData = cumulativeData[choiceIndex];
          const pointData = choiceData.find((point) => point[0] === timePoint);
          return sum + (pointData ? pointData[1] : 0);
        }, 0);

        const nonQuorumStackSum = choices
          .map((_, index) => index)
          .filter((index) => !quorumChoices.includes(index))
          .reduce((sum, choiceIndex) => {
            const choiceData = cumulativeData[choiceIndex];
            const pointData = choiceData.find(
              (point) => point[0] === timePoint,
            );
            return sum + (pointData ? pointData[1] : 0);
          }, 0);

        return Math.max(quorumStackSum, nonQuorumStackSum);
      }),
    );

    const quorumValue = Number(proposal.quorum) || 0;
    const yAxisMax = Math.max(maxVotingValue, quorumValue) * 1.1;

    const proposalEndTime = new Date(proposal.timeEnd);
    const projectionSeries: echarts.SeriesOption[] = [];

    if (lastVoteTime < proposalEndTime) {
      sortedChoiceIndices.forEach((originalIndex) => {
        const lastValue = lastKnownValues[originalIndex];
        const choice = choices[originalIndex];
        const isQuorumChoice = quorumChoices.includes(originalIndex);
        const color = getColorForChoice(choice);

        projectionSeries.push({
          name: `${choice} (Projection)`,
          type: "line",
          stack: isQuorumChoice ? "QuorumTotalProjection" : undefined,
          lineStyle: {
            width: 1,
            type: "dashed",
            color: color,
          },
          showSymbol: false,
          areaStyle: isQuorumChoice
            ? {
                opacity: 0.3,
                color: color,
              }
            : undefined,
          data: [
            [format(lastVoteTime, "yyyy-MM-dd HH:mm"), lastValue],
            [format(proposalEndTime, "yyyy-MM-dd HH:mm"), lastValue],
          ],
          silent: true,
          tooltip: {
            show: false,
          },
        });
      });
    }

    const allSeries = [...series, ...projectionSeries];

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
        name: "Time",
        min: new Date(proposal.timeStart).getTime(),
        max: new Date(proposal.timeEnd).getTime(),
        axisLabel: {
          formatter: (value: number) => format(new Date(value), "MMM d, HH:mm"),
        },
      },
      yAxis: [
        {
          type: "value",
          nameLocation: "middle",
          nameGap: 30,
          max: yAxisMax,
          axisLabel: {
            formatter: (value: number) => formatNumberWithSuffix(value),
          },
        },
      ],
      legend: {
        data: sortedChoices.map((choice) => ({
          name: choice,
          itemStyle: {
            color: getColorForChoice(choice),
          },
        })),
        bottom: 0,
        selectedMode: false,
      },
      series: allSeries,
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
