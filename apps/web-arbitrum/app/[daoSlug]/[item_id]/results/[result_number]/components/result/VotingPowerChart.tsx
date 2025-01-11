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

// Function to determine the color based on the choice name
const getColorForChoice = (choice: string): string => {
  const lowerCaseChoice = choice.toLowerCase();
  if (["for", "yes", "yae"].includes(lowerCaseChoice)) {
    return "#10B981"; // Green
  } else if (["against", "no", "nay"].includes(lowerCaseChoice)) {
    return "#EF4444"; // Red
  } else if (lowerCaseChoice === "abstain") {
    return "#F59E0B"; // Yellow
  } else {
    // Random color from a predefined palette
    const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#6EE7B7"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
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

    // Sort votes by timestamp
    const sortedVotes = [...votes].sort((a, b) => {
      const timeA = a.timeCreated ? new Date(a.timeCreated).getTime() : 0;
      const timeB = b.timeCreated ? new Date(b.timeCreated).getTime() : 0;
      return timeA - timeB;
    });

    // Get the start time from proposal and last vote time
    const startTime = startOfHour(new Date(proposal.timeStart));
    const lastVoteTime =
      sortedVotes.length > 0
        ? startOfHour(
            new Date(sortedVotes[sortedVotes.length - 1].timeCreated!),
          )
        : startTime;

    // Create hourly intervals only up to the last vote
    const hourlyData: {
      [hour: string]: { [choice: number]: number };
    } = {};

    // Initialize hours only up to the last vote
    let currentHour = startTime;
    while (currentHour <= lastVoteTime) {
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

    // Convert to cumulative values
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

    // Get the last known values for each choice
    const lastKnownValues: { [choice: number]: number } = {};
    choices.forEach((_, choiceIndex) => {
      const choiceData = cumulativeData[choiceIndex];
      if (choiceData.length > 0) {
        lastKnownValues[choiceIndex] = choiceData[choiceData.length - 1][1];
      } else {
        lastKnownValues[choiceIndex] = 0;
      }
    });

    // Define the explicit stacking order for "For", "Abstain"
    const explicitOrder = ["For", "Abstain"];
    const sortedChoices = [...choices].sort((a, b) => {
      const indexA = explicitOrder.indexOf(a);
      const indexB = explicitOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB; // Use explicit order for these options
      }
      // Fallback to sorting by last known values for other options
      return (
        lastKnownValues[choices.indexOf(b)] -
        lastKnownValues[choices.indexOf(a)]
      );
    });

    // Create a mapping from the original choice index to the sorted choice index
    const sortedChoiceIndices = sortedChoices.map((choice) =>
      choices.indexOf(choice),
    );

    // Create series in the sorted order
    const series: echarts.SeriesOption[] = sortedChoiceIndices.map(
      (originalIndex, sortedIndex) => {
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

    // Calculate the maximum stacked value at any time point
    const maxVotingValue = Math.max(
      ...timePoints.map((timePoint) => {
        // Sum up values for choices that are part of the quorum stack
        const quorumStackSum = quorumChoices.reduce((sum, choiceIndex) => {
          const choiceData = cumulativeData[choiceIndex];
          const pointData = choiceData.find((point) => point[0] === timePoint);
          return sum + (pointData ? pointData[1] : 0);
        }, 0);

        // Sum up values for non-quorum choices
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

        // Return the maximum of quorum stack and non-quorum stack
        return Math.max(quorumStackSum, nonQuorumStackSum);
      }),
    );

    // Calculate the appropriate y-axis max value considering both voting data and quorum
    const quorumValue = Number(proposal.quorum) || 0;
    const yAxisMax = Math.max(maxVotingValue, quorumValue) * 1.1; // Add 10% padding

    // Create projection series if there's a gap between last vote and proposal end
    const proposalEndTime = new Date(proposal.timeEnd);
    const projectionSeries: echarts.SeriesOption[] = [];

    if (lastVoteTime < proposalEndTime) {
      sortedChoiceIndices.forEach((originalIndex, sortedIndex) => {
        const lastValue = lastKnownValues[originalIndex];
        const choice = choices[originalIndex];
        const color = getColorForChoice(choice);

        projectionSeries.push({
          name: `${choice} (Projection)`,
          type: "line",
          stack: quorumChoices.includes(originalIndex)
            ? "QuorumTotalProjection"
            : undefined,
          lineStyle: {
            width: 1,
            type: "dashed",
            color: color,
          },
          showSymbol: false,
          areaStyle: {
            opacity: 0.3,
            color: color,
          },
          data: [
            [format(lastVoteTime, "yyyy-MM-dd HH:mm"), lastValue],
            [format(proposalEndTime, "yyyy-MM-dd HH:mm"), lastValue],
          ],
          silent: true, // Disable interactions with projection lines
          tooltip: {
            show: false, // Hide tooltip for projection lines
          },
        });
      });
    }

    // Combine regular series with projection series
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
